#!/usr/bin/env python3
"""Regression checks for all curated gene-centered datasets."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {"hbb", "arid1b", "gata6", "odc1"}


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


def check_dataset(
    dataset_id: str,
    required_searches: list[str],
    required_nodes: list[str],
    *,
    journey_status: str | None = None,
) -> list[str]:
    errors: list[str] = []
    base = ROOT / "public" / "data" / dataset_id
    curated = load(base / "curated-graph.json")
    demo = load(base / "demo-experience.json")
    journeys = load(base / "journeys.json")
    review = load(base / "review-log.json")
    nodes = {n["id"]: n for n in curated["nodes"]}
    edges = {e["id"]: e for e in curated["edges"]}

    for nid in required_nodes:
        if nid not in nodes:
            errors.append(f"[{dataset_id}] missing node {nid}")

    for q in required_searches:
        if not search_entries(demo["search_entries"], q):
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

    for key in ("research_question", "proposed_next_step"):
        if not demo.get("proposal_defaults", {}).get(key):
            errors.append(f"[{dataset_id}] missing proposal_defaults.{key}")

    if not demo.get("asset_assessments"):
        errors.append(f"[{dataset_id}] missing asset_assessments")

    if journey_status and demo.get("journey_status") != journey_status:
        errors.append(
            f"[{dataset_id}] journey_status expected {journey_status}, got {demo.get('journey_status')}"
        )

    if isinstance(review, list):
        statuses = {r.get("status") for r in review}
        for needed in ("accepted", "rejected", "unresolved"):
            if needed not in statuses:
                errors.append(f"[{dataset_id}] review-log missing {needed}")
    elif isinstance(review, dict):
        decisions = review.get("decisions") or []
        if not decisions and not review.get("policy"):
            errors.append(f"[{dataset_id}] review-log missing decisions")

    return errors


def main() -> int:
    errors: list[str] = []
    catalog = load(ROOT / "public" / "data" / "catalog.json")
    ids = {d["id"] for d in catalog["datasets"]}
    if ids != EXPECTED:
        errors.append(f"catalog datasets unexpected: {sorted(ids)}")

    for script in [
        ROOT / "research/hbb/validate.py",
        ROOT / "research/arid1b/validate.py",
        ROOT / "research/gata6/validate.py",
        ROOT / "research/odc1/validate.py",
    ]:
        proc = subprocess.run(["python3", str(script)], capture_output=True, text=True)
        if proc.returncode != 0:
            errors.append(f"validate failed: {script}\n{proc.stdout}\n{proc.stderr}")

    errors.extend(
        check_dataset(
            "hbb",
            ["sickle cell anemia", "HbSS", "beta-thalassemia", "HBB", "c.20A>T", "HbF"],
            [
                "disease:hbss",
                "gene:HBB",
                "allele:HbS",
                "mechanism:hbf_reactivation",
                "intervention:exa_cel",
                "org:caf",
                "asset:jax_townes",
                "registry:scdic",
            ],
            journey_status="partial",
        )
    )
    errors.extend(
        check_dataset(
            "arid1b",
            ["ARID1B", "Coffin-Siris", "ARID1B-RD", "haploinsufficiency", "FAR", "CARE4ARID1B"],
            [
                "disease:arid1b_rd",
                "disease:css1",
                "gene:ARID1B",
                "mechanism:arid1b_haploinsufficiency",
                "org:far",
                "study:care4arid1b",
                "question:arid1b_endpoint_readiness",
            ],
            journey_status="complete",
        )
    )
    errors.extend(
        check_dataset(
            "gata6",
            ["GATA6", "pancreatic agenesis", "neonatal diabetes", "haploinsufficiency"],
            [
                "disease:gata6_spectrum",
                "disease:hdca_gata6",
                "gene:GATA6",
                "mechanism:gata6_haploinsufficiency",
                "allele:GATA6_p.Arg493Ter",
                "asset:uchicago_monogenic_diabetes_registry",
                "gap:gata6_dedicated_patient_org",
                "question:gata6_partner_and_natural_history_gap",
            ],
            journey_status="partial",
        )
    )
    errors.extend(
        check_dataset(
            "odc1",
            ["Bachmann-Bupp", "ODC1", "DFMO", "gain-of-function"],
            [
                "disease:babs",
                "disease:odc1_lof_unresolved",
                "gene:ODC1",
                "mechanism:odc1_c_terminal_gof",
                "allele:ODC1_p.Lys448Ter",
                "allele:ODC1_p.Gly84Arg",
                "intervention:dfmo_eflornithine_investigational",
                "asset:icpd",
                "org:nord_babs",
                "question:odc1_dfmo_evidence_and_lof_gap",
            ],
            journey_status="complete",
        )
    )

    graphs = {
        ds: {n["id"] for n in load(ROOT / "public/data" / ds / "curated-graph.json")["nodes"]}
        for ds in EXPECTED
    }
    for ds, nodes in graphs.items():
        for other in EXPECTED - {ds}:
            gene = f"gene:{other.upper() if other != 'arid1b' else 'ARID1B'}"
            # map ids to gene symbols
    gene_map = {
        "hbb": "gene:HBB",
        "arid1b": "gene:ARID1B",
        "gata6": "gene:GATA6",
        "odc1": "gene:ODC1",
    }
    for ds, nodes in graphs.items():
        for other, gene in gene_map.items():
            if other == ds:
                continue
            if gene in nodes:
                errors.append(f"{ds} unexpectedly contains {gene}")

    hbb = load(ROOT / "public/data/hbb/curated-graph.json")
    if len(hbb["nodes"]) < 30 or len(hbb["edges"]) < 40:
        errors.append(
            f"HBB curated graph shrank unexpectedly: nodes={len(hbb['nodes'])} edges={len(hbb['edges'])}"
        )

    # ODC1 must not claim DFMO approval
    odc_demo = load(ROOT / "public/data/odc1/demo-experience.json")
    if "investigational" not in odc_demo["proposal_defaults"]["research_question"].lower() and \
       "dfmo" not in odc_demo["proposal_defaults"]["research_question"].lower():
        errors.append("ODC1 proposal defaults should mention DFMO evidence question")
    odc_nodes = {
        n["id"]: n for n in load(ROOT / "public/data/odc1/curated-graph.json")["nodes"]
    }
    does_not = (odc_nodes.get("intervention:dfmo_eflornithine_investigational") or {}).get(
        "does_not", ""
    )
    if "FDA-approved" not in does_not and "approved" not in does_not.lower():
        errors.append("ODC1 DFMO node missing explicit non-approval language")

    if errors:
        print("REGRESSION FAILED")
        for e in errors:
            print(" -", e)
        return 1

    print("REGRESSION OK")
    print("HBB, ARID1B, GATA6, and ODC1 fixtures validated (search/graph/evidence/resources/proposal).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
