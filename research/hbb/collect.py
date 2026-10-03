#!/usr/bin/env python3
"""Collect public HBB / hemoglobinopathy evidence without API keys.

Caches original responses under research/hbb/raw/ and writes normalized
records plus a manifest with URLs, queries, timestamps, and checksums.
"""

from __future__ import annotations

import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
OUTPUT = ROOT / "output"
CONFIG = ROOT / "config" / "diseases.json"

USER_AGENT = "HBB-KnowledgeGraph/1.0 (Hack-Nation research; public data collector)"
SLEEP_S = 0.35


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_dirs() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for sub in (
        "clinvar",
        "pubmed",
        "clinicaltrials",
        "nih_reporter",
        "hpo",
        "organizations",
        "models",
    ):
        (RAW / sub).mkdir(parents=True, exist_ok=True)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def cache_path(category: str, key: str, ext: str = "json") -> Path:
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", key)[:180]
    return RAW / category / f"{safe}.{ext}"


def fetch(
    url: str,
    *,
    category: str,
    key: str,
    ext: str = "json",
    data: bytes | None = None,
    headers: dict[str, str] | None = None,
    force: bool = False,
) -> tuple[bytes, Path, bool]:
    """Return (body, path, from_cache). Does not overwrite existing snapshots unless force."""
    path = cache_path(category, key, ext)
    if path.exists() and not force:
        return path.read_bytes(), path, True

    req_headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    if headers:
        req_headers.update(headers)
    request = urllib.request.Request(url, data=data, headers=req_headers)
    time.sleep(SLEEP_S)
    try:
        with urllib.request.urlopen(request, timeout=25) as resp:
            body = resp.read()
    except urllib.error.HTTPError as exc:
        body = exc.read() if exc.fp else str(exc).encode()
        # Still cache error bodies so review can flag them.
        path.write_bytes(body)
        raise
    path.write_bytes(body)
    return body, path, False


def load_json_bytes(body: bytes) -> Any:
    return json.loads(body.decode("utf-8", errors="replace"))


def _clinvar_record_from_summary(
    uid: str, item: dict[str, Any], *, path: Path, cached: bool
) -> dict[str, Any]:
    title = item.get("title") or item.get("obj_type") or f"ClinVar {uid}"
    # Newer ClinVar esummary uses germline_classification; keep legacy field too.
    germline = item.get("germline_classification") or {}
    clinical = item.get("clinical_significance") or {}
    if isinstance(germline, dict) and germline.get("description"):
        significance = germline.get("description")
        review_status = germline.get("review_status")
        last_evaluated = germline.get("last_evaluated")
        trait_set = germline.get("trait_set")
    elif isinstance(clinical, dict):
        significance = clinical.get("description") or clinical.get("status")
        review_status = clinical.get("review_status")
        last_evaluated = None
        trait_set = item.get("trait_set")
    else:
        significance = str(clinical) if clinical else None
        review_status = None
        last_evaluated = None
        trait_set = item.get("trait_set")
    return {
        "id": f"clinvar:{uid}",
        "type": "variant",
        "source": "ClinVar",
        "label": title,
        "uid": uid,
        "accession": item.get("accession"),
        "clinical_significance": significance,
        "review_status": review_status,
        "last_evaluated": last_evaluated,
        "gene": "HBB",
        "obj_type": item.get("obj_type"),
        "raw_fields": {
            "chromosome": item.get("chr"),
            "start": item.get("start"),
            "stop": item.get("stop"),
            "obj_type": item.get("obj_type"),
            "trait_set": trait_set,
            "variation_set": item.get("variation_set"),
            "germline_classification": germline if isinstance(germline, dict) else None,
        },
        "source_url": f"https://www.ncbi.nlm.nih.gov/clinvar/variation/{uid}/",
        "retrieval_date": utc_now(),
        "cache_files": [str(path.relative_to(ROOT))],
        "cached": cached,
        "limitations": (
            "ClinVar may list many conditions on one variant summary; do not apply a single "
            "aggregate classification to every listed trait."
        ),
    }


