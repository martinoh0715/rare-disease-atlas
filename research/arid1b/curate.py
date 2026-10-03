#!/usr/bin/env python3
"""Build the curated ARID1B demonstration layer.

Produces curated-graph.json, demo-experience.json, journeys.json, review-log.json,
graph.json (discovery stub), gaps.md, and collection-summary.md.

Scientific edges carry source URLs and supporting passages. AI-assisted drafting
is not labeled expert-reviewed.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "output"
CONFIG = ROOT / "config"
RETRIEVAL_DATE = "2026-10-03"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def evidence(
    *,
    source_url: str,
    supporting_passage: str,
    publication_date: str | None,
    evidence_type: str,
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
        "retrieval_date": RETRIEVAL_DATE,
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


def curate() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    diseases = json.loads((CONFIG / "diseases.json").read_text(encoding="utf-8"))
    review_log: list[dict[str, Any]] = []
    nodes: dict[str, dict[str, Any]] = {}
    edges: list[dict[str, Any]] = []

    def add_node(n: dict[str, Any]) -> None:
        n.setdefault("layer", "curated")
        n.setdefault("review_status", "curated")
        nodes[n["id"]] = n

    def add_edge(e: dict[str, Any]) -> None:
        e.setdefault("layer", "curated")
        e.setdefault("review_status", "curated")
        # Missing relationship_status means unreviewed — never invent "established".
        edges.append(e)

    def log(
        decision: str,
        claim: str,
        *,
        reason: str,
        sources: list[str] | None = None,
        status: str = "accepted",
    ) -> None:
        review_log.append(
            {
                "decision": decision,
                "status": status,
                "claim": claim,
                "reason": reason,
                "sources": sources or [],
                "reviewed_at": RETRIEVAL_DATE,
                "reviewer_role": "curator_public_source_check",
                "expert_reviewed": False,
            }
        )

    # --- Core biology nodes ---
    add_node(
        {
            "id": "gene:ARID1B",
            "type": "gene",
            "label": "ARID1B",
            "full_name": "AT-rich interaction domain 1B",
            "chromosome": "6q25.3",
            "omim": "OMIM:614556",
            "plain_language": (
                "ARID1B encodes a subunit of the BAF (SWI/SNF) chromatin-remodeling "
                "complex important in neurodevelopment."
            ),
        }
    )
    add_node(
        {
            "id": "protein:ARID1B",
            "type": "protein",
            "label": "ARID1B protein (BAF250b)",
            "plain_language": "Protein product of ARID1B that participates in BAF complexes.",
        }
    )
    add_node(
        {
            "id": "disease:css1",
            "type": "disease",
            "label": "Coffin-Siris syndrome 1 (CSS1)",
            "mondo": "MONDO:0007617",
            "orphanet": "Orphanet:1465",
            "omim": "OMIM:135900",
            "genotype_scope": "Heterozygous pathogenic ARID1B variant with CSS clinical framing",
            "plain_language": (
                "A clinical CSS subtype linked to heterozygous ARID1B variants. "
                "Other BAF genes can also cause CSS — keep gene attributions separate."
            ),
        }
    )
    add_node(
        {
            "id": "disease:arid1b_rd",
            "type": "disease",
            "label": "ARID1B-related disorder (ARID1B-RD)",
            "plain_language": (
                "Gene-centered umbrella used by advocacy and natural-history programs "
                "for ARID1B presentations ranging from CSS-like to less syndromic ID."
            ),
            "notes": "Gene-centered collection ≠ automatic mechanistic disease cluster proof.",
        }
    )
    add_node(
        {
            "id": "disease:arid1b_id",
            "type": "disease",
            "label": "ARID1B-related nonsyndromic intellectual disability",
            "plain_language": (
                "Intellectual disability presentations with pathogenic ARID1B variants "
                "without classic CSS physical framing."
            ),
        }
    )
    add_node(
        {
            "id": "mechanism:arid1b_haploinsufficiency",
            "type": "mechanism",
            "label": "ARID1B haploinsufficiency",
            "plain_language": (
                "One functional gene copy is not enough for typical development. "
                "This is a disease-mechanism framing supported for heterozygous LoF "
                "patterns — not a claim that every predicted truncating variant has "
                "been experimentally proven loss-of-function in every tissue."
            ),
        }
    )
    add_node(
        {
            "id": "process:baf_chromatin_remodeling",
            "type": "biological_process",
            "label": "BAF (SWI/SNF) chromatin remodeling",
            "plain_language": (
                "Chromatin remodeling that helps control which genes are accessible "
                "during development."
            ),
        }
    )
    add_node(
        {
            "id": "phenotype:intellectual_disability",
            "type": "phenotype",
            "label": "Intellectual disability (variable severity)",
            "hpo": "HP:0001249",
            "plain_language": "Learning and adaptive challenges of variable degree across the ARID1B spectrum.",
        }
    )
    add_node(
        {
            "id": "phenotype:fifth_nail_hypoplasia",
            "type": "phenotype",
            "label": "Fifth-digit / nail hypoplasia (CSS hallmark, variable)",
            "hpo": "HP:0008398",
            "plain_language": (
                "Underdeveloped or absent fifth fingernails/toenails is a classic CSS "
                "feature, but not required for every ARID1B-RD presentation."
            ),
            "uncertainties": [
                "Not all ARID1B pathogenic-variant carriers show classic nail findings."
            ],
        }
    )
    add_node(
        {
            "id": "phenotype:speech_delay",
            "type": "phenotype",
            "label": "Speech delay / limited speech",
            "plain_language": "Common developmental feature; severity varies.",
        }
    )

    # Representative variants / genotypes
    add_node(
        {
            "id": "allele:ARID1B_p.Arg1225Ter",
            "type": "allele",
            "label": "ARID1B p.Arg1225Ter",
            "canonical_allele": "ARID1B_p.Arg1225Ter",
            "hgvs_c": "NM_001374828.1:c.3673C>T",
            "hgvs_p_modern": "p.Arg1225Ter",
            "reference_transcript": "NM_001374828.1",
            "clinical_significance": "Pathogenic (ClinVar aggregate context; check current record)",
            "clinvar_variation_id": "31210",
            "predicted_molecular_consequence": "nonsense / predicted LoF",
            "plain_language": (
                "Representative heterozygous nonsense allele used as an example. "
                "Predicted consequence is not the same as a measured functional assay."
            ),
        }
    )
    add_node(
        {
            "id": "allele:ARID1B_c.4479G>A",
            "type": "allele",
            "label": "ARID1B c.4479G>A (splice)",
            "hgvs_c": "NM_001374828.1:c.4479G>A",
            "hgvs_p_modern": "p.Pro1493= (coding appearance); splice-disrupting",
            "reference_transcript": "NM_001374828.1",
            "clinvar_variation_id": "210291",
            "predicted_molecular_consequence": "synonymous-looking coding change at splice donor",
            "experimentally_observed_effect": (
                "RNA studies report exon 17 skipping with frameshift/early termination"
            ),
            "clinical_significance": "Pathogenic (multi-submitter ClinVar context; verify current)",
            "plain_language": (
                "Example where predicted coding consequence (synonymous) differs from "
                "experimentally observed splicing effect."
            ),
        }
    )
    add_node(
        {
            "id": "clinvar:31210",
            "type": "variant",
            "label": "ClinVar VCV000031210 (c.3673C>T)",
            "clinvar_variation_id": "31210",
            "canonical_allele": "ARID1B_p.Arg1225Ter",
            "source_url": "https://www.ncbi.nlm.nih.gov/clinvar/variation/31210/",
        }
    )
    add_node(
        {
            "id": "clinvar:210291",
            "type": "variant",
            "label": "ClinVar VCV000210291 (c.4479G>A)",
            "clinvar_variation_id": "210291",
            "canonical_allele": "ARID1B_c.4479G>A",
            "source_url": "https://www.ncbi.nlm.nih.gov/clinvar/variation/210291/",
        }
    )
    add_node(
        {
            "id": "genotype:arid1b_het_lof",
            "type": "genotype",
            "label": "Heterozygous ARID1B LoF-class genotype (typical)",
            "genotype_scope": "One pathogenic ARID1B allele + one reference allele (typical de novo)",
            "plain_language": (
                "Typical disease-associated genotype context is heterozygous, often de novo — "
                "not an HBB-style homozygous recessive genotype."
            ),
        }
    )

    # Publications / studies / orgs / assets / question
    add_node(
        {
            "id": "pmid:31249371",
            "type": "publication",
            "label": "van der Sluijs et al. 2019 — ARID1B spectrum in 143 patients",
            "pmid": "31249371",
            "pubdate": "2019",
            "journal": "Genet Med",
            "source_url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC6752273/",
            "plain_language": (
                "Compares ARID1B-CSS and ARID1B-ID ascertainment; reports mostly "
                "frameshift/nonsense variants and de novo origin when parents tested."
            ),
        }
    )
    add_node(
        {
            "id": "pmid:22405089",
            "type": "publication",
            "label": "Hoyer et al. 2012 — ARID1B haploinsufficiency in ID",
            "pmid": "22405089",
            "pubdate": "2012",
            "journal": "Am J Hum Genet",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/22405089/",
            "plain_language": (
                "Early evidence linking de novo heterozygous ARID1B LoF-class variants "
                "to intellectual disability via haploinsufficiency."
            ),
        }
    )
    add_node(
        {
            "id": "study:care4arid1b",
            "type": "clinical_study",
            "label": "CARE4ARID1B natural history study",
            "overall_status": "Prospective multi-site natural history (public study description; verify enrollment status before citing as open/closed)",
            "plain_language": (
                "Multi-country prospective natural-history study aiming to define "
                "developmental trajectories and clinical endpoints for ARID1B-RD."
            ),
            "does_not": (
                "Does not claim an approved disease-modifying treatment; observational "
                "natural-history design per public description."
            ),
            "source_url": "http://care4arid1b.org/intro.html",
            "access_info": "Public study description pages; contact via study site channels. No participant-level data in this atlas.",
        }
    )
    add_node(
        {
            "id": "org:far",
            "type": "organization",
            "label": "Foundation for ARID1B Research (FAR)",
            "source_url": "https://www.arid1b.org/",
            "access_info": "Public website and contact email listed on site. Atlas does not contact anyone automatically.",
            "plain_language": "Parent-led foundation focused on ARID1B-RD research and translational collaboration.",
        }
    )
    add_node(
        {
            "id": "asset:care4arid1b_protocol",
            "type": "research_asset",
            "label": "CARE4ARID1B study design / endpoint framing",
            "species": "Homo sapiens",
            "plain_language": (
                "Publicly described natural-history design (assessments, biomarkers, "
                "endpoint goals) useful as a research-planning reference."
            ),
            "source_url": "http://care4arid1b.org/intro.html",
            "access_info": "Public protocol-level description only.",
        }
    )
    add_node(
        {
            "id": "hypothesis:arid1b_spectrum_modifiers",
            "type": "hypothesis",
            "label": "Phenotypic modifiers beyond ARID1B genotype (open)",
            "plain_language": (
                "Sources note variable expressivity and limited genotype–phenotype "
                "correlation — modifiers are plausible but not settled here."
            ),
            "relationship_status": "hypothesis",
        }
    )
    add_node(
        {
            "id": "question:arid1b_endpoint_readiness",
            "type": "research_question",
            "label": "Which natural-history endpoints are ready for interventional trial design in ARID1B-RD?",
            "plain_language": (
                "Concrete next question connecting biology and CARE4ARID1B goals to "
                "collaboration planning — not a treatment recommendation."
            ),
            "uncertainties": [
                "Adult natural-history data remain limited per advocacy sources",
                "Endpoint readiness may differ across CSS-like vs less syndromic presentations",
                "No approved disease-modifying therapy is asserted in this atlas",
            ],
            "validation_questions": [
                "Which CARE4ARID1B endpoints are sufficiently defined for a future interventional protocol discussion?",
                "How should CSS1 vs broader ARID1B-RD framing change eligibility language?",
            ],
        }
    )

    # --- Edges ---
    add_edge(
        {
            "id": "edge:gene:ARID1B:encodes:protein:ARID1B",
            "source": "gene:ARID1B",
            "target": "protein:ARID1B",
            "type": "encodes",
            "plain_language": "ARID1B encodes the ARID1B/BAF250b protein.",
            "evidence": evidence(
                source_url="https://www.ncbi.nlm.nih.gov/gene/57492",
                supporting_passage="ARID1B AT-rich interaction domain 1B [Homo sapiens (human)]",
                publication_date=None,
                evidence_type="structured_database",
                evidence_strength="strong",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:gene:ARID1B:participates:process:baf",
            "source": "gene:ARID1B",
            "target": "process:baf_chromatin_remodeling",
            "type": "gene_participates_in_process",
            "plain_language": "ARID1B is a BAF (SWI/SNF) complex subunit gene.",
            "evidence": evidence(
                source_url="https://search.clinicalgenome.org/kb/gene-dosage/HGNC:18040",
                supporting_passage=(
                    "ARID1B is a member of the SWItch/Sucrose NonFermenting (SWI/SNF) "
                    "chromatin-remodeling complex"
                ),
                publication_date=None,
                evidence_type="curated_gene_dosage_summary",
                evidence_strength="strong",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:process:baf:supports:mechanism:haploinsufficiency",
            "source": "process:baf_chromatin_remodeling",
            "target": "mechanism:arid1b_haploinsufficiency",
            "type": "experiment_supports_mechanism",
            "plain_language": (
                "BAF-complex dosage sensitivity frames why losing one ARID1B copy "
                "can disrupt developmental gene regulation."
            ),
            "evidence": evidence(
                source_url="https://search.clinicalgenome.org/kb/gene-dosage/HGNC:18040",
                supporting_passage="Haploinsufficiency: Sufficient Evidence for Haploinsufficiency (3)",
                publication_date=None,
                evidence_type="curated_gene_dosage_summary",
                evidence_strength="strong",
                limitations="Dosage curation summarizes many reports; not a single functional assay.",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:mechanism:haploinsufficiency:relevant:disease:arid1b_rd",
            "source": "mechanism:arid1b_haploinsufficiency",
            "target": "disease:arid1b_rd",
            "type": "mechanism_relevant_to_disease",
            "plain_language": "Haploinsufficiency is the primary disease-mechanism framing for ARID1B-RD.",
            "evidence": evidence(
                source_url="https://www.arid1b.org/arid1b",
                supporting_passage=(
                    "Among individuals with ARID1B-RD, only one copy of the ARID1B gene "
                    "is not functional and the remaining functional copy is not enough "
                    "to preserve normal function. This condition is termed haploinsufficiency"
                ),
                publication_date=None,
                evidence_type="patient_organization_primary_page",
                evidence_strength="moderate",
                limitations="Advocacy page summarizing genetics; corroborate with peer-reviewed cohorts.",
                reporting_basis="FAR public disease page retrieved 2026-10-03",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:mechanism:haploinsufficiency:relevant:disease:css1",
            "source": "mechanism:arid1b_haploinsufficiency",
            "target": "disease:css1",
            "type": "mechanism_relevant_to_disease",
            "plain_language": "Heterozygous ARID1B LoF-class variants cause CSS1 via haploinsufficiency framing.",
            "evidence": evidence(
                source_url="https://omim.org/entry/135900",
                supporting_passage=(
                    "Coffin-Siris syndrome-1 (CSS1) is caused by heterozygous mutation "
                    "in the ARID1B gene"
                ),
                publication_date=None,
                evidence_type="omim_clinical_synopsis",
                evidence_strength="strong",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:disease:css1:narrower_than:disease:arid1b_rd",
            "source": "disease:css1",
            "target": "disease:arid1b_rd",
            "type": "narrower_than",
            "plain_language": "CSS1 is a clinically framed subset within the broader ARID1B-RD spectrum language.",
            "evidence": evidence(
                source_url="https://www.arid1b.org/arid1b",
                supporting_passage=(
                    "Changes (variants) in the ARID1B gene are the most common cause "
                    "of Coffin-Siris syndrome."
                ),
                publication_date=None,
                evidence_type="patient_organization_primary_page",
                evidence_strength="moderate",
                limitations="Does not imply every ARID1B-RD case meets classic CSS criteria.",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:disease:arid1b_id:related_but_distinct:disease:css1",
            "source": "disease:arid1b_id",
            "target": "disease:css1",
            "type": "related_but_distinct_from",
            "plain_language": (
                "Nonsyndromic ARID1B-ID and CSS1 share the gene but are kept as distinct "
                "clinical framings with overlapping biology."
            ),
            "evidence": evidence(
                source_url="https://pmc.ncbi.nlm.nih.gov/articles/PMC6752273/",
                supporting_passage=(
                    "The associated phenotypes range from clearly recognizable "
                    "Coffin–Siris syndrome (ARID1B-CSS) to less specific ID (ARID1B-ID)."
                ),
                publication_date="2019",
                evidence_type="peer_reviewed_cohort",
                evidence_strength="strong",
                population_context="143-patient ARID1B spectrum cohort",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:genotype:het_lof:defines:disease:arid1b_rd",
            "source": "genotype:arid1b_het_lof",
            "target": "disease:arid1b_rd",
            "type": "genotype_defines",
            "plain_language": "Typical ARID1B-RD genotype context is heterozygous pathogenic variation.",
            "evidence": evidence(
                source_url="https://www.arid1b.org/arid1b",
                supporting_passage=(
                    "Although ARID1B-RD is a genetic disorder, it is very rarely inherited. "
                    "Instead, pathogenic changes in the ARID1B gene occur as random events"
                ),
                publication_date=None,
                evidence_type="patient_organization_primary_page",
                genotype_context="heterozygous, typically de novo",
                evidence_strength="moderate",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:genotype:het_lof:has_allele:Arg1225Ter",
            "source": "genotype:arid1b_het_lof",
            "target": "allele:ARID1B_p.Arg1225Ter",
            "type": "genotype_includes_allele",
            "plain_language": "Example genotype context can include a heterozygous nonsense allele.",
            "evidence": evidence(
                source_url="https://www.ncbi.nlm.nih.gov/clinvar/variation/31210/",
                supporting_passage="NM_001374828.1(ARID1B):c.3673C>T (p.Arg1225Ter)",
                publication_date=None,
                evidence_type="clinvar_structured_record",
                genotype_context="heterozygous representative example",
                evidence_strength="moderate",
                limitations="Illustrative allele; not claiming this allele defines all ARID1B-RD.",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:allele:Arg1225Ter:allele_of:gene:ARID1B",
            "source": "allele:ARID1B_p.Arg1225Ter",
            "target": "gene:ARID1B",
            "type": "allele_of",
            "plain_language": "p.Arg1225Ter is an allele of ARID1B.",
            "evidence": evidence(
                source_url="https://www.ncbi.nlm.nih.gov/clinvar/variation/31210/",
                supporting_passage="Gene: ARID1B",
                publication_date=None,
                evidence_type="clinvar_structured_record",
                evidence_strength="strong",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:allele:c4479:allele_of:gene:ARID1B",
            "source": "allele:ARID1B_c.4479G>A",
            "target": "gene:ARID1B",
            "type": "allele_of",
            "plain_language": "c.4479G>A is an allele of ARID1B.",
            "evidence": evidence(
                source_url="https://www.ncbi.nlm.nih.gov/clinvar/variation/210291/",
                supporting_passage="NM_001374828.1(ARID1B):c.4479G>A",
                publication_date=None,
                evidence_type="clinvar_structured_record",
                evidence_strength="strong",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:clinvar:31210:record_for:allele:Arg1225Ter",
            "source": "clinvar:31210",
            "target": "allele:ARID1B_p.Arg1225Ter",
            "type": "clinvar_record_for_allele",
            "plain_language": "ClinVar variation 31210 is the structured record for this allele example.",
        }
    )
    add_edge(
        {
            "id": "edge:clinvar:210291:record_for:allele:c4479",
            "source": "clinvar:210291",
            "target": "allele:ARID1B_c.4479G>A",
            "type": "clinvar_record_for_allele",
            "plain_language": "ClinVar variation 210291 is the structured record for the splice example.",
        }
    )
    add_edge(
        {
            "id": "edge:allele:c4479:observed_effect_note",
            "source": "allele:ARID1B_c.4479G>A",
            "target": "mechanism:arid1b_haploinsufficiency",
            "type": "source_reports_association",
            "plain_language": (
                "Reported splice/RNA effect supports a LoF-class mechanism framing for "
                "this allele — still allele-specific evidence, not a universal rule."
            ),
            "evidence": evidence(
                source_url="https://www.ncbi.nlm.nih.gov/clinvar/RCV000416951/",
                supporting_passage=(
                    "RNA studies, which show that this variant causes exon 17 to be skipped, "
                    "resulting in a frameshift and early termination"
                ),
                publication_date=None,
                evidence_type="clinvar_submission_summary_citing_rna_studies",
                experimental_context="RNA studies cited in ClinVar interpretation text",
                evidence_strength="moderate",
                limitations=(
                    "Do not generalize from this allele to all predicted truncating variants "
                    "without transcript/NMD context (see PMID 38671509 caution)."
                ),
            ),
        }
    )
    add_edge(
        {
            "id": "edge:disease:arid1b_rd:has_phenotype:id",
            "source": "disease:arid1b_rd",
            "target": "phenotype:intellectual_disability",
            "type": "source_reports_association",
            "plain_language": "Intellectual disability of variable degree is commonly reported in ARID1B-RD.",
            "evidence": evidence(
                source_url="https://www.arid1b.org/arid1b",
                supporting_passage=(
                    "Children and adults with ARID1B-RD typically have intellectual "
                    "disability of variable degree"
                ),
                publication_date=None,
                evidence_type="patient_organization_primary_page",
                population_context="ARID1B-RD as described by FAR; severity variable",
                evidence_strength="moderate",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:disease:css1:has_phenotype:nail",
            "source": "disease:css1",
            "target": "phenotype:fifth_nail_hypoplasia",
            "type": "source_reports_association",
            "plain_language": "Fifth-digit/nail hypoplasia is a classic CSS feature (variable across spectrum).",
            "evidence": evidence(
                source_url="https://search.clinicalgenome.org/kb/gene-dosage/HGNC:18040",
                supporting_passage=(
                    "CSS is characterized by variable degrees of intellectual disability, "
                    "speech impairment, coarse facial features, hypertrichosis, sparse "
                    "scalp hair, and hypoplastic or absent fifth fingernails or toenails."
                ),
                publication_date=None,
                evidence_type="curated_gene_dosage_summary",
                evidence_strength="moderate",
                limitations="Hallmark of CSS framing; not mandatory for every ARID1B-ID presentation.",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:disease:arid1b_rd:has_phenotype:speech",
            "source": "disease:arid1b_rd",
            "target": "phenotype:speech_delay",
            "type": "source_reports_association",
            "plain_language": "Speech delay or limited speech is commonly described.",
            "evidence": evidence(
                source_url="https://www.arid1b.org/arid1b",
                supporting_passage="delays or (near) absence of speech",
                publication_date=None,
                evidence_type="patient_organization_primary_page",
                evidence_strength="moderate",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:pmid:31249371:reports_on:disease:arid1b_rd",
            "source": "pmid:31249371",
            "target": "disease:arid1b_rd",
            "type": "clinical_evidence_supports_outcome",
            "plain_language": "The 143-patient spectrum paper characterizes ARID1B clinical diversity.",
            "evidence": evidence(
                source_url="https://pmc.ncbi.nlm.nih.gov/articles/PMC6752273/",
                supporting_passage=(
                    "Pathogenic variants in ARID1B are one of the most frequent causes "
                    "of intellectual disability (ID) as determined by large-scale exome "
                    "sequencing studies."
                ),
                publication_date="2019",
                evidence_type="peer_reviewed_cohort",
                population_context="n=143 patients with pathogenic ARID1B variants",
                evidence_strength="strong",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:pmid:31249371:reports_on:disease:css1",
            "source": "pmid:31249371",
            "target": "disease:css1",
            "type": "clinical_evidence_supports_outcome",
            "plain_language": "Cohort includes ARID1B-CSS ascertained patients.",
            "evidence": evidence(
                source_url="https://pmc.ncbi.nlm.nih.gov/articles/PMC6752273/",
                supporting_passage=(
                    "ARID1B is by far the most frequently mutated gene (51–75%) in "
                    "Coffin Siris syndrome (CSS) (OMIM 135900)"
                ),
                publication_date="2019",
                evidence_type="peer_reviewed_cohort",
                population_context=(
                    "Percentage refers to mutation-positive share among CSS cohorts "
                    "cited in the paper (refs therein), not a universal population rate."
                ),
                evidence_strength="strong",
                reporting_basis="van der Sluijs et al. 2019 citing prior CSS sequencing series",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:pmid:31249371:reports_variant_classes:gene:ARID1B",
            "source": "pmid:31249371",
            "target": "gene:ARID1B",
            "type": "source_reports_association",
            "plain_language": (
                "Most pathogenic variants in the cohort were frameshift/nonsense; "
                "de novo when parents tested."
            ),
            "evidence": evidence(
                source_url="https://pmc.ncbi.nlm.nih.gov/articles/PMC6752273/",
                supporting_passage=(
                    "Pathogenic variants were apparently de novo in all cases where "
                    "parents could be tested (107/107). ... Most pathogenic variants "
                    "were frameshift or nonsense (n = 118)"
                ),
                publication_date="2019",
                evidence_type="peer_reviewed_cohort",
                population_context="107/107 de novo among parent-tested subset; 118 frameshift/nonsense",
                evidence_strength="strong",
                limitations=(
                    "Does not prove every predicted truncating variant causes NMD/functional "
                    "loss in every transcript context."
                ),
            ),
        }
    )
    add_edge(
        {
            "id": "edge:pmid:22405089:supports:mechanism:haploinsufficiency",
            "source": "pmid:22405089",
            "target": "mechanism:arid1b_haploinsufficiency",
            "type": "experiment_supports_mechanism",
            "plain_language": "Hoyer 2012 linked de novo heterozygous ARID1B LoF-class variants to haploinsufficiency.",
            "evidence": evidence(
                source_url="https://pubmed.ncbi.nlm.nih.gov/22405089/",
                supporting_passage=(
                    "Haploinsufficiency of ARID1B, a Member of the SWI/SNF-A "
                    "Chromatin-Remodeling Complex, Is a Frequent Cause of Intellectual Disability"
                ),
                publication_date="2012",
                evidence_type="peer_reviewed_article",
                evidence_strength="strong",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:study:care4arid1b:focuses:disease:arid1b_rd",
            "source": "study:care4arid1b",
            "target": "disease:arid1b_rd",
            "type": "study_investigates_intervention",
            "plain_language": "CARE4ARID1B is a natural-history study focused on ARID1B-RD (not an interventional treatment trial).",
            "evidence": evidence(
                source_url="http://care4arid1b.org/intro.html",
                supporting_passage=(
                    "Understanding ARID1B-Related Disorder: A Multi-Method, Multi-Site "
                    "Prospective Natural History Study"
                ),
                publication_date=None,
                evidence_type="study_public_description",
                evidence_strength="moderate",
                limitations="Enrollment/status is time-sensitive; verify before outreach.",
                reporting_basis="CARE4ARID1B public intro page retrieved 2026-10-03",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:asset:care4:developed_for:disease:arid1b_rd",
            "source": "asset:care4arid1b_protocol",
            "target": "disease:arid1b_rd",
            "type": "asset_developed_for",
            "plain_language": "The natural-history design is developed for ARID1B-RD endpoint characterization.",
            "evidence": evidence(
                source_url="http://care4arid1b.org/intro.html",
                supporting_passage=(
                    "We seek to define traditional and novel clinical endpoints for "
                    "future targeted ARID1B‑RD clinical trials."
                ),
                publication_date=None,
                evidence_type="study_public_description",
                species="Homo sapiens",
                evidence_strength="moderate",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:study:care4:uses:asset:protocol",
            "source": "study:care4arid1b",
            "target": "asset:care4arid1b_protocol",
            "type": "source_reports_association",
            "plain_language": "The study description is the public asset documenting design and goals.",
            "evidence": evidence(
                source_url="http://care4arid1b.org/intro.html",
                supporting_passage=(
                    "We will monitor the development of 135 children and adolescents "
                    "with ARID1B‑RD over 30 months across seven sites."
                ),
                publication_date=None,
                evidence_type="study_public_description",
                population_context="Planned n=135 ages described on parent pages as 2–18; verify current",
                evidence_strength="moderate",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:org:far:supports:disease:arid1b_rd",
            "source": "org:far",
            "target": "disease:arid1b_rd",
            "type": "organization_supports_community",
            "plain_language": "FAR supports the ARID1B-RD patient/research community.",
            "evidence": evidence(
                source_url="https://www.arid1b.org/",
                supporting_passage=(
                    "The Foundation for ARID1B Research (FAR) was started in 2021 by a "
                    "group of parents"
                ),
                publication_date=None,
                evidence_type="organization_primary_page",
                evidence_strength="strong",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:org:far:could_inform:question",
            "source": "org:far",
            "target": "question:arid1b_endpoint_readiness",
            "type": "potential_collaborator_for",
            "relationship_status": "hypothesis",
            "plain_language": (
                "FAR is a potential community partner for prioritizing endpoint and "
                "trial-readiness questions — availability not claimed."
            ),
            "evidence": evidence(
                source_url="https://www.arid1b.org/research",
                supporting_passage=(
                    "FAR aims to become a hub for translational ARID1B research by "
                    "forming collaborations with academic researchers, biopharma "
                    "companies, the patient community"
                ),
                publication_date=None,
                evidence_type="organization_primary_page",
                evidence_strength="moderate",
                limitations="Public collaboration interest ≠ confirmed partnership or availability.",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:study:care4:leads_to:question",
            "source": "study:care4arid1b",
            "target": "question:arid1b_endpoint_readiness",
            "type": "suggests_next_research_step",
            "relationship_status": "hypothesis",
            "plain_language": (
                "Natural-history endpoint work suggests a concrete next research/"
                "collaboration question."
            ),
            "evidence": evidence(
                source_url="http://care4arid1b.org/intro.html",
                supporting_passage=(
                    "Characterizing Clinical Endpoints: We seek to define traditional "
                    "and novel clinical endpoints for future targeted ARID1B‑RD clinical trials."
                ),
                publication_date=None,
                evidence_type="study_public_description",
                evidence_strength="moderate",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:hypothesis:modifiers:from:pmid:31249371",
            "source": "pmid:31249371",
            "target": "hypothesis:arid1b_spectrum_modifiers",
            "type": "proposed_cross_disease_connection",
            "relationship_status": "hypothesis",
            "plain_language": (
                "Limited genotype–phenotype correlation motivates modifier hypotheses "
                "across CSS-like and ID presentations."
            ),
            "evidence": evidence(
                source_url="https://search.clinicalgenome.org/kb/gene-dosage/HGNC:18040",
                supporting_passage=(
                    "Currently there is no clear genotype-phenotype correlation, "
                    "suggesting the involvement of other phenotypic modifiers."
                ),
                publication_date=None,
                evidence_type="curated_gene_dosage_summary",
                evidence_strength="low",
                limitations="Hypothesis only; not a demonstrated shared treatment implication.",
            ),
        }
    )
    add_edge(
        {
            "id": "edge:hypothesis:modifiers:leads_to:question",
            "source": "hypothesis:arid1b_spectrum_modifiers",
            "target": "question:arid1b_endpoint_readiness",
            "type": "suggests_next_research_step",
            "relationship_status": "hypothesis",
            "plain_language": "Modifier uncertainty feeds into endpoint/eligibility design questions.",
            "evidence": evidence(
                source_url="http://care4arid1b.org/intro.html",
                supporting_passage=(
                    "our study aims to identify biosignatures that can help predict "
                    "and stratify the progression of ARID1B‑RD"
                ),
                publication_date=None,
                evidence_type="study_public_description",
                evidence_strength="low",
            ),
        }
    )

    # Review log — accepted / rejected / unresolved
    log(
        "accept",
        "ARID1B haploinsufficiency is the primary mechanism framing for ARID1B-RD/CSS1",
        reason="Supported by FAR page, ClinGen dosage score 3, Hoyer 2012, OMIM CSS1 entry",
        sources=[
            "https://www.arid1b.org/arid1b",
            "https://search.clinicalgenome.org/kb/gene-dosage/HGNC:18040",
            "PMID:22405089",
            "OMIM:135900",
        ],
    )
    log(
        "accept",
        "Keep CSS1 and nonsyndromic ARID1B-ID as related-but-distinct clinical framings",
        reason="van der Sluijs et al. explicitly contrast ARID1B-CSS vs ARID1B-ID ascertainment",
        sources=["PMID:31249371"],
    )
    log(
        "accept",
        "CARE4ARID1B is a prospective natural-history study aiming to define endpoints",
        reason="Public study pages describe observational multi-site design and endpoint goals",
        sources=["http://care4arid1b.org/intro.html", "http://care4arid1b.org/parents.html"],
    )
    log(
        "accept",
        "FAR is a verified patient/research organization for ARID1B-RD",
        reason="Primary organization website with mission and contact pathways",
        sources=["https://www.arid1b.org/"],
    )
    log(
        "reject",
        "All ARID1B presentations involve identical variants",
        reason="Cohort shows many distinct frameshift/nonsense/splice/deletion alleles; presentations vary",
        sources=["PMID:31249371"],
        status="rejected",
    )
    log(
        "reject",
        "Every truncating variant automatically causes functional protein loss",
        reason=(
            "Transcript/NMD/context matter; pLoF-clustering paper (PMID 38671509) cautions "
            "against universal automatic pathogenicity rules. We require allele-level sources."
        ),
        sources=["PMID:38671509", "PMID:31249371"],
        status="rejected",
    )
    log(
        "reject",
        "There is an approved gene therapy / cure for ARID1B-RD",
        reason="FAR states no treatment currently; management is supportive",
        sources=["https://www.arid1b.org/arid1b"],
        status="rejected",
    )
    log(
        "reject",
        "Import ODC1 LoF disease cluster and DFMO as ARID1B-adjacent treatments",
        reason="Different gene/mechanism; ODC1 LoF association unresolved; would fabricate cross-cluster edges",
        sources=["GeneReviews Bachmann-Bupp NBK583220"],
        status="rejected",
    )
    log(
        "reject",
        "Merge CSS caused by other BAF genes into ARID1B-CSS1",
        reason="Shared clinical label ≠ shared gene; keep gene-defined CSS1 separate",
        sources=["OMIM:135900", "ClinGen ARID1B dosage page"],
        status="rejected",
    )
    log(
        "unresolved",
        "Exact worldwide prevalence (e.g., 1/9500) as a hard atlas fact",
        reason=(
            "CARE4ARID1B/FAR quote an approximated prevalence; retained as source-attributed "
            "context in nodes/passages, not as a standalone numeric edge without population methodology detail"
        ),
        sources=["http://care4arid1b.org/intro.html", "https://www.arid1b.org/arid1b"],
        status="unresolved",
    )
    log(
        "unresolved",
        "Current CARE4ARID1B enrollment open/closed status on any given date",
        reason="Time-sensitive; UI marks status as verify-before-citing",
        sources=["http://care4arid1b.org/parents.html"],
        status="unresolved",
    )
    log(
        "unresolved",
        "ASO upregulation of the wild-type allele as a near-term therapy",
        reason=(
            "FAR research pages discuss modality exploration; not imported as an intervention "
            "node with efficacy claims in this curated slice"
        ),
        sources=["https://www.arid1b.org/research"],
        status="unresolved",
    )

    curated = {
        "generated_at": utc_now(),
        "layer": "curated",
        "dataset_id": "arid1b",
        "focus_gene": diseases["focus_gene"],
        "nodes": list(nodes.values()),
        "edges": edges,
        "stats": {"nodes": len(nodes), "edges": len(edges)},
        "default_journey_id": "journey:arid1b_research_discovery",
    }

    journey = {
        "id": "journey:arid1b_research_discovery",
        "title": "ARID1B-RD research discovery journey",
        "intended_user": "Patient-group organizer or rare-disease research coordinator",
        "plain_language": (
            "Start from ARID1B-related disorder, follow haploinsufficiency / BAF biology "
            "and the CSS↔ID spectrum evidence, then connect to CARE4ARID1B natural-history "
            "work and FAR as a potential collaboration partner for a specific endpoint-"
            "readiness research question. No treatment recommendation is made."
        ),
        "node_path": [
            "disease:arid1b_rd",
            "gene:ARID1B",
            "mechanism:arid1b_haploinsufficiency",
            "process:baf_chromatin_remodeling",
            "disease:css1",
            "disease:arid1b_id",
            "pmid:31249371",
            "study:care4arid1b",
            "asset:care4arid1b_protocol",
            "org:far",
            "question:arid1b_endpoint_readiness",
        ],
        "edge_path": [
            "edge:mechanism:haploinsufficiency:relevant:disease:arid1b_rd",
            "edge:gene:ARID1B:participates:process:baf",
            "edge:process:baf:supports:mechanism:haploinsufficiency",
            "edge:disease:css1:narrower_than:disease:arid1b_rd",
            "edge:disease:arid1b_id:related_but_distinct:disease:css1",
            "edge:pmid:31249371:reports_on:disease:arid1b_rd",
            "edge:study:care4arid1b:focuses:disease:arid1b_rd",
            "edge:asset:care4:developed_for:disease:arid1b_rd",
            "edge:org:far:supports:disease:arid1b_rd",
            "edge:study:care4:leads_to:question",
            "edge:org:far:could_inform:question",
        ],
        "answers": {
            "relevant_communities": ["org:far"],
            "existing_assets": ["asset:care4arid1b_protocol", "study:care4arid1b"],
            "who_could_help": ["org:far"],
            "next_step": (
                "Review CARE4ARID1B public endpoint goals with FAR/community priorities "
                "and draft eligibility language that preserves CSS1 vs broader ARID1B-RD distinctions."
            ),
        },
    }

    demo = build_demo_experience()

    # Discovery stub: curated plus explicitly unreviewed placeholders kept separate
    discovery_nodes = list(nodes.values()) + [
        {
            "id": "discovery:unreviewed_arid1b_literature_hit",
            "type": "publication",
            "label": "Unreviewed literature search placeholder",
            "layer": "discovery",
            "review_status": "discovery",
            "notes": "Placeholder only — not shown as curated evidence.",
        }
    ]
    discovery = {
        "generated_at": utc_now(),
        "layer": "discovery",
        "dataset_id": "arid1b",
        "nodes": discovery_nodes,
        "edges": edges,
        "stats": {
            "nodes": len(discovery_nodes),
            "edges": len(edges),
            "note": "Discovery stub retains curated core; no automated bulk import merged into curated layer.",
        },
    }

    gaps = """# ARID1B curated-layer gaps

