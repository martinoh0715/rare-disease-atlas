#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _shared.curate_lib import validate_dataset

OUTPUT = Path(__file__).resolve().parent / "output"
REQUIRED = [
    "disease:gata6_spectrum",
    "disease:hdca_gata6",
    "gene:GATA6",
    "mechanism:gata6_haploinsufficiency",
    "allele:GATA6_p.Arg493Ter",
    "asset:uchicago_monogenic_diabetes_registry",
    "gap:gata6_dedicated_patient_org",
    "question:gata6_partner_and_natural_history_gap",
]


def main() -> int:
    errors = validate_dataset(OUTPUT, REQUIRED)
    if errors:
        print("VALIDATION FAILED")
        for e in errors:
            print(" -", e)
        return 1
    print("VALIDATION OK (gata6)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