def collect_clinvar_variants() -> list[dict[str, Any]]:
    """Fetch ClinVar variant summaries for HBB-focused queries."""
    queries = [
        ("HBB[gene] AND pathogenic[Clinical Significance]", "hbb_pathogenic"),
        ('HBB[gene] AND "c.20A>T"[Variant name]', "hbb_hbs"),
        ('HBB[gene] AND "c.19G>A"[Variant name]', "hbb_hbc"),
        ("HBB[gene] AND thalassemia", "hbb_thalassemia"),
    ]
    # Authoritative simple-variant anchors (HbS / HbC), not complex haplotypes.
    force_uids = ["15333", "15126"]
    records: list[dict[str, Any]] = []
    seen_uids: set[str] = set()

    # Force-fetch canonical records first.
    force_params = urllib.parse.urlencode(
        {"db": "clinvar", "id": ",".join(force_uids), "retmode": "json"}
    )
    force_url = (
        f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?{force_params}"
    )
    fbody, fpath, fcached = fetch(
        force_url, category="clinvar", key="esummary_canonical_hbs_hbc"
    )
    fsummary = load_json_bytes(fbody)
    fresult = fsummary.get("result", {})
    for uid in force_uids:
        item = fresult.get(uid)
        if not item:
            continue
        seen_uids.add(uid)
        rec = _clinvar_record_from_summary(uid, item, path=fpath, cached=fcached)
        rec["canonical_allele_hint"] = "HbS" if uid == "15333" else "HbC"
        records.append(rec)

    for term, key in queries:
        params = urllib.parse.urlencode(
            {
                "db": "clinvar",
                "term": term,
                "retmax": 40,
                "retmode": "json",
            }
        )
        search_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?{params}"
        body, path, cached = fetch(search_url, category="clinvar", key=f"esearch_{key}")
        payload = load_json_bytes(body)
        ids = payload.get("esearchresult", {}).get("idlist", [])
        if not ids:
            continue
        summary_params = urllib.parse.urlencode(
            {"db": "clinvar", "id": ",".join(ids), "retmode": "json"}
        )
        summary_url = (
            f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?{summary_params}"
        )
        sbody, spath, _ = fetch(
            summary_url, category="clinvar", key=f"esummary_{key}"
        )
        summary = load_json_bytes(sbody)
        result = summary.get("result", {})
        for uid in result.get("uids", []):
            if uid in seen_uids:
                continue
            seen_uids.add(uid)
            item = result.get(uid, {})
            rec = _clinvar_record_from_summary(uid, item, path=spath, cached=cached)
            rec["cache_files"] = [
                str(path.relative_to(ROOT)),
                str(spath.relative_to(ROOT)),
            ]
            # Distinguish complex alleles / haplotypes from simple variants.
            if item.get("obj_type") == "Haplotype" or "[" in (rec.get("label") or ""):
                rec["allele_complexity"] = "complex_allele_or_haplotype"
            else:
                rec["allele_complexity"] = "simple_variant"
            records.append(rec)
    return records


