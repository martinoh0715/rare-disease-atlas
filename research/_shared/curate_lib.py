"""Shared helpers for gene-centered curated dataset builds."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def evidence(
    *,
    source_url: str,
    supporting_passage: str,
    publication_date: str | None,
    evidence_type: str,
    retrieval_date: str,
    extraction_review_status: str = "curator_verified_from_public_source",
    genotype_context: str | None = None,
    population_context: str | None = None,
    species: str | None = "Homo sapiens",
    experimental_context: str | None = None,
    extraction_confidence: str = "high",
    evidence_strength: str = "moderate",
    limitations: str | None = None,
    contradictory_evidence: str | None = None,
    reporting_basis: str | None = None,
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
        "reporting_basis": reporting_basis,
    }


class GraphBuilder:
    def __init__(self, retrieval_date: str):
        self.retrieval_date = retrieval_date
        self.nodes: dict[str, dict[str, Any]] = {}
        self.edges: list[dict[str, Any]] = []
        self.review_log: list[dict[str, Any]] = []

    def add_node(self, n: dict[str, Any]) -> None:
        n.setdefault("layer", "curated")
        n.setdefault("review_status", "curated")
        self.nodes[n["id"]] = n

    def add_edge(self, e: dict[str, Any]) -> None:
        e.setdefault("layer", "curated")
        e.setdefault("review_status", "curated")
        e.setdefault("relationship_status", "established")
        self.edges.append(e)

    def log(
        self,
        decision: str,
        claim: str,
        *,
        reason: str,
        sources: list[str] | None = None,
        status: str = "accepted",
    ) -> None:
        self.review_log.append(
            {
                "decision": decision,
                "status": status,
                "claim": claim,
                "reason": reason,
                "sources": sources or [],
                "reviewed_at": self.retrieval_date,
                "reviewer_role": "curator_public_source_check",
                "expert_reviewed": False,
            }
        )

    def ev(self, **kwargs: Any) -> dict[str, Any]:
        return evidence(retrieval_date=self.retrieval_date, **kwargs)


def write_outputs(
    output: Path,
    *,
    dataset_id: str,
    focus_gene: str,
    builder: GraphBuilder,
    journey: dict[str, Any],
    demo: dict[str, Any],
    gaps: str,
    summary: str,
) -> None:
    output.mkdir(parents=True, exist_ok=True)
    curated = {
        "generated_at": utc_now(),
        "layer": "curated",
        "dataset_id": dataset_id,
        "focus_gene": focus_gene,
        "nodes": list(builder.nodes.values()),
        "edges": builder.edges,
        "stats": {"nodes": len(builder.nodes), "edges": len(builder.edges)},
        "default_journey_id": journey["id"],
        "journey_status": demo.get("journey_status"),
    }
    discovery = {
        "generated_at": utc_now(),
        "layer": "discovery",
        "dataset_id": dataset_id,
        "nodes": list(builder.nodes.values())
        + [
            {
                "id": f"discovery:unreviewed_{dataset_id}_hit",
                "type": "publication",
                "label": "Unreviewed literature search placeholder",
                "layer": "discovery",
                "review_status": "discovery",
                "notes": "Placeholder only — not curated evidence.",
            }
        ],
        "edges": builder.edges,
        "stats": {
            "nodes": len(builder.nodes) + 1,
            "edges": len(builder.edges),
            "note": "Discovery stub; curated layer is authoritative for the UI.",
        },
    }
    (output / "curated-graph.json").write_text(
        json.dumps(curated, indent=2) + "\n", encoding="utf-8"
    )
    (output / "graph.json").write_text(json.dumps(discovery, indent=2) + "\n", encoding="utf-8")
    (output / "journeys.json").write_text(
        json.dumps({"journeys": [journey]}, indent=2) + "\n", encoding="utf-8"
    )
    (output / "demo-experience.json").write_text(
        json.dumps(demo, indent=2) + "\n", encoding="utf-8"
    )
    (output / "review-log.json").write_text(
        json.dumps(builder.review_log, indent=2) + "\n", encoding="utf-8"
    )
    (output / "gaps.md").write_text(gaps, encoding="utf-8")
    (output / "collection-summary.md").write_text(summary, encoding="utf-8")
    (output / "quality-report.json").write_text(
        json.dumps(
            {
                "dataset_id": dataset_id,
                "generated_at": utc_now(),
                "nodes": len(builder.nodes),
                "edges": len(builder.edges),
                "edges_with_source_url": sum(
                    1 for e in builder.edges if (e.get("evidence") or {}).get("source_url")
                ),
                "journey_status": demo.get("journey_status"),
                "expert_reviewed": False,
                "private_patient_data": False,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def default_legend() -> list[dict[str, str]]:
    return [
        {"id": "disease", "label": "Diseases", "color": "#1d4ed8"},
        {"id": "gene_variant", "label": "Genes & variants", "color": "#0f766e"},
        {"id": "mechanism", "label": "Mechanisms & processes", "color": "#b45309"},
        {"id": "intervention", "label": "Interventions", "color": "#be123c"},
        {"id": "study", "label": "Clinical studies", "color": "#7c3aed"},
        {"id": "publication", "label": "Publications", "color": "#0e7490"},
        {"id": "organization_asset", "label": "Organizations & assets", "color": "#ea580c"},
        {"id": "phenotype", "label": "Phenotypes", "color": "#57534e"},
    ]


def validate_dataset(output: Path, required_nodes: list[str]) -> list[str]:
    errors: list[str] = []
    curated = json.loads((output / "curated-graph.json").read_text())
    journeys = json.loads((output / "journeys.json").read_text())
    demo = json.loads((output / "demo-experience.json").read_text())
    review = json.loads((output / "review-log.json").read_text())
    nodes = {n["id"]: n for n in curated["nodes"]}
    edges = {e["id"]: e for e in curated["edges"]}
    for nid in required_nodes:
        if nid not in nodes:
            errors.append(f"missing required node {nid}")
    for e in curated["edges"]:
        if e["source"] not in nodes or e["target"] not in nodes:
            errors.append(f"edge endpoints missing: {e['id']}")
        if e.get("layer") == "curated" and e.get("type") in {
            "mechanism_relevant_to_disease",
            "gene_participates_in_process",
            "experiment_supports_mechanism",
            "organization_supports_community",
            "asset_developed_for",
            "study_investigates_intervention",
            "clinical_evidence_supports_outcome",
            "suggests_next_research_step",
            "potential_collaborator_for",
            "source_reports_association",
            "intervention_targets",
        }:
            ev = e.get("evidence") or {}
            if not ev.get("source_url"):
                errors.append(f"missing source_url: {e['id']}")
            if not ev.get("supporting_passage"):
                errors.append(f"missing supporting_passage: {e['id']}")
    journey = journeys["journeys"][0]
    for nid in journey["node_path"]:
        if nid not in nodes:
            errors.append(f"journey missing node {nid}")
    for eid in journey["edge_path"]:
        if eid not in edges:
            errors.append(f"journey missing edge {eid}")
    for stage in demo["stages"]:
        for nid in stage["node_ids"]:
            if nid not in nodes:
                errors.append(f"stage {stage['id']} missing node {nid}")
        for eid in stage["edge_ids"]:
            if eid not in edges:
                errors.append(f"stage {stage['id']} missing edge {eid}")
    statuses = {r["status"] for r in review}
    for needed in ("accepted", "rejected", "unresolved"):
        if needed not in statuses:
            errors.append(f"review-log missing {needed}")
    if any(r.get("expert_reviewed") for r in review):
        errors.append("review-log must not claim expert_reviewed=true")
    focus = curated.get("focus_gene")
    foreign_genes = {
        "gene:HBB",
        "gene:ARID1B",
        "gene:GATA6",
        "gene:ODC1",
        "disease:hbss",
    }
    self_gene = f"gene:{focus}" if focus else None
    for nid in foreign_genes:
        if nid in nodes and nid != self_gene:
            errors.append(f"unexpected foreign node {nid}")
    return errors
