#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _shared.curate_lib import validate_dataset

OUTPUT = Path(__file__).resolve().parent / "output"
REQUIRED = [
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
]


def main() -> int:
    errors = validate_dataset(OUTPUT, REQUIRED)
    # Extra: DFMO must state not approved for BABS
    import json

    nodes = {
        n["id"]: n
        for n in json.loads((OUTPUT / "curated-graph.json").read_text())["nodes"]
    }
    dfmo = nodes.get("intervention:dfmo_eflornithine_investigational", {})
    if "FDA-approved" not in (dfmo.get("does_not") or "") and "not" not in (
        dfmo.get("does_not") or ""
    ).lower():
        errors.append("DFMO node must explicitly deny BABS approval claim in does_not")
    if errors:
        print("VALIDATION FAILED")
        for e in errors:
            print(" -", e)
        return 1
    print("VALIDATION OK (odc1)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