def collect_pubmed() -> list[dict[str, Any]]:
    queries = [
        (
            "exagamglogene autotemcel AND (sickle OR thalassemia)",
            "exa_cel",
        ),
        (
            "(fetal hemoglobin OR HbF OR BCL11A) AND (sickle cell OR beta thalassemia) AND HBB",
            "hbf_bridge",
        ),
        (
            "HBB[Gene] AND (sickle cell anemia OR beta-thalassemia) AND (mechanism OR pathogenesis)",
            "hbb_mechanism",
        ),
    ]
    # Always include anchor PMIDs.
    force_ids = ["38657265", "38661449"]
    records: list[dict[str, Any]] = []
    seen: set[str] = set()

    all_ids: list[str] = []
    for term, key in queries:
        params = urllib.parse.urlencode(
            {
                "db": "pubmed",
                "term": term,
                "retmax": 15,
                "retmode": "json",
                "sort": "relevance",
            }
        )
        url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?{params}"
        body, path, _ = fetch(url, category="pubmed", key=f"esearch_{key}")
        payload = load_json_bytes(body)
        ids = payload.get("esearchresult", {}).get("idlist", [])
        for pmid in ids:
            if pmid not in seen:
                seen.add(pmid)
                all_ids.append(pmid)

    for pmid in force_ids:
        if pmid not in seen:
            seen.add(pmid)
            all_ids.insert(0, pmid)

    # Batch summaries
    for i in range(0, len(all_ids), 20):
        batch = all_ids[i : i + 20]
        params = urllib.parse.urlencode(
            {"db": "pubmed", "id": ",".join(batch), "retmode": "json"}
        )
        url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?{params}"
        body, path, _ = fetch(url, category="pubmed", key=f"esummary_{i}")
        summary = load_json_bytes(body)
        result = summary.get("result", {})
        for pmid in batch:
            item = result.get(pmid, {})
            if not item or pmid == "uids":
                continue
            authors = item.get("authors") or []
            author_names = [
                a.get("name") for a in authors if isinstance(a, dict) and a.get("name")
            ]
            records.append(
                {
                    "id": f"pmid:{pmid}",
                    "type": "publication",
                    "source": "PubMed",
                    "label": item.get("title") or f"PMID {pmid}",
                    "pmid": pmid,
                    "journal": item.get("fulljournalname") or item.get("source"),
                    "pubdate": item.get("pubdate"),
                    "authors": author_names[:12],
                    "doi": (item.get("elocationid") or "").replace("doi: ", "")
                    if item.get("elocationid")
                    else None,
                    "source_url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                    "retrieval_date": utc_now(),
                    "cache_files": [str(path.relative_to(ROOT))],
                    "is_anchor": pmid in force_ids,
                }
            )
    return records


def collect_clinical_trials() -> list[dict[str, Any]]:
    queries = [
        ("sickle cell anemia HbSS OR sickle cell disease HBB", "scd"),
        ("transfusion-dependent beta thalassemia OR beta-thalassemia HBB", "tdt"),
        ("exagamglogene OR BCL11A fetal hemoglobin", "exa_hbf"),
    ]
    records: list[dict[str, Any]] = []
    seen: set[str] = set()

    for term, key in queries:
        params = urllib.parse.urlencode(
            {
                "query.term": term,
                "pageSize": 12,
                "format": "json",
                "countTotal": "true",
            }
        )
        url = f"https://clinicaltrials.gov/api/v2/studies?{params}"
        body, path, _ = fetch(url, category="clinicaltrials", key=f"search_{key}")
        payload = load_json_bytes(body)
        for study in payload.get("studies", []):
            protocol = study.get("protocolSection", {})
            ident = protocol.get("identificationModule", {})
            nct = ident.get("nctId")
            if not nct or nct in seen:
                continue
            seen.add(nct)
            status = protocol.get("statusModule", {})
            design = protocol.get("designModule", {})
            conditions = protocol.get("conditionsModule", {}).get("conditions", [])
            interventions = []
            for arm in protocol.get("armsInterventionsModule", {}).get(
                "interventions", []
            ):
                interventions.append(
                    {
                        "type": arm.get("type"),
                        "name": arm.get("name"),
                    }
                )
            records.append(
                {
                    "id": f"nct:{nct}",
                    "type": "clinical_study",
                    "source": "ClinicalTrials.gov",
                    "label": ident.get("briefTitle") or nct,
                    "nct_id": nct,
                    "official_title": ident.get("officialTitle"),
                    "overall_status": status.get("overallStatus"),
                    "study_type": design.get("studyType"),
                    "phases": design.get("phases"),
                    "conditions": conditions,
                    "interventions": interventions,
                    "source_url": f"https://clinicaltrials.gov/study/{nct}",
                    "retrieval_date": utc_now(),
                    "cache_files": [str(path.relative_to(ROOT))],
                    "notes": "Study status and eligibility are not demonstrated efficacy.",
                }
            )
    return records