- No approved disease-modifying therapy node (intentionally omitted).
- No individual investigator emails or private patient data.
- CARE4ARID1B open/closed enrollment status not frozen as a fact edge (time-sensitive).
- Prevalence figures retained only inside source passages with approximation language.
- ASO / gene-regulation modality ideas left unresolved — not intervention nodes.
- No cross-edges to the HBB dataset (no supporting source for a shared mechanism/treatment claim).
"""

    summary = f"""# ARID1B collection summary

- Dataset: arid1b
- Retrieval date for curated passages: {RETRIEVAL_DATE}
- Curated nodes: {len(nodes)}
- Curated edges: {len(edges)}
- Anchor publications: PMID 31249371, PMID 22405089
- Organizations: Foundation for ARID1B Research
- Studies/assets: CARE4ARID1B natural history (public description)
- Licensing/access: public web pages, PubMed/PMC, ClinVar, ClinGen, OMIM; no private clinical data
- Review: curator public-source check (not expert board review)
"""

    (OUTPUT / "curated-graph.json").write_text(json.dumps(curated, indent=2) + "\n", encoding="utf-8")
    (OUTPUT / "graph.json").write_text(json.dumps(discovery, indent=2) + "\n", encoding="utf-8")
    (OUTPUT / "journeys.json").write_text(
        json.dumps({"journeys": [journey]}, indent=2) + "\n", encoding="utf-8"
    )
    (OUTPUT / "demo-experience.json").write_text(json.dumps(demo, indent=2) + "\n", encoding="utf-8")
    (OUTPUT / "review-log.json").write_text(json.dumps(review_log, indent=2) + "\n", encoding="utf-8")
    (OUTPUT / "gaps.md").write_text(gaps, encoding="utf-8")
    (OUTPUT / "collection-summary.md").write_text(summary, encoding="utf-8")
    (OUTPUT / "quality-report.json").write_text(
        json.dumps(
            {
                "dataset_id": "arid1b",
                "generated_at": utc_now(),
                "nodes": len(nodes),
                "edges": len(edges),
                "edges_with_source_url": sum(
                    1 for e in edges if (e.get("evidence") or {}).get("source_url")
                ),
                "expert_reviewed": False,
                "private_patient_data": False,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"ARID1B curated graph written: nodes={len(nodes)} edges={len(edges)}")


def build_demo_experience() -> dict[str, Any]:
    return {
        "product_one_liner": "Search a rare disease and follow sourced connections to related biology, communities, and research assets.",
        "product_name": "Rare Disease Atlas",
        "dataset_id": "arid1b",
        "dataset_label": "ARID1B-related disorders",
        "default_focus_id": "disease:arid1b_rd",
        "default_partner_id": "org:far",
        "default_asset_ids": ["study:care4arid1b", "asset:care4arid1b_protocol"],
        "landing_disclaimer": (
            "This atlas focuses on sourced research connections and reusable assets — "
            "not treatment advice. ARID1B-RD currently has no approved disease-modifying therapy in this curated layer."
        ),
        "example_searches": [
            {"label": "ARID1B", "query": "ARID1B"},
            {"label": "Coffin-Siris", "query": "Coffin-Siris"},
            {"label": "ARID1B-RD", "query": "ARID1B-RD"},
            {"label": "haploinsufficiency", "query": "haploinsufficiency"},
        ],
        "search_entries": [
            {
                "id": "disease:arid1b_rd",
                "label": "ARID1B-related disorder (ARID1B-RD)",
                "category": "disease",
                "disambiguation_note": "Gene-centered umbrella spanning CSS-like and less syndromic ID presentations.",
                "synonyms": [
                    "arid1b-rd",
                    "arid1b related disorder",
                    "arid1b-related disorder",
                    "arid1b disorder",
                ],
            },
            {
                "id": "disease:css1",
                "label": "Coffin-Siris syndrome 1 (CSS1)",
                "category": "disease",
                "disambiguation_note": "ARID1B-linked CSS subtype (OMIM 135900). Other genes can cause CSS clinically.",
                "synonyms": [
                    "coffin-siris",
                    "coffin siris",
                    "coffin-siris syndrome",
                    "css1",
                    "css",
                ],
            },
            {
                "id": "disease:arid1b_id",
                "label": "ARID1B-related nonsyndromic intellectual disability",
                "category": "disease",
                "disambiguation_note": "Keep distinct from classic CSS1 physical framing.",
                "synonyms": [
                    "arid1b-id",
                    "arid1b intellectual disability",
                    "nonsyndromic arid1b",
                ],
            },
            {
                "id": "gene:ARID1B",
                "label": "ARID1B",
                "category": "gene",
                "disambiguation_note": "BAF-complex subunit gene on 6q25.3.",
                "synonyms": ["arid1b", "baf250b", "at-rich interaction domain 1b"],
            },
            {
                "id": "allele:ARID1B_p.Arg1225Ter",
                "label": "ARID1B p.Arg1225Ter",
                "category": "variant",
                "disambiguation_note": "Representative ClinVar nonsense example (c.3673C>T on NM_001374828.1).",
                "synonyms": ["c.3673c>t", "p.arg1225ter", "arg1225ter"],
            },
            {
                "id": "allele:ARID1B_c.4479G>A",
                "label": "ARID1B c.4479G>A (splice)",
                "category": "variant",
                "disambiguation_note": "Synonymous-looking coding change with reported splice/RNA effect.",
                "synonyms": ["c.4479g>a", "arid1b splice"],
            },
            {
                "id": "mechanism:arid1b_haploinsufficiency",
                "label": "ARID1B haploinsufficiency",
                "category": "mechanism",
                "disambiguation_note": "Disease-mechanism framing for heterozygous LoF-class patterns.",
                "synonyms": ["haploinsufficiency", "arid1b haploinsufficiency"],
            },
            {
                "id": "org:far",
                "label": "Foundation for ARID1B Research",
                "category": "organization",
                "disambiguation_note": "Patient-led research foundation (FAR).",
                "synonyms": ["far", "foundation for arid1b research", "arid1b foundation"],
            },
            {
                "id": "study:care4arid1b",
                "label": "CARE4ARID1B natural history study",
                "category": "study",
                "disambiguation_note": "Multi-site prospective natural-history study — not a treatment trial.",
                "synonyms": ["care4arid1b", "care4 arid1b", "arid1b natural history"],
            },
        ],
        "category_legend": [
            {"id": "disease", "label": "Diseases", "color": "#1d4ed8"},
            {"id": "gene_variant", "label": "Genes & variants", "color": "#0f766e"},
            {"id": "mechanism", "label": "Mechanisms & processes", "color": "#b45309"},
            {"id": "intervention", "label": "Interventions", "color": "#be123c"},
            {"id": "study", "label": "Clinical studies", "color": "#7c3aed"},
            {"id": "publication", "label": "Publications", "color": "#c026d3"},
            {"id": "organization_asset", "label": "Organizations & assets", "color": "#ea580c"},
            {"id": "phenotype", "label": "Phenotypes", "color": "#57534e"},
        ],
        "stages": [
            {
                "id": "understand",
                "label": "Understand the connection",
                "summary": "Follow ARID1B-RD to haploinsufficiency/BAF biology and the CSS1 vs nonsyndromic ID spectrum.",
                "anchor_node_id": "disease:arid1b_rd",
                "preferred_edge_id": "edge:mechanism:haploinsufficiency:relevant:disease:arid1b_rd",
                "node_ids": [
                    "disease:arid1b_rd",
                    "genotype:arid1b_het_lof",
                    "allele:ARID1B_p.Arg1225Ter",
                    "gene:ARID1B",
                    "protein:ARID1B",
                    "mechanism:arid1b_haploinsufficiency",
                    "process:baf_chromatin_remodeling",
                    "disease:css1",
                    "disease:arid1b_id",
                    "phenotype:intellectual_disability",
                    "phenotype:fifth_nail_hypoplasia",
                    "pmid:31249371",
                ],
                "edge_ids": [
                    "edge:genotype:het_lof:defines:disease:arid1b_rd",
                    "edge:genotype:het_lof:has_allele:Arg1225Ter",
                    "edge:allele:Arg1225Ter:allele_of:gene:ARID1B",
                    "edge:gene:ARID1B:encodes:protein:ARID1B",
                    "edge:gene:ARID1B:participates:process:baf",
                    "edge:process:baf:supports:mechanism:haploinsufficiency",
                    "edge:mechanism:haploinsufficiency:relevant:disease:arid1b_rd",
                    "edge:disease:css1:narrower_than:disease:arid1b_rd",
                    "edge:disease:arid1b_id:related_but_distinct:disease:css1",
                    "edge:disease:arid1b_rd:has_phenotype:id",
                    "edge:disease:css1:has_phenotype:nail",
                    "edge:pmid:31249371:reports_on:disease:arid1b_rd",
                ],
            },
            {
                "id": "explore",
                "label": "Explore resources",
                "summary": "See the spectrum publication, CARE4ARID1B natural-history asset, and FAR — with explicit non-treatment framing.",
                "anchor_node_id": "disease:arid1b_rd",
                "preferred_edge_id": "edge:study:care4arid1b:focuses:disease:arid1b_rd",
                "node_ids": [
                    "disease:arid1b_rd",
                    "disease:css1",
                    "mechanism:arid1b_haploinsufficiency",
                    "pmid:31249371",
                    "pmid:22405089",
                    "study:care4arid1b",
                    "asset:care4arid1b_protocol",
                    "org:far",
                    "allele:ARID1B_c.4479G>A",
                    "gene:ARID1B",
                ],
                "edge_ids": [
                    "edge:mechanism:haploinsufficiency:relevant:disease:arid1b_rd",
                    "edge:mechanism:haploinsufficiency:relevant:disease:css1",
                    "edge:pmid:31249371:reports_on:disease:arid1b_rd",
                    "edge:pmid:31249371:reports_on:disease:css1",
                    "edge:pmid:22405089:supports:mechanism:haploinsufficiency",
                    "edge:study:care4arid1b:focuses:disease:arid1b_rd",
                    "edge:study:care4:uses:asset:protocol",
                    "edge:asset:care4:developed_for:disease:arid1b_rd",
                    "edge:org:far:supports:disease:arid1b_rd",
                    "edge:allele:c4479:allele_of:gene:ARID1B",
                    "edge:allele:c4479:observed_effect_note",
                ],
            },
            {
                "id": "prepare",
                "label": "Prepare next step",
                "summary": "Turn endpoint and spectrum uncertainties into a sourced collaboration brief.",
                "anchor_node_id": "question:arid1b_endpoint_readiness",
                "preferred_edge_id": "edge:study:care4:leads_to:question",
                "node_ids": [
                    "question:arid1b_endpoint_readiness",
                    "org:far",
                    "study:care4arid1b",
                    "hypothesis:arid1b_spectrum_modifiers",
                ],
                "edge_ids": [
                    "edge:study:care4:leads_to:question",
                    "edge:org:far:could_inform:question",
                    "edge:hypothesis:modifiers:leads_to:question",
                ],
            },
        ],
        "edge_plain_language": {
            "edge:mechanism:haploinsufficiency:relevant:disease:arid1b_rd": "Haploinsufficiency is the core mechanism framing for ARID1B-RD.",
            "edge:gene:ARID1B:participates:process:baf": "ARID1B participates in BAF/SWI/SNF chromatin remodeling.",
            "edge:process:baf:supports:mechanism:haploinsufficiency": "BAF dosage sensitivity supports why one impaired ARID1B copy can matter.",
            "edge:disease:css1:narrower_than:disease:arid1b_rd": "CSS1 is a clinical subset within broader ARID1B-RD language.",
            "edge:disease:arid1b_id:related_but_distinct:disease:css1": "Nonsyndromic ARID1B-ID and CSS1 are related but not identical presentations.",
            "edge:pmid:31249371:reports_on:disease:arid1b_rd": "A 143-patient paper maps the ARID1B clinical spectrum.",
            "edge:study:care4arid1b:focuses:disease:arid1b_rd": "CARE4ARID1B is a natural-history study for ARID1B-RD.",
            "edge:org:far:supports:disease:arid1b_rd": "FAR is a verified ARID1B-RD community organization.",
            "edge:study:care4:leads_to:question": "Natural-history endpoint goals motivate a concrete next research question.",
            "edge:org:far:could_inform:question": "FAR may inform community priorities — availability not claimed.",
        },
        "asset_assessments": [
            {
                "asset_id": "study:care4arid1b",
                "asset_kind": "natural_history_study",
                "title": "CARE4ARID1B prospective natural history study",
                "description": "Multi-site prospective study describing developmental trajectories and clinical endpoints for ARID1B-RD.",
                "owner": "CARE4ARID1B consortium (public study pages)",
                "source_url": "http://care4arid1b.org/intro.html",
                "designed_for": {
                    "disease": "ARID1B-related disorder",
                    "genotype": "Genetically confirmed ARID1B-RD (per study eligibility language)",
                    "population": "Children/adolescents described on public pages (verify current age window)",
                    "species": "Homo sapiens",
                },
                "access": "Public study description. No participant-level data bundled here. Contact study sites for participation questions.",
                "relevance_to_journey": "Primary research asset for endpoint definition ahead of any future interventional discussion.",
                "comparison": {
                    "may_be_reusable": [
                        "Public endpoint and assessment framing for collaboration briefs",
                        "Multi-site natural-history design pattern for other NDDs (as a design reference only)"
                    ],
                    "what_differs": [
                        "Observational natural history ≠ interventional treatment trial",
                        "ARID1B-RD endpoints are not hemoglobinopathy endpoints"
                    ],
                    "needs_expert_review": [
                        "Which endpoints are mature enough for protocol discussions",
                        "How CSS1 vs broader ARID1B-RD labeling should appear in eligibility"
                    ],
                    "adaptation_status": "Documented for ARID1B-RD natural history; not a therapy",
                    "validation_question": "Which CARE4ARID1B endpoints are ready to cite in an interventional-trial design conversation?",
                },
            },
            {
                "asset_id": "asset:care4arid1b_protocol",
                "asset_kind": "study_design_description",
                "title": "CARE4ARID1B public design / methods description",
                "description": "Public methods summary (assessments, biomarkers, wearable/caregiver reports, planned cohort size).",
                "owner": "CARE4ARID1B consortium",
                "source_url": "http://care4arid1b.org/intro.html",
                "designed_for": {
                    "disease": "ARID1B-RD",
                    "genotype": "ARID1B pathogenic variant confirmed for eligibility (per public pages)",
                    "population": "Planned ~135 participants across seven sites",
                    "species": "Homo sapiens",
                },
                "access": "Public web description only.",
                "relevance_to_journey": "Concrete design artifact to discuss in a sourced proposal.",
                "comparison": {
                    "may_be_reusable": [
                        "Assessment cadence and multi-method framing as discussion reference"
                    ],
                    "what_differs": [
                        "Public summary is not the full protocol or data-use agreement"
                    ],
                    "needs_expert_review": [
                        "Current site status and data-access pathways",
                        "Whether historical-control use is appropriate for a proposed question"
                    ],
                    "adaptation_status": "Potential reference for trial-readiness planning",
                    "validation_question": "What can be reused from the public design vs what requires consortium collaboration?",
                },
            },
            {
                "asset_id": "org:far",
                "asset_kind": "patient_organization",
                "title": "Foundation for ARID1B Research (FAR)",
                "description": "Parent-led foundation advancing ARID1B-RD research collaborations.",
                "owner": "Foundation for ARID1B Research",
                "source_url": "https://www.arid1b.org/",
                "designed_for": {
                    "disease": "ARID1B-related disorder",
                    "genotype": "Community-level; not a single-variant filter",
                    "population": "Patients, families, researchers",
                    "species": None,
                },
                "access": "Public website/contact. Verify before outreach. Atlas sends nothing automatically.",
                "relevance_to_journey": "Potential partner for prioritizing endpoint and research questions.",
                "comparison": {
                    "may_be_reusable": [
                        "Community priority-setting for a collaboration brief"
                    ],
                    "what_differs": [
                        "Organization mission ≠ study protocol",
                        "Interest in modalities is not an efficacy claim"
                    ],
                    "needs_expert_review": [
                        "Current programs and capacity",
                        "How FAR prefers CSS1 vs ARID1B-RD language in external materials"
                    ],
                    "adaptation_status": "Potential collaboration to investigate",
                    "validation_question": "Which endpoint and natural-history priorities does FAR want emphasized in a research brief?",
                },
            },
            {
                "asset_id": "pmid:31249371",
                "asset_kind": "publication",
                "title": "ARID1B spectrum cohort (143 patients)",
                "description": "Peer-reviewed characterization of ARID1B-CSS vs ARID1B-ID presentations and variant classes.",
                "owner": "van der Sluijs et al., Genet Med 2019",
                "source_url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC6752273/",
                "designed_for": {
                    "disease": "ARID1B spectrum (CSS and ID ascertainment)",
                    "genotype": "Pathogenic ARID1B variants as ascertained in cohort",
                    "population": "143 individuals",
                    "species": "Homo sapiens",
                },
                "access": "Open access via PMC.",
                "relevance_to_journey": "Primary evidence that spectrum labels should not be collapsed.",
                "comparison": {
                    "may_be_reusable": [
                        "Variant-class and de novo statistics with population denominators from the paper"
                    ],
                    "what_differs": [
                        "Cohort ascertainment biases differ from natural-history enrollment"
                    ],
                    "needs_expert_review": [
                        "How to cite percentages with their original denominators"
                    ],
                    "adaptation_status": "Evidence reference",
                    "validation_question": "Which spectrum distinctions must appear in any proposal eligibility language?",
                },
            },
        ],
        "registry_gap": {
            "status": "natural_history_present_patient_registry_not_verified",
            "explanation": (
                "CARE4ARID1B provides a prospective natural-history study description, but this "
                "curated layer does not include a verified standalone patient registry with a "
                "confirmed data-access pathway."
            ),
            "missing_evidence": [
                "Registry name/owner, consent scope, and access process verified from a primary public page distinct from the natural-history study"
            ],
            "next_question": "Is there a publicly documented ARID1B patient registry with a clear access pathway beyond CARE4ARID1B study enrollment?",
        },
        "unsupported_search": {
            "sources_searched": [
                "Curated ARID1B demonstration layer (ClinVar examples, PMID 31249371/22405089, CARE4ARID1B, FAR, ClinGen dosage)",
                "Curated HBB demonstration layer remains separate — no cross-cluster merge",
                "Discovery placeholders retained but not treated as validated leads",
            ],
            "coverage_note": "Coverage is limited to the curated HBB and ARID1B demonstration datasets in this prototype.",
        },
        "proposal_defaults": {
            "research_question": (
                "Which CARE4ARID1B natural-history endpoints are ready to inform a future "
                "interventional protocol discussion for ARID1B-RD without collapsing CSS1 and "
                "nonsyndromic ID presentations?"
            ),
            "proposed_next_step": (
                "Review the CARE4ARID1B public endpoint goals with FAR community priorities, "
                "list spectrum-preserving eligibility language, and identify what still lacks "
                "public evidence before any therapy-oriented claim."
            ),
            "partner_gap_if_unknown": "No individual researcher availability or email is asserted. Use organization public contact pages after human verification.",
        },
        "unsupported_missing_evidence": [
            "A curated entity match for this query in the demonstration layer",
            "A reviewed edge connecting it into the selected dataset journey without merging unrelated disease labels",
        ],
        "unsupported_next_question_template": (
            'What primary public source would establish whether "{query}" belongs in the '
            "Rare Disease Atlas curated layer, and which disease scope should it be mapped "
            "to without merging synonyms?"
        ),
    }


if __name__ == "__main__":
    curate()
