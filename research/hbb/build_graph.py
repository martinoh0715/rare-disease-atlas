#!/usr/bin/env python3
"""Transform collected records into a discovery graph (pre-curation)."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "output"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def add_node(nodes: dict[str, dict[str, Any]], node: dict[str, Any]) -> None:
    nid = node["id"]
    if nid in nodes:
        # Merge labels conservatively
        existing = nodes[nid]
        for k, v in node.items():
            if k not in existing or existing[k] in (None, "", [], {}):
                existing[k] = v
        return
    nodes[nid] = node


def add_edge(edges: list[dict[str, Any]], edge: dict[str, Any]) -> None:
    edges.append(edge)


def infer_variant_tags(label: str) -> dict[str, Any]:
    tags: dict[str, Any] = {}
    lower = label.lower()
    if "glu6val" in lower or "e6v" in lower or "p.glu7val" in lower or "hb s" in lower or "hbs" in lower:
        tags["canonical_allele"] = "HbS"
    if "glu6lys" in lower or "e6k" in lower or "p.glu7lys" in lower or "hb c" in lower or "hbc" in lower:
        tags["canonical_allele"] = tags.get("canonical_allele", "HbC")
        if "HbS" in tags.get("canonical_allele", ""):
            pass
        else:
            tags["canonical_allele"] = "HbC"
    if re.search(r"\btrait\b", lower):
        tags["carrier_state_mention"] = True
    return tags


def build() -> dict[str, Any]:
    records = json.loads((OUTPUT / "records.json").read_text(encoding="utf-8"))
    diseases_cfg = records.get("focus", {})
    nodes: dict[str, dict[str, Any]] = {}
    edges: list[dict[str, Any]] = []

    # Core gene / protein
    add_node(
        nodes,
        {
            "id": "gene:HBB",
            "type": "gene",
            "label": "HBB",
            "full_name": "hemoglobin subunit beta",
            "review_status": "curated",
        },
    )
    add_node(
        nodes,
        {
            "id": "protein:HBB",
            "type": "protein",
            "label": "β-globin",
            "encoded_by": "gene:HBB",
            "review_status": "curated",
        },
    )
    add_edge(
        edges,
        {
            "id": "edge:gene:HBB:encodes:protein:HBB",
            "source": "gene:HBB",
            "target": "protein:HBB",
            "type": "encodes",
            "evidence_type": "authoritative_nomenclature",
            "relationship_status": "established",
            "review_status": "curated",
        },
    )

    # Diseases from config
    for d in diseases_cfg.get("diseases", []):
        add_node(
            nodes,
            {
                "id": d["id"],
                "type": "disease",
                "label": d["label"],
                "mondo": d.get("mondo"),
                "orphanet": d.get("orphanet"),
                "omim": d.get("omim"),
                "genotype_scope": d.get("genotype_scope"),
                "clinical_category": d.get("clinical_category"),
                "notes": d.get("notes"),
                "status": d.get("status", "in_scope"),
                "review_status": "curated",
            },
        )
        # Link HBB to genetic diseases (association reported by nosology / genetics)
        if d["id"] in {
            "disease:hbss",
            "disease:beta_thal_genetic",
            "disease:beta_thal_major",
            "disease:hbs_beta_thal",
            "disease:scd_broad",
            "disease:sct",
            "disease:tdt",
            "disease:beta_thal_intermedia",
        }:
            add_edge(
                edges,
                {
                    "id": f"edge:gene:HBB:associated_with:{d['id']}",
                    "source": "gene:HBB",
                    "target": d["id"],
                    "type": "source_reports_association",
                    "evidence_type": "disease_gene_nosology",
                    "relationship_status": "established"
                    if d["id"]
                    in {
                        "disease:hbss",
                        "disease:beta_thal_genetic",
                        "disease:scd_broad",
                        "disease:sct",
                        "disease:hbs_beta_thal",
                    }
                    else "broad_mapping",
                    "review_status": "curated",
                    "limitations": d.get("notes"),
                },
            )

    # Hierarchy-ish mappings (preserve broad/narrow)
    hierarchy = [
        ("disease:hbss", "disease:scd_broad", "narrower_than"),
        ("disease:sct", "disease:scd_broad", "related_but_distinct_from"),
        ("disease:beta_thal_major", "disease:beta_thal_genetic", "clinical_category_of"),
        ("disease:beta_thal_intermedia", "disease:beta_thal_genetic", "clinical_category_of"),
        ("disease:tdt", "disease:beta_thal_genetic", "clinical_phenotype_overlap"),
        ("disease:hbs_beta_thal", "disease:scd_broad", "narrower_than"),
    ]
    for src, tgt, etype in hierarchy:
        add_edge(
            edges,
            {
                "id": f"edge:{src}:{etype}:{tgt}",
                "source": src,
                "target": tgt,
                "type": etype,
                "evidence_type": "disease_ontology_mapping",
                "relationship_status": "established",
                "review_status": "curated",
                "limitations": "Preserves broad/narrow distinctions; not a merge.",
            },
        )

    # Mechanism nodes (skeleton; curation strengthens evidence)
    add_node(
        nodes,
        {
            "id": "mechanism:hbf_reactivation",
            "type": "mechanism",
            "label": "Fetal hemoglobin (HbF) reactivation",
            "review_status": "discovery",
        },
    )
    add_node(
        nodes,
        {
            "id": "gene:BCL11A",
            "type": "gene",
            "label": "BCL11A",
            "full_name": "BAF chromatin remodeling complex subunit BCL11A",
            "review_status": "curated",
        },
    )
    add_node(
        nodes,
        {
            "id": "process:bcl11a_repression_of_hbg",
            "type": "biological_process",
            "label": "BCL11A-mediated repression of γ-globin (HBG1/HBG2)",
            "review_status": "discovery",
        },
    )

    # Variants
    for v in records.get("variants", []):
        tags = infer_variant_tags(v.get("label") or "")
        node = {
            "id": v["id"],
            "type": "variant",
            "label": v.get("label"),
            "accession": v.get("accession"),
            "clinical_significance": v.get("clinical_significance"),
            "clinvar_review_status": v.get("review_status"),
            "gene": "gene:HBB",
            "source_url": v.get("source_url"),
            "retrieval_date": v.get("retrieval_date"),
            "review_status": "discovery",
            **tags,
        }
        add_node(nodes, node)
        add_edge(
            edges,
            {
                "id": f"edge:{v['id']}:variant_of:gene:HBB",
                "source": v["id"],
                "target": "gene:HBB",
                "type": "variant_of",
                "evidence_type": "clinvar_gene_annotation",
                "relationship_status": "established",
                "review_status": "discovery",
                "source_url": v.get("source_url"),
                "retrieval_date": v.get("retrieval_date"),
            },
        )
        # Do NOT auto-assign aggregate pathogenicity to every listed condition.
        trait_set = (v.get("raw_fields") or {}).get("trait_set") or []
        if isinstance(trait_set, list):
            for trait in trait_set[:5]:
                if not isinstance(trait, dict):
                    continue
                trait_name = trait.get("trait_name") or trait.get("disease_name")
                if not trait_name:
                    continue
                # Mentions only
                add_edge(
                    edges,
                    {
                        "id": f"edge:{v['id']}:clinvar_mentions_trait:{hash(trait_name) & 0xffffffff:x}",
                        "source": v["id"],
                        "target": "gene:HBB",
                        "type": "source_mentions",
                        "evidence_type": "clinvar_trait_listing",
                        "relationship_status": "mention",
                        "review_status": "discovery",
                        "supporting_passage": f"ClinVar trait listing: {trait_name}",
                        "source_url": v.get("source_url"),
                        "limitations": (
                            "Trait listing on a variant summary is not an aggregate "
                            "classification applied to every condition."
                        ),
                        "clinvar_significance": v.get("clinical_significance"),
                        "clinvar_review_status": v.get("review_status"),
                    },
                )

    # Publications
    for p in records.get("publications", []):
        add_node(
            nodes,
            {
                "id": p["id"],
                "type": "publication",
                "label": p.get("label"),
                "pmid": p.get("pmid"),
                "journal": p.get("journal"),
                "pubdate": p.get("pubdate"),
                "authors": p.get("authors"),
                "source_url": p.get("source_url"),
                "retrieval_date": p.get("retrieval_date"),
                "is_anchor": p.get("is_anchor", False),
                "review_status": "curated" if p.get("is_anchor") else "discovery",
            },
        )
        # Mentions gene (search-derived; not causal claim)
        add_edge(
            edges,
            {
                "id": f"edge:{p['id']}:mentions:gene:HBB",
                "source": p["id"],
                "target": "gene:HBB",
                "type": "publication_mentions",
                "evidence_type": "literature_retrieval",
                "relationship_status": "mention",
                "review_status": "discovery",
                "source_url": p.get("source_url"),
                "publication_date": p.get("pubdate"),
                "retrieval_date": p.get("retrieval_date"),
                "limitations": "Search match is not a causal or treatment claim.",
            },
        )

    # Clinical studies
    for s in records.get("clinical_studies", []):
        add_node(
            nodes,
            {
                "id": s["id"],
                "type": "clinical_study",
                "label": s.get("label"),
                "nct_id": s.get("nct_id"),
                "overall_status": s.get("overall_status"),
                "phases": s.get("phases"),
                "conditions": s.get("conditions"),
                "interventions": s.get("interventions"),
                "source_url": s.get("source_url"),
                "retrieval_date": s.get("retrieval_date"),
                "review_status": "discovery",
                "notes": s.get("notes"),
            },
        )
        cond_text = " ".join(s.get("conditions") or []).lower()
        targets = []
        if "sickle" in cond_text:
            targets.append("disease:scd_broad")
        if "thalassemia" in cond_text or "thalassaemia" in cond_text:
            targets.append("disease:tdt" if "transfusion" in cond_text else "disease:beta_thal_genetic")
        for tgt in targets:
            add_edge(
                edges,
                {
                    "id": f"edge:{s['id']}:investigates:{tgt}",
                    "source": s["id"],
                    "target": tgt,
                    "type": "study_investigates",
                    "evidence_type": "clinicaltrials_condition",
                    "relationship_status": "investigational",
                    "review_status": "discovery",
                    "source_url": s.get("source_url"),
                    "retrieval_date": s.get("retrieval_date"),
                    "limitations": (
                        "Condition listing indicates investigation scope, not demonstrated efficacy. "
                        "Broad SCD listing does not imply HbSS-only applicability."
                    ),
                },
            )

    # Grants
    for g in records.get("funded_projects", []):
        add_node(
            nodes,
            {
                "id": g["id"],
                "type": "grant",
                "label": g.get("label"),
                "project_num": g.get("project_num"),
                "organization": g.get("organization"),
                "principal_investigators": g.get("principal_investigators"),
                "fiscal_year": g.get("fiscal_year"),
                "source_url": g.get("source_url"),
                "retrieval_date": g.get("retrieval_date"),
                "review_status": "discovery",
            },
        )
        if g.get("organization"):
            org_id = "institution:" + re.sub(r"[^a-z0-9]+", "_", g["organization"].lower())[:60]
            add_node(
                nodes,
                {
                    "id": org_id,
                    "type": "institution",
                    "label": g["organization"],
                    "review_status": "discovery",
                },
            )
            add_edge(
                edges,
                {
                    "id": f"edge:{g['id']}:awarded_to:{org_id}",
                    "source": g["id"],
                    "target": org_id,
                    "type": "awarded_to",
                    "evidence_type": "nih_reporter",
                    "relationship_status": "established",
                    "review_status": "discovery",
                    "source_url": g.get("source_url"),
                },
            )

    # Phenotypes
    for ph in records.get("phenotype_annotations", []):
        if ph.get("type") != "phenotype_annotation":
            continue
        hpo = ph.get("hpo_id") or ph["id"]
        ph_node_id = f"phenotype:{hpo}"
        add_node(
            nodes,
            {
                "id": ph_node_id,
                "type": "phenotype",
                "label": ph.get("label"),
                "hpo_id": hpo,
                "review_status": "discovery",
            },
        )
        disease_local = ph.get("disease_local_id")
        if disease_local and not ph.get("negated"):
            add_edge(
                edges,
                {
                    "id": f"edge:{disease_local}:annot:{ph['id']}",
                    "source": disease_local,
                    "target": ph_node_id,
                    "type": "source_reports_association",
                    "evidence_type": "ontology_text_search",
                    "relationship_status": "discovery",
                    "review_status": "discovery_unreviewed",
                    "frequency": ph.get("frequency"),
                    "onset": ph.get("onset"),
                    "negated": False,
                    "source_url": ph.get("source_url"),
                    "retrieval_date": ph.get("retrieval_date"),
                    "extraction_confidence": "low",
                    "evidence_strength": "unreviewed",
                    "limitations": ph.get("limitations"),
                    "disease_scope": ph.get("disease_label"),
                },
            )
        elif ph.get("negated"):
            # Explicitly do not create a positive association edge.
            add_edge(
                edges,
                {
                    "id": f"edge:negated:{ph['id']}",
                    "source": disease_local or "gene:HBB",
                    "target": ph_node_id,
                    "type": "phenotype_explicitly_negated",
                    "evidence_type": "source_negation",
                    "relationship_status": "negated",
                    "review_status": "discovery",
                    "negated": True,
                    "limitations": "Negated phenotypes must not be displayed as present.",
                },
            )

    # Organizations / assets
    for o in records.get("organizations_and_assets", []):
        add_node(
            nodes,
            {
                "id": o["id"],
                "type": o.get("type"),
                "label": o.get("label"),
                "role": o.get("role"),
                "source_url": o.get("source_url"),
                "page_usable": o.get("page_usable"),
                "content_snippet": o.get("content_snippet"),
                "species": o.get("species"),
                "notes": o.get("notes"),
                "retrieval_date": o.get("retrieval_date"),
                "review_status": "discovery",
            },
        )
        for d_id in o.get("disease_relevance") or []:
            add_edge(
                edges,
                {
                    "id": f"edge:{o['id']}:relevant_to:{d_id}",
                    "source": o["id"],
                    "target": d_id,
                    "type": "organization_relevant_to"
                    if o.get("type") == "organization"
                    else "asset_developed_for",
                    "evidence_type": "organization_page_or_catalog",
                    "relationship_status": "established" if o.get("page_usable") else "unverified_page",
                    "review_status": "discovery",
                    "source_url": o.get("source_url"),
                    "retrieval_date": o.get("retrieval_date"),
                    "limitations": o.get("notes")
                    or (
                        None
                        if o.get("page_usable")
                        else "Downloaded page may be an access-error stub; verify before outreach."
                    ),
                },
            )

    # Validate endpoints
    missing = []
    valid_edges = []
    for e in edges:
        if e["source"] not in nodes or e["target"] not in nodes:
            missing.append(e["id"])
        else:
            valid_edges.append(e)

    graph = {
        "generated_at": utc_now(),
        "layer": "discovery",
        "nodes": list(nodes.values()),
        "edges": valid_edges,
        "stats": {
            "node_count": len(nodes),
            "edge_count": len(valid_edges),
            "dropped_edges_missing_endpoints": missing,
        },
    }
    (OUTPUT / "graph.json").write_text(json.dumps(graph, indent=2), encoding="utf-8")

    with (OUTPUT / "nodes.jsonl").open("w", encoding="utf-8") as nf:
        for n in nodes.values():
            nf.write(json.dumps(n) + "\n")
    with (OUTPUT / "edges.jsonl").open("w", encoding="utf-8") as ef:
        for e in valid_edges:
            ef.write(json.dumps(e) + "\n")

    print(
        f"Wrote discovery graph: {len(nodes)} nodes, {len(valid_edges)} edges "
        f"({len(missing)} dropped)"
    )
    return graph


if __name__ == "__main__":
    build()
