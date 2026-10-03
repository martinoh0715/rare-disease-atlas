#!/usr/bin/env python3
"""Regression checks for HBB baseline + ARID1B extension."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def search_entries(entries, query: str) -> list[dict]:
    q = query.strip().lower()
    hits = []
    for e in entries:
        label = e["label"].lower()
        syns = [s.lower() for s in e.get("synonyms", [])]
        if label == q or q in syns:
            hits.append(e)
        elif label.startswith(q) or any(s.startswith(q) for s in syns):
            hits.append(e)
        elif q in label or any(q in s for s in syns):
            hits.append(e)
    return hits


def check_dataset(dataset_id: str, required_searches: list[str], required_nodes: list[str]) -> list[str]:
    errors: list[str] = []
    base = ROOT / "public" / "data" / dataset_id
    curated = load(base / "curated-graph.json")
    demo = load(base / "demo-experience.json")
    journeys = load(base / "journeys.json")
    nodes = {n["id"]: n for n in curated["nodes"]}
    edges = {e["id"]: e for e in curated["edges"]}

    for nid in required_nodes:
        if nid not in nodes:
            errors.append(f"[{dataset_id}] missing node {nid}")

    for q in required_searches:
        hits = search_entries(demo["search_entries"], q)
        if not hits:
            errors.append(f"[{dataset_id}] search miss for '{q}'")

    for stage in demo["stages"]:
        for nid in stage["node_ids"]:
            if nid not in nodes:
                errors.append(f"[{dataset_id}] stage {stage['id']} missing node {nid}")
        for eid in stage["edge_ids"]:
            if eid not in edges:
                errors.append(f"[{dataset_id}] stage {stage['id']} missing edge {eid}")
            else:
                e = edges[eid]
                if e.get("layer") == "curated" and e.get("type") in {
                    "mechanism_relevant_to_disease",
                    "organization_supports_community",
                    "asset_developed_for",
                    "study_investigates_intervention",
                    "clinical_evidence_supports_outcome",
                }:
                    if not (e.get("evidence") or {}).get("source_url"):
                        errors.append(f"[{dataset_id}] edge {eid} missing source_url")

    journey = journeys["journeys"][0]
    for nid in journey["node_path"]:
        if nid not in nodes:
            errors.append(f"[{dataset_id}] journey missing node {nid}")
    for eid in journey["edge_path"]:
        if eid not in edges:
            errors.append(f"[{dataset_id}] journey missing edge {eid}")

    # Proposal defaults present
    for key in ("research_question", "proposed_next_step"):
        if not demo.get("proposal_defaults", {}).get(key):
            errors.append(f"[{dataset_id}] missing proposal_defaults.{key}")

    if not demo.get("asset_assessments"):
        errors.append(f"[{dataset_id}] missing asset_assessments")

    return errors


def main() -> int:
    errors: list[str] = []

    catalog = load(ROOT / "public" / "data" / "catalog.json")
    ids = {d["id"] for d in catalog["datasets"]}
    if ids != {"hbb", "arid1b"}:
        errors.append(f"catalog datasets unexpected: {sorted(ids)}")

    # Validate scripts
    for script in [
        ["python3", str(ROOT / "research/hbb/validate.py")],
        ["python3", str(ROOT / "research/arid1b/validate.py")],
    ]:
        proc = subprocess.run(script, capture_output=True, text=True)
        if proc.returncode != 0:
            errors.append(f"validate failed: {' '.join(script)}\n{proc.stdout}\n{proc.stderr}")

    errors.extend(
        check_dataset(
            "hbb",
            required_searches=[
                "sickle cell anemia",
                "HbSS",
                "beta-thalassemia",
                "HBB",
                "c.20A>T",
                "HbF",
            ],
            required_nodes=[
                "disease:hbss",
                "gene:HBB",
                "allele:HbS",
                "mechanism:hbf_reactivation",
                "intervention:exa_cel",
                "org:caf",
                "asset:jax_townes",
            ],
        )
    )
    errors.extend(
        check_dataset(
            "arid1b",
            required_searches=[
                "ARID1B",
                "Coffin-Siris",
                "ARID1B-RD",
                "haploinsufficiency",
                "FAR",
                "CARE4ARID1B",
            ],
            required_nodes=[
                "disease:arid1b_rd",
                "disease:css1",
                "disease:arid1b_id",
                "gene:ARID1B",
                "mechanism:arid1b_haploinsufficiency",
                "org:far",
                "study:care4arid1b",
                "question:arid1b_endpoint_readiness",
            ],
        )
    )

    # Datasets must remain separate
    hbb_nodes = {n["id"] for n in load(ROOT / "public/data/hbb/curated-graph.json")["nodes"]}
    arid_nodes = {n["id"] for n in load(ROOT / "public/data/arid1b/curated-graph.json")["nodes"]}
    if "gene:ARID1B" in hbb_nodes:
        errors.append("HBB curated graph unexpectedly contains gene:ARID1B")
    if "gene:HBB" in arid_nodes:
        errors.append("ARID1B curated graph unexpectedly contains gene:HBB")

    # Baseline size floor for HBB
    hbb = load(ROOT / "public/data/hbb/curated-graph.json")
    if len(hbb["nodes"]) < 30 or len(hbb["edges"]) < 40:
        errors.append(
            f"HBB curated graph shrank unexpectedly: nodes={len(hbb['nodes'])} edges={len(hbb['edges'])}"
        )

    # Review log statuses for ARID1B
    review = load(ROOT / "public/data/arid1b/review-log.json")
    statuses = {r["status"] for r in review}
    for needed in ("accepted", "rejected", "unresolved"):
        if needed not in statuses:
            errors.append(f"ARID1B review-log missing {needed}")

    if errors:
        print("REGRESSION FAILED")
        for e in errors:
            print(" -", e)
        return 1

    print("REGRESSION OK")
    print("HBB and ARID1B search/graph/evidence/resource/proposal fixtures validated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
