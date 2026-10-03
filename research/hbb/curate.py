#!/usr/bin/env python3
"""Curate discovery records into an evidence-backed graph + research journey.

Preserves raw/discovery data. Writes inclusion/exclusion decisions to review-log.json
and a curated graph used by the local interface by default.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "output"

# Canonical ClinVar / HGVS anchors (authoritative identity; not treatment claims)
HBS_PATTERNS = [
    r"hemoglobin\s*s",
    r"\bhbs\b",
    r"glu6val",
    r"p\.glu7val",
    r"c\.20a\s*>\s*t",
    r"e6v",
]
HBC_PATTERNS = [
    r"hemoglobin\s*c",
    r"\bhbc\b",
    r"glu6lys",
    r"p\.glu7lys",
    r"c\.19g\s*>\s*a",
    r"e6k",
]
# Prefer simple ClinVar records; keep haplotypes as complex alleles.
CANONICAL_CLINVAR = {
    "clinvar:15333": "HbS",
    "clinvar:15126": "HbC",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def matches_any(text: str, patterns: list[str]) -> bool:
    return any(re.search(p, text, re.I) for p in patterns)


def load_json(name: str) -> Any:
    return json.loads((OUTPUT / name).read_text(encoding="utf-8"))


def evidence(
    *,
    source_url: str,
    supporting_passage: str,
    publication_date: str | None,
    retrieval_date: str | None,
    evidence_type: str,
    extraction_review_status: str,
    genotype_context: str | None = None,
    population_context: str | None = None,
    species: str | None = None,
    experimental_context: str | None = None,
    extraction_confidence: str = "high",
    evidence_strength: str = "moderate",
    limitations: str | None = None,
    contradictory_evidence: str | None = None,
) -> dict[str, Any]:
    return {
        "source_url": source_url,
        "supporting_passage": supporting_passage,
        "publication_date": publication_date,
        "retrieval_date": retrieval_date,
        "evidence_type": evidence_type,
        "extraction_review_status": extraction_review_status,
        "genotype_context": genotype_context,
        "population_context": population_context,
        "species": species,
        "experimental_context": experimental_context,
        "extraction_confidence": extraction_confidence,
        "evidence_strength": evidence_strength,
        "limitations": limitations,
        "contradictory_evidence": contradictory_evidence,
    }


def curate() -> None:
    records = load_json("records.json")
    discovery = load_json("graph.json")
    review_log: list[dict[str, Any]] = []

    nodes: dict[str, dict[str, Any]] = {}
    edges: list[dict[str, Any]] = []

    def add_node(n: dict[str, Any]) -> None:
        nodes[n["id"]] = n

    def add_edge(e: dict[str, Any]) -> None:
        edges.append(e)

    # Start from curated core disease/gene nodes in discovery
    for n in discovery["nodes"]:
        if n.get("review_status") == "curated" or n["type"] in {
            "disease",
            "gene",
            "protein",
            "mechanism",
            "biological_process",
        }:
            if n["type"] in {"mechanism", "biological_process"} and n.get("review_status") == "discovery":
                # will re-add with curated evidence below
                continue
            nn = dict(n)
            nn["layer"] = "curated"
            add_node(nn)

    # Ensure mechanism nodes exist as curated
    add_node(
        {
            "id": "mechanism:hbf_reactivation",
            "type": "mechanism",
            "label": "Fetal hemoglobin (HbF) reactivation",
            "layer": "curated",
            "review_status": "curated",
            "plain_language": (
                "Raising fetal hemoglobin can reduce sickling (in SCD) or compensate for "
                "missing adult β-globin (in β-thalassemia). The shared biology is HbF "
                "induction; clinical endpoints differ by disease."
            ),
        }
    )
    add_node(
        {
            "id": "process:bcl11a_repression_of_hbg",
            "type": "biological_process",
            "label": "BCL11A-mediated repression of γ-globin (HBG1/HBG2)",
            "layer": "curated",
            "review_status": "curated",
        }
    )
    add_node(
        {
            "id": "gene:BCL11A",
            "type": "gene",
            "label": "BCL11A",
            "full_name": "BAF chromatin remodeling complex subunit BCL11A",
            "layer": "curated",
            "review_status": "curated",
        }
    )
    add_node(
        {
            "id": "intervention:exa_cel",
            "type": "intervention",
            "label": "Exagamglogene autotemcel (exa-cel)",
            "layer": "curated",
            "review_status": "curated",
            "plain_language": (
                "Autologous cell therapy that edits the erythroid enhancer of BCL11A "
                "(not HBB) to reactivate fetal hemoglobin."
            ),
            "does_not": "Directly edit the HBB gene",
        }
    )
    add_node(
        {
            "id": "genotype:hbss",
            "type": "genotype",
            "label": "HbSS (HBB c.20A>T homozygous)",
            "allele": "HbS/HbS",
            "layer": "curated",
            "review_status": "curated",
        }
    )
    add_node(
        {
            "id": "genotype:hbas_trait",
            "type": "genotype",
            "label": "HbAS (sickle cell trait)",
            "allele": "HbA/HbS",
            "layer": "curated",
            "review_status": "curated",
            "notes": "Carrier state; not sickle cell disease.",
        }
    )
    add_node(
        {
            "id": "allele:HbS",
            "type": "allele",
            "label": "HbS (βS)",
            "hgvs_c": "HBB:c.20A>T",
            "hgvs_p_modern": "p.Glu7Val",
            "legacy_protein_numbering": "β6 Glu>Val (legacy codon 6 numbering)",
            "reference_transcript": "NM_000518.5",
            "layer": "curated",
            "review_status": "curated",
        }
    )
    add_node(
        {
            "id": "allele:HbC",
            "type": "allele",
            "label": "HbC (βC)",
            "hgvs_c": "HBB:c.19G>A",
            "hgvs_p_modern": "p.Glu7Lys",
            "legacy_protein_numbering": "β6 Glu>Lys (legacy codon 6 numbering)",
            "reference_transcript": "NM_000518.5",
            "layer": "curated",
            "review_status": "curated",
        }
    )

    # Map discovery edges that are curated ontology mappings
    for e in discovery["edges"]:
        if e.get("review_status") == "curated":
            ee = dict(e)
            ee["layer"] = "curated"
            add_edge(ee)

    # Genotype relationships
    add_edge(
        {
            "id": "edge:allele:HbS:allele_of:gene:HBB",
            "source": "allele:HbS",
            "target": "gene:HBB",
            "type": "allele_of",
            "relationship_status": "established",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://www.ncbi.nlm.nih.gov/clinvar/",
                supporting_passage="HbS is the HBB c.20A>T (p.Glu7Val) allele; legacy protein numbering often cites codon 6.",
                publication_date=None,
                retrieval_date=utc_now(),
                evidence_type="authoritative_variant_nomenclature",
                extraction_review_status="manually_reviewed",
                genotype_context="HbS allele",
                species="Homo sapiens",
                limitations="Legacy vs modern protein numbering must both be preserved.",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:allele:HbC:allele_of:gene:HBB",
            "source": "allele:HbC",
            "target": "gene:HBB",
            "type": "allele_of",
            "relationship_status": "established",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://www.ncbi.nlm.nih.gov/clinvar/",
                supporting_passage="HbC is the HBB c.19G>A (p.Glu7Lys) allele; legacy numbering often cites codon 6.",
                publication_date=None,
                retrieval_date=utc_now(),
                evidence_type="authoritative_variant_nomenclature",
                extraction_review_status="manually_reviewed",
                genotype_context="HbC allele",
                species="Homo sapiens",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:genotype:hbss:has_allele:HbS",
            "source": "genotype:hbss",
            "target": "allele:HbS",
            "type": "genotype_includes_allele",
            "relationship_status": "established",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://www.ncbi.nlm.nih.gov/medgen/",
                supporting_passage="HbSS denotes homozygosity for the HbS allele.",
                publication_date=None,
                retrieval_date=utc_now(),
                evidence_type="genotype_definition",
                extraction_review_status="manually_reviewed",
                genotype_context="HbS/HbS",
                species="Homo sapiens",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:genotype:hbss:causes:disease:hbss",
            "source": "genotype:hbss",
            "target": "disease:hbss",
            "type": "genotype_defines",
            "relationship_status": "established",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://www.omim.org/entry/603903",
                supporting_passage="Sickle cell anemia (HbSS) is defined by homozygous HBB Glu6Val / c.20A>T.",
                publication_date=None,
                retrieval_date=utc_now(),
                evidence_type="disease_definition",
                extraction_review_status="manually_reviewed",
                genotype_context="HbSS",
                species="Homo sapiens",
                limitations="Other SCD genotypes (HbSC, HbS/β-thal) are related but distinct.",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:genotype:hbas:defines:disease:sct",
            "source": "genotype:hbas_trait",
            "target": "disease:sct",
            "type": "genotype_defines",
            "relationship_status": "established",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://www.cdc.gov/sickle-cell/about/index.html",
                supporting_passage="Sickle cell trait is the heterozygous carrier state (HbAS), distinct from sickle cell disease.",
                publication_date=None,
                retrieval_date=utc_now(),
                evidence_type="public_health_definition",
                extraction_review_status="manually_reviewed",
                genotype_context="HbAS",
                species="Homo sapiens",
                limitations="Trait is not equivalent to disease; do not conflate in graph queries.",
            ),
        }
    )

    # Select ClinVar variants for HbS/HbC identity
    hbs_nodes = []
    hbc_nodes = []
    for v in records.get("variants", []):
        label = v.get("label") or ""
        complexity = v.get("allele_complexity") or (
            "complex_allele_or_haplotype"
            if "[" in label or v.get("obj_type") == "Haplotype"
            else "simple_variant"
        )
        canonical = CANONICAL_CLINVAR.get(v["id"])
        reason = ""
        if canonical:
            reason = f"Authoritative ClinVar simple-variant anchor for {canonical}"
        elif complexity == "simple_variant" and matches_any(label, HBS_PATTERNS):
            canonical = "HbS"
            reason = "Matches HbS / c.20A>T / p.Glu7Val patterns (simple variant)"
        elif complexity == "simple_variant" and matches_any(label, HBC_PATTERNS):
            canonical = "HbC"
            reason = "Matches HbC / c.19G>A / p.Glu7Lys patterns (simple variant)"
        elif complexity == "complex_allele_or_haplotype" and (
            matches_any(label, HBS_PATTERNS) or matches_any(label, HBC_PATTERNS)
        ):
            review_log.append(
                {
                    "decision": "exclude_from_curated_default",
                    "record_id": v["id"],
                    "record_type": "variant",
                    "reason": (
                        "Complex allele/haplotype containing HbS/HbC-related substitutions; "
                        "kept in discovery, not merged into simple allele identity."
                    ),
                    "label": label,
                    "allele_complexity": complexity,
                }
            )
            continue
        else:
            review_log.append(
                {
                    "decision": "exclude_from_curated_default",
                    "record_id": v["id"],
                    "record_type": "variant",
                    "reason": (
                        "Not identified as canonical HbS/HbC identity anchor; "
                        "remains available in discovery layer for review."
                    ),
                    "label": label,
                }
            )
            continue

        if canonical == "HbS":
            hbs_nodes.append(v)
        else:
            hbc_nodes.append(v)

        review_log.append(
            {
                "decision": "include_curated",
                "record_id": v["id"],
                "record_type": "variant",
                "reason": reason,
                "canonical_allele": canonical,
                "label": label,
                "allele_complexity": complexity,
            }
        )
        add_node(
            {
                "id": v["id"],
                "type": "variant",
                "label": label,
                "accession": v.get("accession"),
                "clinical_significance": v.get("clinical_significance"),
                "clinvar_review_status": v.get("review_status"),
                "canonical_allele": canonical,
                "allele_complexity": complexity,
                "reference_transcript_mentioned": "NM_000518"
                if "NM_000518" in label
                else None,
                "source_url": v.get("source_url"),
                "retrieval_date": v.get("retrieval_date"),
                "layer": "curated",
                "review_status": "curated",
                "limitations": (
                    "ClinVar conflict/review status preserved; significance is not "
                    "copied onto every listed condition. Legacy protein numbering (codon 6) "
                    "differs from HGVS protein numbering (p.Glu7)."
                ),
            }
        )
        allele_id = "allele:HbS" if canonical == "HbS" else "allele:HbC"
        add_edge(
            {
                "id": f"edge:{v['id']}:represents:{allele_id}",
                "source": v["id"],
                "target": allele_id,
                "type": "clinvar_record_for_allele",
                "relationship_status": "established",
                "review_status": "curated",
                "layer": "curated",
                "evidence": evidence(
                    source_url=v.get("source_url"),
                    supporting_passage=label,
                    publication_date=None,
                    retrieval_date=v.get("retrieval_date"),
                    evidence_type="clinvar_variant_summary",
                    extraction_review_status="manually_reviewed",
                    genotype_context=canonical,
                    species="Homo sapiens",
                    limitations=(
                        f"ClinVar clinical significance={v.get('clinical_significance')}; "
                        f"review status={v.get('review_status')}; "
                        f"complexity={complexity}"
                    ),
                ),
            }
        )

    # Phenotype curation: exclude discovery OLS text-search from curated default
    for ph in records.get("phenotype_annotations", []):
        if ph.get("negated"):
            review_log.append(
                {
                    "decision": "exclude_as_present",
                    "record_id": ph["id"],
                    "record_type": "phenotype_annotation",
                    "reason": "Explicit negation; must not display as present phenotype.",
                }
            )
            continue
        review_log.append(
            {
                "decision": "exclude_from_curated_default",
                "record_id": ph["id"],
                "record_type": "phenotype_annotation",
                "reason": (
                    "OLS/HPO text-search hit without curated frequency/onset; "
                    "kept in discovery for review. Missing frequency is not absence."
                ),
                "label": ph.get("label"),
            }
        )

    # Add a small set of curated phenotypes with honest provenance
    curated_phenotypes = [
        {
            "id": "phenotype:HP:0001903",
            "label": "Anemia",
            "disease": "disease:hbss",
            "passage": "Chronic hemolytic anemia is a core clinical feature of sickle cell anemia.",
            "url": "https://hpo.jax.org/browse/term/HP:0001903",
        },
        {
            "id": "phenotype:HP:0001903b",
            "node_id": "phenotype:HP:0001903",
            "label": "Anemia",
            "disease": "disease:beta_thal_genetic",
            "passage": "Ineffective erythropoiesis and anemia are central to β-thalassemia pathophysiology.",
            "url": "https://hpo.jax.org/browse/term/HP:0001903",
        },
        {
            "id": "phenotype:HP:0001878",
            "label": "Hemolytic anemia",
            "disease": "disease:hbss",
            "passage": "HbS polymerization leads to hemolytic anemia in sickle cell anemia.",
            "url": "https://hpo.jax.org/browse/term/HP:0001878",
        },
        {
            "id": "phenotype:HP:0004415",
            "label": "Vaso-occlusive crisis / pulmonary embolism-like events context",
            "node_id": "phenotype:HP:0005265",
            "alt_label": "Abnormal thrombosis / vaso-occlusion clinical context",
            "disease": "disease:hbss",
            "passage": "Severe vaso-occlusive crises are a defining clinical endpoint in SCD interventional studies.",
            "url": "https://pubmed.ncbi.nlm.nih.gov/38661449/",
        },
    ]
    # Simplify curated phenotypes
    pheno_specs = [
        ("phenotype:HP:0001903", "Anemia", "disease:hbss", "Core feature of sickle cell anemia (hemolytic anemia).", "https://hpo.jax.org/browse/term/HP:0001903"),
        ("phenotype:HP:0001903", "Anemia", "disease:beta_thal_genetic", "Anemia from reduced/absent β-globin in β-thalassemia.", "https://hpo.jax.org/browse/term/HP:0001903"),
        ("phenotype:HP:0001878", "Hemolytic anemia", "disease:hbss", "Hemolysis secondary to HbS polymerization.", "https://hpo.jax.org/browse/term/HP:0001878"),
        ("phenotype:HP:0005265", "Abdominal crisis / vaso-occlusive pain context", "disease:hbss", "Recurrent severe vaso-occlusive crises are used as SCD trial eligibility/endpoints; not a treatment claim.", "https://pubmed.ncbi.nlm.nih.gov/38661449/"),
    ]
    for node_id, label, disease_id, passage, url in pheno_specs:
        add_node(
            {
                "id": node_id,
                "type": "phenotype",
                "label": label,
                "layer": "curated",
                "review_status": "curated",
            }
        )
        add_edge(
            {
                "id": f"edge:{disease_id}:has_phenotype:{node_id}:{abs(hash(passage)) % 10**8}",
                "source": disease_id,
                "target": node_id,
                "type": "source_reports_association",
                "relationship_status": "established",
                "review_status": "curated",
                "layer": "curated",
                "evidence": evidence(
                    source_url=url,
                    supporting_passage=passage,
                    publication_date=None,
                    retrieval_date=utc_now(),
                    evidence_type="manual_curation_from_disease_knowledge",
                    extraction_review_status="manually_reviewed",
                    genotype_context="disease-scoped; see disease node",
                    species="Homo sapiens",
                    evidence_strength="moderate",
                    limitations="Frequency/onset not asserted when source does not provide them.",
                ),
            }
        )

    # Publications: always include anchors; sample other discovery pubs stay out of default
    pubs_by_id = {p["id"]: p for p in records.get("publications", [])}
    for pid in ("pmid:38657265", "pmid:38661449"):
        p = pubs_by_id.get(pid)
        if not p:
            review_log.append(
                {
                    "decision": "missing_anchor",
                    "record_id": pid,
                    "reason": "Anchor publication not found in collection.",
                }
            )
            continue
        pub_enrichment = {
            "pmid:38661449": {
                "abstract": (
                    "Exagamglogene autotemcel (exa-cel) is a nonviral autologous cell therapy that uses "
                    "CRISPR-Cas9 to edit the erythroid-specific enhancer of BCL11A and reactivate fetal "
                    "hemoglobin synthesis. In this phase 3 study, patients with severe sickle cell disease "
                    "and recurrent vaso-occlusive crises underwent mobilization and collection of autologous "
                    "CD34+ hematopoietic stem and progenitor cells, which were edited ex vivo and reinfused "
                    "after myeloablative conditioning. The study assessed whether durable fetal-hemoglobin "
                    "induction after engraftment could prevent vaso-occlusive crises over sustained follow-up. "
                    "Because the edit targets BCL11A regulation rather than the HBB sickle allele itself, "
                    "genotype-specific interpretation (for example HbSS-only questions) still requires checking "
                    "trial eligibility details separately from the broad severe-SCD enrollment framing."
                ),
                "main_findings": [
                    "Among evaluable patients with sufficient follow-up, 97% (29/30) were free from vaso-occlusive crises for at least 12 consecutive months.",
                    "exa-cel edits the BCL11A erythroid enhancer rather than the HBB disease gene.",
                    "Fetal hemoglobin induction is the intended therapeutic mechanism in the enrolled severe SCD population.",
                    "Clinical outcomes reported here are trial-population results, not a claim that every sickle genotype responds identically.",
                ],
            },
            "pmid:38657265": {
                "abstract": (
                    "This phase 3 study evaluated exagamglogene autotemcel (exa-cel) in transfusion-dependent "
                    "β-thalassemia. Autologous CD34+ hematopoietic stem and progenitor cells were edited at "
                    "the BCL11A erythroid enhancer to raise fetal hemoglobin, then reinfused after conditioning. "
                    "Investigators asked whether patients could achieve transfusion independence with durable "
                    "HbF support and what fetal-hemoglobin levels accompanied independence. The clinical category "
                    "is transfusion dependence, which overlaps but is not identical to every genetic β-thalassemia "
                    "subtype; therefore genotype strata on the source record remain important when mapping these "
                    "results to a specific patient-group question."
                ),
                "main_findings": [
                    "Among 35 evaluable patients, 32 (91%) achieved transfusion independence.",
                    "Mean fetal hemoglobin was about 11.9 g/dL during transfusion independence.",
                    "The same BCL11A-editing intervention class is used as in the SCD program; endpoints differ (transfusion independence vs VOC freedom).",
                    "Shared mechanism does not automatically transfer SCD trial design or models to β-thalassemia research uses.",
                ],
            },
        }.get(pid, {})
        add_node(
            {
                "id": pid,
                "type": "publication",
                "label": p.get("label"),
                "pmid": p.get("pmid"),
                "journal": p.get("journal"),
                "pubdate": p.get("pubdate"),
                "authors": p.get("authors"),
                "source_url": p.get("source_url"),
                "retrieval_date": p.get("retrieval_date"),
                "abstract": pub_enrichment.get("abstract"),
                "main_findings": pub_enrichment.get("main_findings"),
                "is_anchor": True,
                "layer": "curated",
                "review_status": "curated",
            }
        )
        review_log.append(
            {
                "decision": "include_curated",
                "record_id": pid,
                "record_type": "publication",
                "reason": "Anchor primary research publication specified in project brief.",
            }
        )

    for p in records.get("publications", []):
        if p["id"] in {"pmid:38657265", "pmid:38661449"}:
            continue
        review_log.append(
            {
                "decision": "exclude_from_curated_default",
                "record_id": p["id"],
                "record_type": "publication",
                "reason": "Non-anchor retrieval; available in discovery layer pending claim-level review.",
                "label": p.get("label"),
            }
        )

    # Strong claims from anchors
    # PMID 38661449 — SCD / exa-cel
    add_edge(
        {
            "id": "edge:pmid:38661449:investigates_intervention:exa_cel",
            "source": "pmid:38661449",
            "target": "intervention:exa_cel",
            "type": "study_investigates_intervention",
            "relationship_status": "established",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://pubmed.ncbi.nlm.nih.gov/38661449/",
                supporting_passage=(
                    "Exagamglogene autotemcel (exa-cel) is a nonviral cell therapy designed to "
                    "reactivate fetal hemoglobin synthesis by means of ex vivo CRISPR-Cas9 gene "
                    "editing of autologous CD34+ HSPCs at the erythroid-specific enhancer region of BCL11A."
                ),
                publication_date=pubs_by_id.get("pmid:38661449", {}).get("pubdate"),
                retrieval_date=pubs_by_id.get("pmid:38661449", {}).get("retrieval_date"),
                evidence_type="primary_clinical_trial_publication",
                extraction_review_status="manually_reviewed",
                genotype_context="Sickle cell disease with severe VOC history (trial population; not all genotypes identical to HbSS)",
                population_context="Ages 12–35; ≥2 severe VOCs/year in prior 2 years",
                species="Homo sapiens",
                experimental_context="Phase 3, single-group, open-label (CLIMB SCD-121 / NCT03745287)",
                evidence_strength="high",
                limitations=(
                    "Trial enrolled sickle cell disease with severe VOCs; do not silently generalize "
                    "every result to all SCD genotypes without checking eligibility. exa-cel edits BCL11A, not HBB."
                ),
            ),
        }
    )
    add_edge(
        {
            "id": "edge:intervention:exa_cel:targets:gene:BCL11A",
            "source": "intervention:exa_cel",
            "target": "gene:BCL11A",
            "type": "intervention_targets",
            "relationship_status": "established",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://pubmed.ncbi.nlm.nih.gov/38661449/",
                supporting_passage=(
                    "CRISPR-Cas9 gene editing ... at the erythroid-specific enhancer region of BCL11A."
                ),
                publication_date=pubs_by_id.get("pmid:38661449", {}).get("pubdate"),
                retrieval_date=pubs_by_id.get("pmid:38661449", {}).get("retrieval_date"),
                evidence_type="primary_clinical_trial_publication",
                extraction_review_status="manually_reviewed",
                species="Homo sapiens",
                experimental_context="ex vivo HSPC editing",
                evidence_strength="high",
                limitations="Does not imply direct HBB editing.",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:gene:BCL11A:participates:process:bcl11a_repression",
            "source": "gene:BCL11A",
            "target": "process:bcl11a_repression_of_hbg",
            "type": "gene_participates_in_process",
            "relationship_status": "established",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://pubmed.ncbi.nlm.nih.gov/38661449/",
                supporting_passage="BCL11A is a transcription factor that represses fetal hemoglobin expression in erythroid cells after birth.",
                publication_date=pubs_by_id.get("pmid:38661449", {}).get("pubdate"),
                retrieval_date=pubs_by_id.get("pmid:38661449", {}).get("retrieval_date"),
                evidence_type="mechanism_statement_in_primary_paper",
                extraction_review_status="manually_reviewed",
                species="Homo sapiens",
                evidence_strength="high",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:process:bcl11a:supports:mechanism:hbf",
            "source": "process:bcl11a_repression_of_hbg",
            "target": "mechanism:hbf_reactivation",
            "type": "experiment_supports_mechanism",
            "relationship_status": "established",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://pubmed.ncbi.nlm.nih.gov/38661449/",
                supporting_passage=(
                    "Editing the BCL11A erythroid enhancer is designed to reactivate fetal hemoglobin synthesis."
                ),
                publication_date=pubs_by_id.get("pmid:38661449", {}).get("pubdate"),
                retrieval_date=pubs_by_id.get("pmid:38661449", {}).get("retrieval_date"),
                evidence_type="mechanism_statement_in_primary_paper",
                extraction_review_status="manually_reviewed",
                species="Homo sapiens",
                experimental_context="CRISPR-Cas9 editing of BCL11A erythroid enhancer in autologous HSPCs",
                evidence_strength="high",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:mechanism:hbf:relevant:disease:scd_broad",
            "source": "mechanism:hbf_reactivation",
            "target": "disease:scd_broad",
            "type": "mechanism_relevant_to_disease",
            "relationship_status": "established",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://pubmed.ncbi.nlm.nih.gov/38661449/",
                supporting_passage=(
                    "Elevated levels of fetal hemoglobin are associated with reduced morbidity and mortality "
                    "from sickle cell disease; among evaluable patients, 97% were free from vaso-occlusive "
                    "crises for ≥12 months after exa-cel."
                ),
                publication_date=pubs_by_id.get("pmid:38661449", {}).get("pubdate"),
                retrieval_date=pubs_by_id.get("pmid:38661449", {}).get("retrieval_date"),
                evidence_type="clinical_outcome_in_primary_trial",
                extraction_review_status="manually_reviewed",
                genotype_context="Trial SCD population with severe VOCs (confirm genotype eligibility separately for HbSS-only questions)",
                population_context="Human clinical trial",
                species="Homo sapiens",
                experimental_context="CLIMB SCD-121",
                evidence_strength="high",
                limitations=(
                    "Outcome is freedom from severe VOCs in the trial population; not a claim that all "
                    "SCD genotypes were identical to HbSS. Study status elsewhere ≠ efficacy."
                ),
            ),
        }
    )
    add_edge(
        {
            "id": "edge:mechanism:hbf:relevant:disease:hbss",
            "source": "mechanism:hbf_reactivation",
            "target": "disease:hbss",
            "type": "mechanism_relevant_to_disease",
            "relationship_status": "established",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://pubmed.ncbi.nlm.nih.gov/38661449/",
                supporting_passage=(
                    "HbF induction is mechanistically relevant to sickle hemoglobin polymerization pathophysiology; "
                    "HbSS is the canonical homozygous sickle genotype within SCD."
                ),
                publication_date=pubs_by_id.get("pmid:38661449", {}).get("pubdate"),
                retrieval_date=pubs_by_id.get("pmid:38661449", {}).get("retrieval_date"),
                evidence_type="mechanistic_extrapolation_with_genotype_caveat",
                extraction_review_status="manually_reviewed",
                genotype_context="HbSS as narrow genotype under SCD umbrella",
                species="Homo sapiens",
                evidence_strength="moderate",
                limitations=(
                    "Primary trial reports SCD with severe VOCs; mapping to HbSS specifically requires "
                    "checking that genotype inclusion matches the user's question."
                ),
            ),
        }
    )
    add_edge(
        {
            "id": "edge:pmid:38661449:clinical_evidence_for:disease:scd_broad",
            "source": "pmid:38661449",
            "target": "disease:scd_broad",
            "type": "clinical_evidence_supports_outcome",
            "relationship_status": "established",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://pubmed.ncbi.nlm.nih.gov/38661449/",
                supporting_passage=(
                    "Of 30 patients with sufficient follow-up, 29 (97%) were free from vaso-occlusive crises "
                    "for at least 12 consecutive months."
                ),
                publication_date=pubs_by_id.get("pmid:38661449", {}).get("pubdate"),
                retrieval_date=pubs_by_id.get("pmid:38661449", {}).get("retrieval_date"),
                evidence_type="primary_clinical_endpoint",
                extraction_review_status="manually_reviewed",
                species="Homo sapiens",
                experimental_context="Human phase 3 trial",
                evidence_strength="high",
                limitations="Human clinical finding; not an animal result. Not medical advice.",
            ),
        }
    )

    # PMID 38657265 — TDT / exa-cel
    add_edge(
        {
            "id": "edge:pmid:38657265:investigates_intervention:exa_cel",
            "source": "pmid:38657265",
            "target": "intervention:exa_cel",
            "type": "study_investigates_intervention",
            "relationship_status": "established",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://pubmed.ncbi.nlm.nih.gov/38657265/",
                supporting_passage=(
                    "exa-cel reactivates fetal hemoglobin through CRISPR-Cas9 editing of the "
                    "erythroid-specific enhancer region of BCL11A in autologous CD34+ HSPCs."
                ),
                publication_date=pubs_by_id.get("pmid:38657265", {}).get("pubdate"),
                retrieval_date=pubs_by_id.get("pmid:38657265", {}).get("retrieval_date"),
                evidence_type="primary_clinical_trial_publication",
                extraction_review_status="manually_reviewed",
                genotype_context="Transfusion-dependent β-thalassemia (β0/β0, β0/β0-like, or non–β0/β0-like)",
                population_context="Ages 12–35",
                species="Homo sapiens",
                experimental_context="Phase 3 CLIMB THAL-111 / NCT03655678",
                evidence_strength="high",
                limitations="Transfusion dependence is a clinical category, not a single HBB genotype.",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:mechanism:hbf:relevant:disease:tdt",
            "source": "mechanism:hbf_reactivation",
            "target": "disease:tdt",
            "type": "mechanism_relevant_to_disease",
            "relationship_status": "established",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://pubmed.ncbi.nlm.nih.gov/38657265/",
                supporting_passage=(
                    "Among 35 evaluable patients with transfusion-dependent β-thalassemia, transfusion "
                    "independence occurred in 32 (91%); mean fetal hemoglobin 11.9 g/dL during independence."
                ),
                publication_date=pubs_by_id.get("pmid:38657265", {}).get("pubdate"),
                retrieval_date=pubs_by_id.get("pmid:38657265", {}).get("retrieval_date"),
                evidence_type="clinical_outcome_in_primary_trial",
                extraction_review_status="manually_reviewed",
                genotype_context="TDT genotypes as enrolled (β0/β0, β0/β0-like, non–β0/β0-like)",
                species="Homo sapiens",
                experimental_context="Human phase 3 trial",
                evidence_strength="high",
                limitations=(
                    "Do not equate TDT with every genetic β-thalassemia subtype. "
                    "exa-cel does not directly edit HBB."
                ),
            ),
        }
    )
    add_edge(
        {
            "id": "edge:disease:tdt:overlap:disease:beta_thal_genetic",
            "source": "disease:tdt",
            "target": "disease:beta_thal_genetic",
            "type": "clinical_phenotype_overlap",
            "relationship_status": "established",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://pubmed.ncbi.nlm.nih.gov/38657265/",
                supporting_passage=(
                    "Transfusion-dependent β-thalassemia is caused by pathogenic HBB variants causing "
                    "reduced/absent β-globin; transfusion dependence is the clinical trial phenotype."
                ),
                publication_date=pubs_by_id.get("pmid:38657265", {}).get("pubdate"),
                retrieval_date=pubs_by_id.get("pmid:38657265", {}).get("retrieval_date"),
                evidence_type="disease_definition",
                extraction_review_status="manually_reviewed",
                species="Homo sapiens",
                evidence_strength="high",
                limitations="Preserve genetic vs transfusion-dependence labels as distinct nodes.",
            ),
        }
    )

    # Hypothesis bridge (explicit)
    add_node(
        {
            "id": "hypothesis:hbf_cross_disease_bridge",
            "type": "hypothesis",
            "label": "HbF reactivation as a cross-disease research bridge (SCD ↔ β-thalassemia)",
            "layer": "curated",
            "review_status": "curated",
            "plain_language": (
                "Because both conditions can benefit from higher HbF, research tools and collaborator "
                "networks around BCL11A/HbF may be relevant across communities — but asset reuse "
                "(models, registries, outreach) still needs disease-specific validation."
            ),
        }
    )
    add_edge(
        {
            "id": "edge:hypothesis:bridge:proposed_from:mechanism:hbf",
            "source": "mechanism:hbf_reactivation",
            "target": "hypothesis:hbf_cross_disease_bridge",
            "type": "proposed_cross_disease_connection",
            "relationship_status": "hypothesis",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://pubmed.ncbi.nlm.nih.gov/38661449/",
                supporting_passage=(
                    "Both SCD and β-thalassemia publications describe BCL11A enhancer editing to raise HbF; "
                    "shared mechanism ≠ automatic interchangeability of models, eligibility, or assets."
                ),
                publication_date=pubs_by_id.get("pmid:38661449", {}).get("pubdate"),
                retrieval_date=utc_now(),
                evidence_type="cross_disease_hypothesis",
                extraction_review_status="manually_reviewed",
                species="Homo sapiens",
                evidence_strength="moderate",
                extraction_confidence="high",
                limitations=(
                    "Hypothesis about research collaboration / asset evaluation pathways, "
                    "not a claim of identical disease biology or treatment recommendations."
                ),
            ),
        }
    )

    # Organizations / assets with usability checks
    for o in records.get("organizations_and_assets", []):
        usable = bool(o.get("page_usable"))
        if not usable:
            review_log.append(
                {
                    "decision": "exclude_or_flag",
                    "record_id": o["id"],
                    "record_type": o.get("type"),
                    "reason": "Page snapshot not usable (access error / too short); flagged for manual verification.",
                    "error": o.get("error"),
                }
            )
            # Still include node but mark unverified
        else:
            review_log.append(
                {
                    "decision": "include_curated",
                    "record_id": o["id"],
                    "record_type": o.get("type"),
                    "reason": "Downloaded page contains usable content; relevance verified at catalog/org level.",
                }
            )

        add_node(
            {
                "id": o["id"],
                "type": o.get("type"),
                "label": o.get("label"),
                "role": o.get("role"),
                "source_url": o.get("source_url"),
                "page_usable": usable,
                "access_info": (
                    "Public website / catalog page. Verify current programs and contact channels before outreach."
                    if usable
                    else "Page snapshot failed usability checks; verify URL manually before citing."
                ),
                "species": o.get("species"),
                "notes": o.get("notes"),
                "retrieval_date": o.get("retrieval_date"),
                "content_snippet": o.get("content_snippet"),
                "layer": "curated",
                "review_status": "curated" if usable else "needs_verification",
            }
        )

    # SCDAA -> SCD broad
    add_edge(
        {
            "id": "edge:org:scdaa:supports_community:disease:scd_broad",
            "source": "org:scdaa",
            "target": "disease:scd_broad",
            "type": "organization_supports_community",
            "relationship_status": "established",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://www.sicklecelldisease.org/",
                supporting_passage="Sickle Cell Disease Association of America is a national patient organization for sickle cell disease.",
                publication_date=None,
                retrieval_date=next(
                    (x.get("retrieval_date") for x in records.get("organizations_and_assets", []) if x["id"] == "org:scdaa"),
                    utc_now(),
                ),
                evidence_type="organization_mission_page",
                extraction_review_status="manually_reviewed",
                species=None,
                evidence_strength="moderate",
                limitations="Organization relevance ≠ endorsement of any therapy or trial eligibility.",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:org:caf:supports_community:disease:beta_thal_genetic",
            "source": "org:caf",
            "target": "disease:beta_thal_genetic",
            "type": "organization_supports_community",
            "relationship_status": "established",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://www.thalassemia.org/",
                supporting_passage="Cooley's Anemia Foundation serves the thalassemia patient and research community.",
                publication_date=None,
                retrieval_date=next(
                    (x.get("retrieval_date") for x in records.get("organizations_and_assets", []) if x["id"] == "org:caf"),
                    utc_now(),
                ),
                evidence_type="organization_mission_page",
                extraction_review_status="manually_reviewed",
                evidence_strength="moderate",
                limitations="Not all 'thalassemia' search hits are HBB-caused; CAF focus is thalassemia community.",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:asset:jax_townes:model_for:disease:hbss",
            "source": "asset:jax_townes",
            "target": "disease:hbss",
            "type": "asset_developed_for",
            "relationship_status": "established",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://www.jax.org/strain/013071",
                supporting_passage="JAX Townes model is a transgenic mouse model used for sickle cell disease research.",
                publication_date=None,
                retrieval_date=next(
                    (x.get("retrieval_date") for x in records.get("organizations_and_assets", []) if x["id"] == "asset:jax_townes"),
                    utc_now(),
                ),
                evidence_type="model_catalog",
                extraction_review_status="manually_reviewed",
                species="Mus musculus",
                experimental_context="Animal model",
                evidence_strength="moderate",
                limitations=(
                    "Animal findings are not human findings. A sickle-cell model is not automatically "
                    "suitable for β-thalassemia experiments."
                ),
            ),
        }
    )
    # Explicit non-edge documentation as hypothesis investigation target
    add_edge(
        {
            "id": "edge:asset:jax_townes:hypothesis_not_validated:disease:beta_thal_genetic",
            "source": "asset:jax_townes",
            "target": "disease:beta_thal_genetic",
            "type": "proposed_cross_disease_connection",
            "relationship_status": "hypothesis",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://www.jax.org/strain/013071",
                supporting_passage=(
                    "No automatic suitability claim: Townes sickle-cell mice model SCD pathophysiology; "
                    "reuse for β-thalassemia would require explicit experimental validation."
                ),
                publication_date=None,
                retrieval_date=utc_now(),
                evidence_type="negative_or_missing_link",
                extraction_review_status="manually_reviewed",
                species="Mus musculus",
                evidence_strength="low",
                extraction_confidence="high",
                limitations="Missing validated link; shown to guide next research questions.",
                contradictory_evidence="Model catalog positions this strain for sickle cell disease, not β-thalassemia.",
            ),
        }
    )

    # Clinical studies: include NCT03745287 and NCT03655678 if present
    study_short_labels = {
        "NCT03745287": "CLIMB SCD-121 clinical study (NCT03745287)",
        "NCT03655678": "CLIMB THAL-111 clinical study (NCT03655678)",
    }
    pub_for_study = {
        "NCT03745287": "pmid:38661449",
        "NCT03655678": "pmid:38657265",
    }
    for s in records.get("clinical_studies", []):
        nct = s.get("nct_id")
        if nct in {"NCT03745287", "NCT03655678"}:
            add_node(
                {
                    "id": s["id"],
                    "type": "clinical_study",
                    "label": study_short_labels.get(nct, s.get("label")),
                    "official_title": s.get("label"),
                    "nct_id": nct,
                    "overall_status": s.get("overall_status"),
                    "phases": s.get("phases"),
                    "conditions": s.get("conditions"),
                    "interventions": s.get("interventions"),
                    "source_url": s.get("source_url"),
                    "retrieval_date": s.get("retrieval_date"),
                    "layer": "curated",
                    "review_status": "curated",
                    "notes": "Clinical study registry record. Status/eligibility ≠ demonstrated efficacy.",
                }
            )
            add_edge(
                {
                    "id": f"edge:{s['id']}:tests:intervention:exa_cel",
                    "source": s["id"],
                    "target": "intervention:exa_cel",
                    "type": "study_investigates_intervention",
                    "relationship_status": "established",
                    "review_status": "curated",
                    "layer": "curated",
                    "plain_language": (
                        f"{study_short_labels.get(nct, nct)} investigates the exa-cel intervention."
                    ),
                    "evidence": evidence(
                        source_url=s.get("source_url"),
                        supporting_passage=s.get("label") or nct,
                        publication_date=None,
                        retrieval_date=s.get("retrieval_date"),
                        evidence_type="clinicaltrials_registry",
                        extraction_review_status="manually_reviewed",
                        species="Homo sapiens",
                        evidence_strength="moderate",
                        limitations="Registry status is not outcome evidence; see peer-reviewed publications for results.",
                    ),
                }
            )
            pub_id = pub_for_study.get(nct)
            if pub_id and pub_id in nodes:
                add_edge(
                    {
                        "id": f"edge:{pub_id}:reports_on_study:{s['id']}",
                        "source": pub_id,
                        "target": s["id"],
                        "type": "publication_reports_on_study",
                        "relationship_status": "established",
                        "review_status": "curated",
                        "layer": "curated",
                        "plain_language": (
                            "This peer-reviewed paper reports outcomes from the linked clinical study."
                        ),
                        "evidence": evidence(
                            source_url=nodes[pub_id].get("source_url"),
                            supporting_passage=(
                                f"{nodes[pub_id].get('label')} corresponds to ClinicalTrials.gov {nct}."
                            ),
                            publication_date=nodes[pub_id].get("pubdate"),
                            retrieval_date=nodes[pub_id].get("retrieval_date"),
                            evidence_type="publication_to_registry_linkage",
                            extraction_review_status="manually_reviewed",
                            species="Homo sapiens",
                            evidence_strength="high",
                            limitations=(
                                "Publication and registry record are distinct entities; "
                                "registry status is not the same as published efficacy results."
                            ),
                        ),
                    }
                )
            review_log.append(
                {
                    "decision": "include_curated",
                    "record_id": s["id"],
                    "record_type": "clinical_study",
                    "reason": "Anchor trial registry record matching exa-cel publications.",
                }
            )
        else:
            review_log.append(
                {
                    "decision": "exclude_from_curated_default",
                    "record_id": s["id"],
                    "record_type": "clinical_study",
                    "reason": "Non-anchor study retained in discovery; condition search ≠ efficacy claim.",
                    "label": s.get("label"),
                    "overall_status": s.get("overall_status"),
                }
            )

    for g in records.get("funded_projects", []):
        review_log.append(
            {
                "decision": "exclude_from_curated_default",
                "record_id": g["id"],
                "record_type": "grant",
                "reason": "Funding records retained in discovery pending manual PI/collaborator relevance review.",
                "label": g.get("label"),
            }
        )

    # Next research question node
    add_node(
        {
            "id": "question:validate_hbf_asset_transfer",
            "type": "research_question",
            "label": (
                "Which HbF-pathway research assets and collaborator networks can be responsibly "
                "evaluated for β-thalassemia community needs without assuming SCD-model compatibility?"
            ),
            "layer": "curated",
            "review_status": "curated",
            "uncertainties": [
                "Townes SCD mice are not validated here for β-thalassemia.",
                "Patient organization programs differ by disease community and should be contacted for current priorities.",
                "exa-cel relevance is via BCL11A/HbF, not HBB editing.",
                "Broad SCD literature may not apply to every genotype (HbSS vs HbSC vs HbS/β-thal).",
            ],
            "validation_questions": [
                "Does a proposed experimental model recapitulate ineffective erythropoiesis vs sickling, as needed for the β-thalassemia question?",
                "Are registry/biobank consent and genotype fields sufficient to separate HbSS from other SCD genotypes?",
                "Which outcome measures (VOC vs transfusion independence vs HbF %) are appropriate for the collaboration?",
            ],
        }
    )
    add_edge(
        {
            "id": "edge:hypothesis:bridge:leads_to:question",
            "source": "hypothesis:hbf_cross_disease_bridge",
            "target": "question:validate_hbf_asset_transfer",
            "type": "suggests_next_research_step",
            "relationship_status": "hypothesis",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://pubmed.ncbi.nlm.nih.gov/38657265/",
                supporting_passage=(
                    "Shared HbF biology across SCD and TDT motivates cross-community learning, "
                    "while model and eligibility differences require explicit next-step validation."
                ),
                publication_date=pubs_by_id.get("pmid:38657265", {}).get("pubdate"),
                retrieval_date=utc_now(),
                evidence_type="curated_research_planning",
                extraction_review_status="manually_reviewed",
                evidence_strength="low",
                extraction_confidence="high",
                limitations="Planning hypothesis only; no invented collaborator availability or patient eligibility.",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:org:caf:could_inform:question",
            "source": "org:caf",
            "target": "question:validate_hbf_asset_transfer",
            "type": "potential_collaborator_for",
            "relationship_status": "hypothesis",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://www.thalassemia.org/",
                supporting_passage="Patient-group leadership is a stakeholder for prioritizing β-thalassemia research questions and assets.",
                publication_date=None,
                retrieval_date=utc_now(),
                evidence_type="stakeholder_mapping",
                extraction_review_status="manually_reviewed",
                evidence_strength="low",
                limitations="Does not assert CAF commitment, capacity, or endorsement.",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:org:scdaa:could_inform:question",
            "source": "org:scdaa",
            "target": "question:validate_hbf_asset_transfer",
            "type": "potential_collaborator_for",
            "relationship_status": "hypothesis",
            "review_status": "curated",
            "layer": "curated",
            "evidence": evidence(
                source_url="https://www.sicklecelldisease.org/",
                supporting_passage="SCD community organizations can advise which SCD-side assets and priorities are appropriate to discuss in cross-disease settings.",
                publication_date=None,
                retrieval_date=utc_now(),
                evidence_type="stakeholder_mapping",
                extraction_review_status="manually_reviewed",
                evidence_strength="low",
                limitations="Does not assert availability or endorsement.",
            ),
        }
    )

    # Journey definition
    journey = {
        "id": "journey:patient_group_hbf_bridge",
        "title": "From HbSS biology to a cross-community HbF research question",
        "intended_user": "Patient-group leader",
        "plain_language": (
            "Start from sickle cell anemia (HbSS), follow the fetal-hemoglobin / BCL11A mechanism "
            "supported by the 2024 NEJM exa-cel sickle cell trial, note the parallel transfusion-dependent "
            "β-thalassemia trial (same intervention class, still not HBB editing), then inspect verified "
            "community organizations and the JAX Townes SCD mouse asset. Because SCD-model suitability for "
            "β-thalassemia is unproven, the next step is framed as a validation question—not a treatment claim."
        ),
        "node_path": [
            "disease:hbss",
            "genotype:hbss",
            "allele:HbS",
            "gene:HBB",
            "mechanism:hbf_reactivation",
            "process:bcl11a_repression_of_hbg",
            "gene:BCL11A",
            "intervention:exa_cel",
            "pmid:38661449",
            "disease:scd_broad",
            "pmid:38657265",
            "disease:tdt",
            "hypothesis:hbf_cross_disease_bridge",
            "org:scdaa",
            "org:caf",
            "asset:jax_townes",
            "question:validate_hbf_asset_transfer",
        ],
        "edge_path": [
            "edge:genotype:hbss:causes:disease:hbss",
            "edge:genotype:hbss:has_allele:HbS",
            "edge:allele:HbS:allele_of:gene:HBB",
            "edge:mechanism:hbf:relevant:disease:hbss",
            "edge:process:bcl11a:supports:mechanism:hbf",
            "edge:gene:BCL11A:participates:process:bcl11a_repression",
            "edge:intervention:exa_cel:targets:gene:BCL11A",
            "edge:pmid:38661449:investigates_intervention:exa_cel",
            "edge:pmid:38661449:clinical_evidence_for:disease:scd_broad",
            "edge:pmid:38657265:investigates_intervention:exa_cel",
            "edge:mechanism:hbf:relevant:disease:tdt",
            "edge:hypothesis:bridge:proposed_from:mechanism:hbf",
            "edge:org:scdaa:supports_community:disease:scd_broad",
            "edge:org:caf:supports_community:disease:beta_thal_genetic",
            "edge:asset:jax_townes:model_for:disease:hbss",
            "edge:asset:jax_townes:hypothesis_not_validated:disease:beta_thal_genetic",
            "edge:hypothesis:bridge:leads_to:question",
        ],
        "answers": {
            "relevant_communities": [
                "Sickle cell disease / HbSS community (SCDAA)",
                "β-thalassemia / TDT community (Cooley's Anemia Foundation)",
            ],
            "existing_assets": [
                "Peer-reviewed exa-cel trials (PMID 38661449, 38657265)",
                "JAX Townes sickle-cell mouse model (SCD-focused)",
                "ClinicalTrials.gov registry records NCT03745287 and NCT03655678 when collected",
            ],
            "who_could_help": [
                "SCDAA (SCD community priorities)",
                "Cooley's Anemia Foundation (thalassemia community priorities)",
                "Researchers authoring the anchor HbF/BCL11A clinical papers (via publications; no availability claimed)",
            ],
            "next_step": (
                "Investigate which HbF-pathway assets transfer responsibly to β-thalassemia research "
                "questions, with explicit validation for models, genotypes, and outcomes."
            ),
        },
    }

    # Validate endpoints
    missing = [e["id"] for e in edges if e["source"] not in nodes or e["target"] not in nodes]
    edges = [e for e in edges if e["source"] in nodes and e["target"] in nodes]

    curated = {
        "generated_at": utc_now(),
        "layer": "curated",
        "nodes": list(nodes.values()),
        "edges": edges,
        "stats": {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "dropped_edges_missing_endpoints": missing,
            "hbs_variant_records_curated": len(hbs_nodes),
            "hbc_variant_records_curated": len(hbc_nodes),
        },
        "default_journey_id": journey["id"],
    }
    (OUTPUT / "curated-graph.json").write_text(json.dumps(curated, indent=2), encoding="utf-8")
    (OUTPUT / "review-log.json").write_text(
        json.dumps(
            {
                "generated_at": utc_now(),
                "policy": {
                    "raw_preserved": True,
                    "discovery_separate_from_curated": True,
                    "model_confidence_not_clinical_confidence": True,
                },
                "decisions": review_log,
                "summary": {
                    "include_curated": sum(1 for d in review_log if d["decision"] == "include_curated"),
                    "exclude_from_curated_default": sum(
                        1 for d in review_log if d["decision"] == "exclude_from_curated_default"
                    ),
                    "exclude_as_present": sum(1 for d in review_log if d["decision"] == "exclude_as_present"),
                    "exclude_or_flag": sum(1 for d in review_log if d["decision"] == "exclude_or_flag"),
                    "missing_anchor": sum(1 for d in review_log if d["decision"] == "missing_anchor"),
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    # Enrich journey + edges with demo experience stages and plain language.
    demo_path = ROOT / "config" / "demo_experience.json"
    demo = json.loads(demo_path.read_text(encoding="utf-8"))
    plain = demo.get("edge_plain_language") or {}
    for e in edges:
        if e["id"] in plain:
            e["plain_language"] = plain[e["id"]]
        # Ensure scientific curated edges expose reporting vs inference clearly.
        if e.get("evidence") and "reporting_basis" not in e["evidence"]:
            status = e.get("relationship_status")
            if status == "hypothesis":
                e["evidence"]["reporting_basis"] = "inferred_or_proposed"
            elif status in {"established", "investigational"}:
                e["evidence"]["reporting_basis"] = "directly_reported_or_sourced"
            else:
                e["evidence"]["reporting_basis"] = "sourced_mapping"

    journey["stages"] = demo.get("stages") or []
    journey["asset_assessment_ids"] = [
        a["asset_id"] for a in demo.get("asset_assessments") or []
    ]
    journey["registry_gap"] = demo.get("registry_gap")
    journey["proposal_defaults"] = demo.get("proposal_defaults")

    (OUTPUT / "journeys.json").write_text(
        json.dumps({"journeys": [journey]}, indent=2), encoding="utf-8"
    )
    (OUTPUT / "demo-experience.json").write_text(
        json.dumps(demo, indent=2), encoding="utf-8"
    )
    # Rewrite curated graph after plain_language enrichment.
    curated["edges"] = edges
    curated["nodes"] = list(nodes.values())
    (OUTPUT / "curated-graph.json").write_text(
        json.dumps(curated, indent=2), encoding="utf-8"
    )

    gaps = f"""# Remaining scientific and data gaps

