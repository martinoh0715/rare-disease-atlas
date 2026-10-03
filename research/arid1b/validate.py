#!/usr/bin/env python3
"""Validate ARID1B curated graph integrity."""

from __future__ import annotations

import json
import sys
from pathlib import Path

OUTPUT = Path(__file__).resolve().parent / "output"


def main() -> int:
    curated = json.loads((OUTPUT / "curated-graph.json").read_text())
    journeys = json.loads((OUTPUT / "journeys.json").read_text())
    demo = json.loads((OUTPUT / "demo-experience.json").read_text())
    review = json.loads((OUTPUT / "review-log.json").read_text())
    nodes = {n["id"]: n for n in curated["nodes"]}
    edges = curated["edges"]
    errors: list[str] = []

    for e in edges:
        if e["source"] not in nodes:
            errors.append(f"missing source endpoint: {e['id']} -> {e['source']}")
        if e["target"] not in nodes:
            errors.append(f"missing target endpoint: {e['id']} -> {e['target']}")
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
        }:
            ev = e.get("evidence") or {}
            if not ev.get("source_url"):
                errors.append(f"curated scientific edge missing source_url: {e['id']}")
            if not ev.get("supporting_passage"):
                errors.append(f"curated scientific edge missing supporting_passage: {e['id']}")

    for required in [
        "disease:arid1b_rd",
        "disease:css1",
        "disease:arid1b_id",
        "gene:ARID1B",
        "mechanism:arid1b_haploinsufficiency",
        "org:far",
        "study:care4arid1b",
        "question:arid1b_endpoint_readiness",
    ]:
        if required not in nodes:
            errors.append(f"missing required node {required}")

    # Distinct clinical framings must not be collapsed
    if nodes.get("disease:css1", {}).get("label") == nodes.get("disease:arid1b_id", {}).get(
        "label"
    ):
        errors.append("CSS1 and nonsyndromic ID labels must remain distinct")

    # No HBB cross-cluster contamination
    for n in curated["nodes"]:
        if n["id"].startswith("disease:hbss") or n["id"].startswith("gene:HBB"):
            errors.append(f"unexpected HBB node in ARID1B curated graph: {n['id']}")

    journey = journeys["journeys"][0]
    edge_ids = {e["id"] for e in edges}
    for nid in journey["node_path"]:
        if nid not in nodes:
            errors.append(f"journey node missing: {nid}")
    for eid in journey["edge_path"]:
        if eid not in edge_ids:
            errors.append(f"journey edge missing: {eid}")

    for stage in demo["stages"]:
        for nid in stage["node_ids"]:
            if nid not in nodes:
                errors.append(f"stage {stage['id']} missing node {nid}")
        for eid in stage["edge_ids"]:
            if eid not in edge_ids:
                errors.append(f"stage {stage['id']} missing edge {eid}")

    statuses = {r["status"] for r in review}
    for needed in {"accepted", "rejected", "unresolved"}:
        if needed not in statuses:
            errors.append(f"review-log missing status={needed}")

    if any(r.get("expert_reviewed") for r in review):
        errors.append("review-log must not claim expert_reviewed=true for this prototype")

    if errors:
        print("VALIDATION FAILED")
        for err in errors:
            print(" -", err)
        return 1

    print("VALIDATION OK")
    print(f"nodes={len(nodes)} edges={len(edges)} review_entries={len(review)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