def collect_nih_reporter() -> list[dict[str, Any]]:
    searches = [
        ("sickle cell HBB hemoglobin", "scd_hbb"),
        ("beta thalassemia HBB fetal hemoglobin BCL11A", "thal_hbf"),
        ("sickle cell disease fetal hemoglobin", "scd_hbf"),
        ("beta thalassemia gene therapy", "thal_gt"),
    ]
    records: list[dict[str, Any]] = []
    seen: set[str] = set()

    for query, key in searches:
        payload = {
            "criteria": {
                "advanced_text_search": {
                    "operator": "and",
                    "search_field": "all",
                    "search_text": query,
                }
            },
            "offset": 0,
            "limit": 15,
            "sort_field": "project_start_date",
            "sort_order": "desc",
        }
        data = json.dumps(payload).encode("utf-8")
        url = "https://api.reporter.nih.gov/v2/projects/search"
        body, path, _ = fetch(
            url,
            category="nih_reporter",
            key=f"search_{key}",
            data=data,
            headers={"Content-Type": "application/json"},
        )
        result = load_json_bytes(body)
        for proj in result.get("results", []):
            appl_id = str(proj.get("appl_id") or proj.get("project_num") or "")
            if not appl_id or appl_id in seen:
                continue
            seen.add(appl_id)
            pi = proj.get("principal_investigators") or []
            pi_names = [
                f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()
                for p in pi
                if isinstance(p, dict)
            ]
            org = (proj.get("organization") or {}).get("org_name")
            records.append(
                {
                    "id": f"grant:{appl_id}",
                    "type": "grant",
                    "source": "NIH RePORTER",
                    "label": proj.get("project_title") or appl_id,
                    "project_num": proj.get("project_num"),
                    "appl_id": appl_id,
                    "abstract": (proj.get("abstract_text") or "")[:1200],
                    "fiscal_year": proj.get("fiscal_year"),
                    "award_amount": proj.get("award_amount"),
                    "organization": org,
                    "principal_investigators": pi_names,
                    "source_url": f"https://reporter.nih.gov/project-details/{appl_id}",
                    "retrieval_date": utc_now(),
                    "cache_files": [str(path.relative_to(ROOT))],
                }
            )
    return records


