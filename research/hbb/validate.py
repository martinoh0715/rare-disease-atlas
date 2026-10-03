#!/usr/bin/env python3
"""Validate curated graph integrity checks required by the brief."""

from __future__ import annotations

import json
import sys
from pathlib import Path

OUTPUT = Path(__file__).resolve().parent / "output"


def main() -> int:
    curated = json.loads((OUTPUT / "curated-graph.json").read_text())
    journeys = json.loads((OUTPUT / "journeys.json").read_text())
    nodes = {n["id"]: n for n in curated["nodes"]}
    edges = curated["edges"]
    errors: list[str] = []

    for e in edges:
        if e["source"] not in nodes:
            errors.append(f"missing source endpoint: {e['id']} -> {e['source']}")
        if e["target"] not in nodes:
            errors.append(f"missing target endpoint: {e['id']} -> {e['target']}")
        ev = e.get("evidence")
        if e.get("review_status") == "curated" and e.get("type") not in {
            "encodes",
            "narrower_than",
            "related_but_distinct_from",
            "clinical_category_of",
            "clinical_phenotype_overlap",
            "source_reports_association",
            "allele_of",
            "genotype_includes_allele",
            "genotype_defines",
            "variant_of",
            "clinvar_record_for_allele",
            "awarded_to",
        }:
            # Scientific edges should carry evidence objects when curated claims.
            if e.get("layer") == "curated" and e.get("type") in {
                "study_investigates_intervention",
                "intervention_targets",
                "gene_participates_in_process",
                "experiment_supports_mechanism",
                "mechanism_relevant_to_disease",
                "clinical_evidence_supports_outcome",
                "proposed_cross_disease_connection",
                "organization_supports_community",
                "asset_developed_for",
                "suggests_next_research_step",
                "potential_collaborator_for",
            }:
                if not ev or not ev.get("source_url"):
                    errors.append(f"curated scientific edge missing source_url: {e['id']}")

        # Negated phenotypes must not appear as present associations
        if e.get("type") == "source_reports_association" and (
            e.get("negated") or (ev or {}).get("negated")
        ):
            errors.append(f"negated phenotype displayed as present: {e['id']}")

    # Canonical alleles
    for allele_id, hgvs in {
        "allele:HbS": "HBB:c.20A>T",
        "allele:HbC": "HBB:c.19G>A",
    }.items():
        n = nodes.get(allele_id)
        if not n:
            errors.append(f"missing allele node {allele_id}")
        elif n.get("hgvs_c") != hgvs:
            errors.append(f"{allele_id} hgvs mismatch: {n.get('hgvs_c')}")

    if "clinvar:15333" not in nodes or nodes["clinvar:15333"].get("canonical_allele") != "HbS":
        errors.append("canonical HbS ClinVar record not correctly identified")
    if "clinvar:15126" not in nodes or nodes["clinvar:15126"].get("canonical_allele") != "HbC":
        errors.append("canonical HbC ClinVar record not correctly identified")

    # Genotype / trait separation
    if nodes.get("disease:sct", {}).get("label", "").lower().find("trait") < 0:
        errors.append("sickle cell trait node missing or mislabeled")
    if "genotype:hbss" not in nodes or "genotype:hbas_trait" not in nodes:
        errors.append("HbSS genotype and trait genotype must both exist")

    # Journey integrity
    journey = journeys["journeys"][0]
    for nid in journey["node_path"]:
        if nid not in nodes:
            errors.append(f"journey node missing from curated graph: {nid}")
    edge_ids = {e["id"] for e in edges}
    for eid in journey["edge_path"]:
        if eid not in edge_ids:
            errors.append(f"journey edge missing from curated graph: {eid}")

    # Animal vs human distinction present on model edge
    model_edges = [
        e
        for e in edges
        if e["source"] == "asset:jax_townes" and e["type"] == "asset_developed_for"
    ]
    if not model_edges:
        errors.append("missing JAX Townes asset_developed_for edge")
    else:
        species = (model_edges[0].get("evidence") or {}).get("species")
        if species != "Mus musculus":
            errors.append("Townes model edge missing mouse species context")

    # exa-cel does not edit HBB claim present
    intervention = nodes.get("intervention:exa_cel")
    if not intervention or "HBB" not in (intervention.get("does_not") or ""):
        errors.append("exa-cel node must explicitly state it does not directly edit HBB")

    if errors:
        print("VALIDATION FAILED")
        for err in errors:
            print(" -", err)
        return 1

    print("VALIDATION OK")
    print(
        f"nodes={len(nodes)} edges={len(edges)} journey_steps={len(journey['node_path'])}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