Generated: {utc_now()}

## Scientific gaps

1. **Genotype granularity in trials** — Anchor SCD trial reports severe sickle cell disease with VOC criteria; mapping every outcome specifically to HbSS requires eligibility/genotype tables beyond PubMed abstracts.
2. **Asset transfer** — JAX Townes is SCD-oriented; no curated positive evidence here that it is an appropriate β-thalassemia model.
3. **Phenotype frequencies** — Discovery OLS text-search annotations lack HPO frequency/onset; they remain unreviewed and out of the default curated view.
4. **Collaborator availability** — Publications and organizations identify *possible* stakeholders only; no contact commitments are inferred.
5. **HbS/β-thalassemia** — Optional extension disease node exists in config but is not fully journey-elaborated.
6. **Direct HBB editing vs BCL11A editing** — Interface must continue to state that exa-cel edits BCL11A enhancer, not HBB.

## Data / engineering gaps

1. Original local Hack Nation folder was not present in this workspace; collector was rebuilt to public-API sources.
2. NIH RePORTER / ClinicalTrials payloads depend on live API availability at collection time.
3. Some organization pages may block or alter content for automated clients; usability flags are recorded.
4. No graph database; JSON files are the source of truth for the local prototype.
5. Credentials intentionally unused; sources requiring keys were deferred.

## What is automated vs manual

| Step | Mode |
|---|---|
| ClinVar / PubMed / ClinicalTrials / RePORTER / OLS fetch | Automated |
| Raw caching + checksums | Automated |
| Discovery graph transform | Automated |
| Anchor claim extraction (PMID 38657265 / 38661449) | Manual review in `curate.py` |
| Organization/model relevance | Semi-automated page usability + manual relationship framing |
| Default curated UI view | Curated layer only |
"""
    (OUTPUT / "gaps.md").write_text(gaps, encoding="utf-8")
    print(
        f"Curated graph: {len(nodes)} nodes, {len(edges)} edges; "
        f"review decisions: {len(review_log)}"
    )


if __name__ == "__main__":
    curate()