def collect_hpo_phenotypes() -> list[dict[str, Any]]:
    """Collect disease–phenotype annotations from JAX HPO network API and Monarch."""
    jax_targets = [
        ("OMIM:603903", "sickle cell anemia", "disease:hbss"),
        ("OMIM:613985", "beta-thalassemia", "disease:beta_thal_genetic"),
        ("ORPHA:232", "sickle cell anemia", "disease:hbss"),
        ("ORPHA:848", "beta-thalassemia", "disease:beta_thal_genetic"),
    ]
    monarch_targets = [
        ("MONDO:0011382", "sickle cell disease", "disease:scd_broad"),
        ("MONDO:0019402", "beta thalassemia", "disease:beta_thal_genetic"),
    ]
    records: list[dict[str, Any]] = []
    seen: set[str] = set()

    for disease_id, label, local_disease in jax_targets:
        url = f"https://ontology.jax.org/api/network/annotation/{urllib.parse.quote(disease_id)}"
        try:
            body, path, _ = fetch(
                url, category="hpo", key=f"jax_{disease_id.replace(':', '_')}"
            )
            payload = load_json_bytes(body)
        except Exception as exc:  # noqa: BLE001
            records.append(
                {
                    "id": f"hpo_query_error:{disease_id}",
                    "type": "phenotype_query",
                    "source": "JAX HPO",
                    "label": f"Failed phenotype query for {label}",
                    "error": str(exc),
                    "retrieval_date": utc_now(),
                }
            )
            continue

        disease_meta = payload.get("disease") or {}
        for category, items in (payload.get("categories") or {}).items():
            for item in items:
                hpo_id = item.get("id")
                if not hpo_id:
                    continue
                key = f"{local_disease}|{hpo_id}|jax|{disease_id}"
                if key in seen:
                    continue
                seen.add(key)
                meta = item.get("metadata") or {}
                frequency = meta.get("frequency") or None
                onset = meta.get("onset") or None
                if frequency == "":
                    frequency = None
                if onset == "":
                    onset = None
                records.append(
                    {
                        "id": f"phenotype_annot:{hashlib.md5(key.encode()).hexdigest()[:12]}",
                        "type": "phenotype_annotation",
                        "source": "JAX HPO disease annotations",
                        "label": item.get("name") or hpo_id,
                        "hpo_id": hpo_id,
                        "disease_query_id": disease_id,
                        "disease_local_id": local_disease,
                        "disease_label": disease_meta.get("name") or label,
                        "disease_mondo": disease_meta.get("mondoId"),
                        "hpo_category": category,
                        "source_url": f"https://hpo.jax.org/browse/term/{urllib.parse.quote(hpo_id)}",
                        "annotation_sources": meta.get("sources"),
                        "retrieval_date": utc_now(),
                        "cache_files": [str(path.relative_to(ROOT))],
                        "frequency": frequency,
                        "onset": onset,
                        "negated": False,
                        "review_status": "discovery_unreviewed",
                        "limitations": (
                            "HPO annotation retained with source disease scope. "
                            "Empty frequency/onset means missing data, not absence. "
                            "Broad ontology disease IDs may not equal local HbSS genotype scope."
                        ),
                    }
                )

    for disease_id, label, local_disease in monarch_targets:
        params = urllib.parse.urlencode(
            {
                "subject": disease_id,
                "category": "biolink:DiseaseToPhenotypicFeatureAssociation",
                "limit": 80,
            }
        )
        url = f"https://api.monarchinitiative.org/v3/api/association?{params}"
        try:
            body, path, _ = fetch(
                url, category="hpo", key=f"monarch_{disease_id.replace(':', '_')}"
            )
            payload = load_json_bytes(body)
        except Exception as exc:  # noqa: BLE001
            records.append(
                {
                    "id": f"hpo_query_error:{disease_id}",
                    "type": "phenotype_query",
                    "source": "Monarch",
                    "label": f"Failed Monarch phenotype query for {label}",
                    "error": str(exc),
                    "retrieval_date": utc_now(),
                }
            )
            continue

        for item in payload.get("items") or []:
            # Guard against ontology ID drift / wrong subject labels
            if item.get("subject") != disease_id:
                continue
            hpo_id = item.get("object")
            if not hpo_id:
                continue
            key = f"{local_disease}|{hpo_id}|monarch|{disease_id}"
            if key in seen:
                continue
            seen.add(key)
            records.append(
                {
                    "id": f"phenotype_annot:{hashlib.md5(key.encode()).hexdigest()[:12]}",
                    "type": "phenotype_annotation",
                    "source": "Monarch / HPOA",
                    "label": item.get("object_label") or hpo_id,
                    "hpo_id": hpo_id,
                    "disease_query_id": disease_id,
                    "disease_local_id": local_disease,
                    "disease_label": item.get("subject_label") or label,
                    "source_url": f"https://hpo.jax.org/browse/term/{urllib.parse.quote(hpo_id)}",
                    "primary_knowledge_source": item.get("primary_knowledge_source"),
                    "retrieval_date": utc_now(),
                    "cache_files": [str(path.relative_to(ROOT))],
                    "frequency": item.get("frequency_qualifier"),
                    "onset": item.get("onset_qualifier"),
                    "negated": bool(item.get("negated")),
                    "review_status": "discovery_unreviewed",
                    "limitations": (
                        "Monarch association; preserve negated flag and frequency qualifier. "
                        "Subject ontology label may be broader than local genotype nodes."
                    ),
                }
            )
    return records


def collect_organization_pages() -> list[dict[str, Any]]:
    targets = [
        {
            "id": "org:scdaa",
            "label": "Sickle Cell Disease Association of America",
            "url": "https://www.sicklecelldisease.org/",
            "role": "patient_organization",
            "disease_relevance": ["disease:scd_broad", "disease:hbss"],
        },
        {
            "id": "org:caf",
            "label": "Cooley's Anemia Foundation",
            "url": "https://www.thalassemia.org/",
            "fallback_urls": [
                "https://web.archive.org/web/2024/https://www.thalassemia.org/",
            ],
            "role": "patient_organization",
            "disease_relevance": ["disease:beta_thal_genetic", "disease:tdt"],
        },
        {
            "id": "asset:jax_townes",
            "label": "JAX Townes sickle-cell mouse model",
            "url": "https://www.jax.org/strain/013071",
            "role": "experimental_model",
            "disease_relevance": ["disease:hbss", "disease:scd_broad"],
            "species": "Mus musculus",
            "notes": "Developed for sickle cell disease modeling; not automatically suitable for beta-thalassemia.",
        },
    ]
    records: list[dict[str, Any]] = []
    for t in targets:
        key = t["id"].replace(":", "_")
        category = (
            "organizations" if t["role"] == "patient_organization" else "models"
        )
        urls_to_try = [t["url"], *t.get("fallback_urls", [])]
        last_error = None
        saved = False
        for url in urls_to_try:
            try:
                body, path, cached = fetch(
                    url,
                    category=category,
                    key=key if url == t["url"] else f"{key}_fallback",
                    ext="html",
                )
                text = body.decode("utf-8", errors="replace")
                usable = True
                lower = text.lower()
                error_markers = [
                    "access denied",
                    "403 forbidden",
                    "page not found",
                    "404 not found",
                    "captcha",
                ]
                for marker in error_markers:
                    if marker in lower and len(text) < 2000:
                        usable = False
                        break
                if len(re.sub(r"\s+", "", text)) < 200:
                    usable = False
                snippet = re.sub(r"<[^>]+>", " ", text)
                snippet = re.sub(r"\s+", " ", snippet).strip()[:400]
                records.append(
                    {
                        **{k: v for k, v in t.items() if k != "fallback_urls"},
                        "type": "organization"
                        if t["role"] == "patient_organization"
                        else "research_asset",
                        "source": "organization_website"
                        if url == t["url"]
                        else "archived_organization_website",
                        "page_usable": usable,
                        "content_snippet": snippet,
                        "content_length": len(text),
                        "source_url": t["url"],
                        "retrieved_url": url,
                        "retrieval_date": utc_now(),
                        "cache_files": [str(path.relative_to(ROOT))],
                        "cached": cached,
                        "notes": (
                            (t.get("notes") or "")
                            + (
                                " Primary URL timed out or failed; archived snapshot used for content check."
                                if url != t["url"]
                                else ""
                            )
                        ).strip()
                        or None,
                    }
                )
                saved = True
                break
            except Exception as exc:  # noqa: BLE001
                last_error = str(exc)
                continue
        if not saved:
            records.append(
                {
                    **{k: v for k, v in t.items() if k != "fallback_urls"},
                    "type": "organization"
                    if t["role"] == "patient_organization"
                    else "research_asset",
                    "source": "organization_website",
                    "page_usable": False,
                    "error": last_error,
                    "source_url": t["url"],
                    "retrieval_date": utc_now(),
                }
            )
    return records


def write_manifest(entries: list[dict[str, Any]]) -> None:
    manifest = {
        "generated_at": utc_now(),
        "collector": "research/hbb/collect.py",
        "sources": entries,
        "policy": {
            "api_keys_required": False,
            "overwrite_existing_raw": False,
            "private_patient_data": False,
        },
    }
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main() -> None:
    ensure_dirs()
    diseases = json.loads(CONFIG.read_text(encoding="utf-8"))

    print("Collecting ClinVar variants...")
    variants = collect_clinvar_variants()
    print(f"  variants: {len(variants)}")

    print("Collecting PubMed publications...")
    pubs = collect_pubmed()
    print(f"  publications: {len(pubs)}")

    print("Collecting ClinicalTrials.gov studies...")
    trials = collect_clinical_trials()
    print(f"  clinical studies: {len(trials)}")

    print("Collecting NIH RePORTER projects...")
    grants = collect_nih_reporter()
    print(f"  funded projects: {len(grants)}")

    print("Collecting phenotype annotations (discovery-grade OLS/HPO)...")
    phenotypes = collect_hpo_phenotypes()
    print(f"  phenotype annotations: {len(phenotypes)}")

    print("Collecting organization/model pages...")
    orgs = collect_organization_pages()
    print(f"  org/asset pages: {len(orgs)}")

    records = {
        "generated_at": utc_now(),
        "focus": diseases,
        "counts": {
            "variants": len(variants),
            "phenotype_annotations": len(phenotypes),
            "publications": len(pubs),
            "clinical_studies": len(trials),
            "funded_projects": len(grants),
            "organizations_and_assets": len(orgs),
        },
        "variants": variants,
        "phenotype_annotations": phenotypes,
        "publications": pubs,
        "clinical_studies": trials,
        "funded_projects": grants,
        "organizations_and_assets": orgs,
    }
    (OUTPUT / "records.json").write_text(
        json.dumps(records, indent=2), encoding="utf-8"
    )

    # Manifest over raw files
    source_entries = []
    for path in sorted(RAW.rglob("*")):
        if path.is_file():
            data = path.read_bytes()
            source_entries.append(
                {
                    "path": str(path.relative_to(ROOT)),
                    "bytes": len(data),
                    "sha256": sha256_bytes(data),
                    "mtime_utc": datetime.fromtimestamp(
                        path.stat().st_mtime, timezone.utc
                    )
                    .replace(microsecond=0)
                    .isoformat(),
                }
            )
    write_manifest(source_entries)

    quality = {
        "generated_at": utc_now(),
        "counts": records["counts"],
        "coverage_notes": [
            "Phenotype annotations from OLS text search are discovery-grade, not curated HPO disease frequencies.",
            "ClinicalTrials records capture status/eligibility context only.",
            "Organization pages were checked for usable HTML content vs access-error stubs.",
        ],
        "organization_page_usability": {
            r["id"]: r.get("page_usable") for r in orgs
        },
        "anchor_publications_present": [
            p["id"] for p in pubs if p.get("is_anchor")
        ],
    }
    (OUTPUT / "quality-report.json").write_text(
        json.dumps(quality, indent=2), encoding="utf-8"
    )

    summary = f"""# HBB collection summary

Generated: {records['generated_at']}

## Counts

| Category | Count |
|---|---|
| Variants (ClinVar) | {len(variants)} |
| Phenotype annotations (discovery) | {len(phenotypes)} |
| Publications (PubMed) | {len(pubs)} |
| Clinical studies | {len(trials)} |
| Funded projects (NIH RePORTER) | {len(grants)} |
| Organizations / model pages | {len(orgs)} |

## Anchor publications

- PMID 38657265 — Exagamglogene autotemcel for transfusion-dependent β-thalassemia
- PMID 38661449 — Exagamglogene autotemcel for severe sickle cell disease

## Limitations

- No API keys used; some sources rate-limit or return partial payloads.
- OLS/HPO text search hits are **not** curated disease–phenotype frequency annotations.
- Broad sickle cell disease and HbSS are preserved as distinct disease nodes downstream.
- Genetic β-thalassemia categories are kept separate from transfusion-dependence labels.
- Organization/model HTML snapshots were checked for access-error stubs; see quality-report.json.
- Raw responses are cached under `raw/` and are not overwritten on re-run unless forced.
"""
    (OUTPUT / "collection-summary.md").write_text(summary, encoding="utf-8")
    print("Wrote output/records.json, quality-report.json, collection-summary.md, manifest.json")


if __name__ == "__main__":
    main()
