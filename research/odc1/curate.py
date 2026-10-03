#!/usr/bin/env python3
"""Curate ODC1 / Bachmann-Bupp demonstration layer with explicit LoF and cancer caveats."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent))
from _shared.curate_lib import GraphBuilder, default_legend, write_outputs  # noqa: E402

RETRIEVAL_DATE = "2026-10-03"
OUTPUT = ROOT / "output"
CONFIG = ROOT / "config"


def curate() -> None:
    cfg = json.loads((CONFIG / "diseases.json").read_text(encoding="utf-8"))
    b = GraphBuilder(RETRIEVAL_DATE)

    b.add_node(
        {
            "id": "gene:ODC1",
            "type": "gene",
            "label": "ODC1",
            "full_name": "Ornithine decarboxylase 1",
            "chromosome": "2p25.1",
            "omim": "OMIM:165640",
            "plain_language": "Gene encoding the rate-limiting enzyme converting ornithine to putrescine in polyamine synthesis.",
        }
    )
    b.add_node(
        {
            "id": "protein:ODC",
            "type": "protein",
            "label": "ODC enzyme",
            "plain_language": "Ornithine decarboxylase protein; activity and abundance are both biologically important.",
        }
    )
    b.add_node(
        {
            "id": "disease:babs",
            "type": "disease",
            "label": "Bachmann-Bupp syndrome (BABS)",
            "omim": "OMIM:619075",
            "genotype_scope": "Heterozygous ODC1 C-terminal gain-of-function pathogenic variant",
            "plain_language": "Established germline neurodevelopmental disorder with alopecia, developmental delay, and hypotonia caused by ODC1 gain-of-function variants.",
        }
    )
    b.add_node(
        {
            "id": "disease:odc1_lof_unresolved",
            "type": "disease",
            "label": "ODC1 loss-of-function neurologic association (unresolved)",
            "plain_language": "Not established as a Mendelian disease entity here. Kept visible so LoF leads are not silently merged into BABS.",
            "notes": "GeneReviews: unclear whether LoF leads to a distinct phenotype; current evidence suggests LoF unlikely deleterious.",
        }
    )
    b.add_node(
        {
            "id": "mechanism:odc1_c_terminal_gof",
            "type": "mechanism",
            "label": "ODC1 C-terminal gain-of-function (reduced degradation)",
            "plain_language": "C-terminal truncation/escape from degradation increases active ODC and putrescine — gain-of-function, not loss-of-function.",
        }
    )
    b.add_node(
        {
            "id": "process:polyamine_biosynthesis",
            "type": "biological_process",
            "label": "Polyamine biosynthesis",
            "plain_language": "Pathway producing putrescine, spermidine, and spermine.",
        }
    )
    b.add_node(
        {
            "id": "phenotype:alopecia",
            "type": "phenotype",
            "label": "Non-congenital alopecia (early hair loss)",
            "plain_language": "Hair often present at birth with later clumped loss — hallmark BABS feature per NORD/GeneReviews.",
        }
    )
    b.add_node(
        {
            "id": "phenotype:developmental_delay",
            "type": "phenotype",
            "label": "Global developmental delay",
            "plain_language": "Motor and speech delays of variable severity across the small reported BABS cohort.",
        }
    )
    b.add_node(
        {
            "id": "phenotype:hypotonia",
            "type": "phenotype",
            "label": "Hypotonia",
            "plain_language": "Low muscle tone commonly described in BABS.",
        }
    )
    b.add_node(
        {
            "id": "allele:ODC1_p.Lys448Ter",
            "type": "allele",
            "label": "ODC1 p.Lys448Ter (K448X)",
            "hgvs_c": "NM_002539.3:c.1342A>T",
            "hgvs_p_modern": "p.Lys448Ter",
            "reference_transcript": "NM_002539.3",
            "clinvar_variation_id": "983289",
            "predicted_molecular_consequence": "nonsense near C-terminus",
            "experimentally_observed_effect": "Elevated ODC protein and putrescine; gain-of-function via impaired degradation",
            "plain_language": "Canonical BABS allele: predicted truncation produces gain of enzyme activity/abundance, not simple loss.",
        }
    )
    b.add_node(
        {
            "id": "allele:ODC1_p.Gln419Ter",
            "type": "allele",
            "label": "ODC1 p.Gln419Ter",
            "clinvar_variation_id": "983287",
            "predicted_molecular_consequence": "nonsense in C-terminal cluster",
            "plain_language": "Second C-terminal BABS allele example (OMIM/Rodan cluster).",
            "notes": "Verify current HGVS on ClinVar before clinical use.",
        }
    )
    b.add_node(
        {
            "id": "allele:ODC1_p.Gly84Arg",
            "type": "allele",
            "label": "ODC1 p.Gly84Arg (G84R) — unresolved LoF lead",
            "clinvar_variation_id": "1299887",
            "predicted_molecular_consequence": "missense; sometimes discussed as partial LoF",
            "plain_language": "Population-enriched variant discussed in LoF literature — NOT a BABS allele and not established disease causation here.",
            "uncertainties": [
                "Enrichment in neurologic cohorts ≠ proven Mendelian disease",
                "Functional activity interpretations have been contested",
            ],
        }
    )
    b.add_node(
        {
            "id": "clinvar:983289",
            "type": "variant",
            "label": "ClinVar VCV000983289 (p.Lys448Ter)",
            "clinvar_variation_id": "983289",
            "source_url": "https://www.ncbi.nlm.nih.gov/clinvar/variation/983289/",
        }
    )
    b.add_node(
        {
            "id": "genotype:odc1_het_gof",
            "type": "genotype",
            "label": "Heterozygous ODC1 C-terminal GoF genotype (typical BABS)",
            "genotype_scope": "One C-terminal GoF pathogenic allele + one reference allele; typically de novo",
            "plain_language": "Typical BABS genotype is heterozygous gain-of-function — opposite direction from many pLoF assumptions.",
        }
    )
    b.add_node(
        {
            "id": "pmid:30063100",
            "type": "publication",
            "label": "Bupp et al. 2018 — first ODC1 GoF / BABS case",
            "pmid": "30063100",
            "pubdate": "2018",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/30063100/",
            "plain_language": "Describes de novo p.Lys448Ter with elevated ODC/putrescine.",
        }
    )
    b.add_node(
        {
            "id": "pmid:30475435",
            "type": "publication",
            "label": "Rodan et al. 2018 — additional ODC1 GoF cases",
            "pmid": "30475435",
            "pubdate": "2018",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/30475435/",
            "plain_language": "Expands C-terminal GoF variant cluster and phenotype.",
        }
    )
    b.add_node(
        {
            "id": "pmid:36007106",
            "type": "publication",
            "label": "GeneReviews — Bachmann-Bupp Syndrome (2022)",
            "pmid": "36007106",
            "pubdate": "2022",
            "source_url": "https://www.ncbi.nlm.nih.gov/books/NBK583220/",
            "plain_language": "Curated clinical summary: GoF mechanism, DFMO investigational/compassionate-use, LoF unclear.",
        }
    )
    b.add_node(
        {
            "id": "intervention:dfmo_eflornithine_investigational",
            "type": "intervention",
            "label": "DFMO / eflornithine (investigational for BABS)",
            "does_not": (
                "Is not asserted here as an FDA-approved therapy for Bachmann-Bupp syndrome; "
                "GeneReviews/NORD describe compassionate-use / IND investigation"
            ),
            "plain_language": "ODC inhibitor studied under compassionate-use/IND protocols for BABS — status is investigational for this indication.",
            "source_url": "https://www.ncbi.nlm.nih.gov/books/NBK583220/",
        }
    )
    b.add_node(
        {
            "id": "asset:icpd",
            "type": "research_asset",
            "label": "International Center for Polyamine Disorders (ICPD)",
            "species": "Homo sapiens",
            "source_url": "https://rarediseases.org/rare-diseases/bachmann-bupp-syndrome/",
            "access_info": "Described on NORD/GeneReviews as the center running compassionate-use DFMO investigation. Verify current contact before outreach.",
            "plain_language": "Translational/clinical research program for polyaminopathies including BABS DFMO investigation.",
        }
    )
    b.add_node(
        {
            "id": "org:nord_babs",
            "type": "organization",
            "label": "NORD — Bachmann-Bupp syndrome page",
            "source_url": "https://rarediseases.org/rare-diseases/bachmann-bupp-syndrome/",
            "access_info": "Public rare-disease information page. NORD is an umbrella organization, not a BABS-only foundation.",
            "plain_language": "Verified public disease information and research pointers for BABS.",
        }
    )
    b.add_node(
        {
            "id": "org:snyder_robinson",
            "type": "organization",
            "label": "Snyder-Robinson Foundation (related polyaminopathy support)",
            "source_url": "https://www.snyder-robinson.org/",
            "access_info": "Listed by NORD in BABS resources; primary mission is Snyder-Robinson syndrome, not BABS-only.",
            "plain_language": "Related polyaminopathy advocacy organization — useful collaborator lead, not proof of BABS-specific ownership.",
            "notes": "Keep distinct from a BABS-only foundation claim.",
        }
    )
    b.add_node(
        {
            "id": "hypothesis:odc1_cancer_expression_separate",
            "type": "hypothesis",
            "label": "Cancer-associated ODC1 upregulation (separate context)",
            "plain_language": "ODC1 overexpression in cancers is a distinct somatic/expression context — not the BABS germline GoF mechanism.",
            "relationship_status": "hypothesis",
            "notes": "Retained only as an explicit separation marker; no treatment transfer inferred.",
        }
    )
    b.add_node(
        {
            "id": "question:odc1_dfmo_evidence_and_lof_gap",
            "type": "research_question",
            "label": "What evidence is still needed to evaluate DFMO access pathways for BABS without conflating unresolved LoF associations?",
            "plain_language": "Next research question keeps investigational DFMO distinct from approvals and keeps LoF leads out of the established BABS path.",
            "uncertainties": [
                "DFMO for BABS remains investigational/compassionate-use per GeneReviews/NORD",
                "LoF Mendelian disease association unresolved",
                "Cancer ODC1 biology must stay separate",
            ],
            "validation_questions": [
                "What public eligibility/status information exists for ICPD compassionate-use DFMO?",
                "Which LoF claims should remain labeled unresolved in community materials?",
            ],
        }
    )

    # Edges
    b.add_edge(
        {
            "id": "edge:gene:ODC1:encodes:protein",
            "source": "gene:ODC1",
            "target": "protein:ODC",
            "type": "encodes",
            "plain_language": "ODC1 encodes ornithine decarboxylase.",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/gene/4953",
                supporting_passage="ODC1 ornithine decarboxylase 1 [Homo sapiens (human)]",
                publication_date=None,
                evidence_type="structured_database",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:gene:ODC1:participates:polyamine",
            "source": "gene:ODC1",
            "target": "process:polyamine_biosynthesis",
            "type": "gene_participates_in_process",
            "plain_language": "ODC1 is the rate-limiting step into polyamine biosynthesis.",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/books/NBK583220/",
                supporting_passage="Ornithine decarboxylase is the first rate-limiting enzyme in polyamine synthesis",
                publication_date="2022",
                evidence_type="genereviews",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:process:polyamine:supports:gof",
            "source": "process:polyamine_biosynthesis",
            "target": "mechanism:odc1_c_terminal_gof",
            "type": "experiment_supports_mechanism",
            "plain_language": "Excess pathway activity from accumulated ODC frames the BABS gain-of-function mechanism.",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/books/NBK583220/",
                supporting_passage="Gain-of-function variants located in the C terminus are associated with BABS",
                publication_date="2022",
                evidence_type="genereviews",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:mechanism:gof:relevant:babs",
            "source": "mechanism:odc1_c_terminal_gof",
            "target": "disease:babs",
            "type": "mechanism_relevant_to_disease",
            "plain_language": "C-terminal gain-of-function is the established BABS disease mechanism.",
            "evidence": b.ev(
                source_url="https://omim.org/entry/619075",
                supporting_passage="Bachmann-Bupp syndrome (BABS) is caused by heterozygous mutation in the ornithine decarboxylase-1 gene (ODC1)",
                publication_date=None,
                evidence_type="omim_clinical_synopsis",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:lof_disease:related_distinct:babs",
            "source": "disease:odc1_lof_unresolved",
            "target": "disease:babs",
            "type": "related_but_distinct_from",
            "plain_language": "Unresolved LoF associations are gene-related but not the established BABS entity.",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/books/NBK583220/",
                supporting_passage="It is unclear whether loss-of-function variants in ODC1 lead to a distinct phenotype, although current evidence suggests that loss-of-function variants are unlikely to be deleterious",
                publication_date="2022",
                evidence_type="genereviews",
                evidence_strength="moderate",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:genotype:defines:babs",
            "source": "genotype:odc1_het_gof",
            "target": "disease:babs",
            "type": "genotype_defines",
            "plain_language": "Typical BABS genotype is heterozygous C-terminal GoF variation.",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/books/NBK583220/",
                supporting_passage="BABS is expressed in an autosomal dominant manner and typically caused by a de novo ODC1 pathogenic variant",
                publication_date="2022",
                evidence_type="genereviews",
                genotype_context="heterozygous, typically de novo GoF",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:genotype:has:K448X",
            "source": "genotype:odc1_het_gof",
            "target": "allele:ODC1_p.Lys448Ter",
            "type": "genotype_includes_allele",
            "plain_language": "Example genotype includes p.Lys448Ter.",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/clinvar/variation/983289/",
                supporting_passage="NM_002539.3(ODC1):c.1342A>T (p.Lys448Ter)",
                publication_date=None,
                evidence_type="clinvar_structured_record",
                evidence_strength="moderate",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:K448X:allele_of:ODC1",
            "source": "allele:ODC1_p.Lys448Ter",
            "target": "gene:ODC1",
            "type": "allele_of",
            "plain_language": "p.Lys448Ter is an allele of ODC1.",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/clinvar/variation/983289/",
                supporting_passage="Gene: ODC1",
                publication_date=None,
                evidence_type="clinvar_structured_record",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:Q419X:allele_of:ODC1",
            "source": "allele:ODC1_p.Gln419Ter",
            "target": "gene:ODC1",
            "type": "allele_of",
            "plain_language": "p.Gln419Ter is an allele of ODC1.",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/clinvar/variation/983287/",
                supporting_passage="ODC1 ClinVar record for Gln419Ter",
                publication_date=None,
                evidence_type="clinvar_structured_record",
                evidence_strength="moderate",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:G84R:allele_of:ODC1",
            "source": "allele:ODC1_p.Gly84Arg",
            "target": "gene:ODC1",
            "type": "allele_of",
            "plain_language": "G84R is an ODC1 allele outside the BABS C-terminal GoF cluster.",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/clinvar/variation/1299887/",
                supporting_passage="ODC1 p.Gly84Arg ClinVar record",
                publication_date=None,
                evidence_type="clinvar_structured_record",
                evidence_strength="moderate",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:clinvar:983289:record",
            "source": "clinvar:983289",
            "target": "allele:ODC1_p.Lys448Ter",
            "type": "clinvar_record_for_allele",
            "plain_language": "ClinVar variation 983289 records p.Lys448Ter.",
        }
    )
    b.add_edge(
        {
            "id": "edge:K448X:supports:gof",
            "source": "allele:ODC1_p.Lys448Ter",
            "target": "mechanism:odc1_c_terminal_gof",
            "type": "experiment_supports_mechanism",
            "plain_language": "Patient-cell biochemistry shows elevated ODC/putrescine for K448X — GoF, not LoF.",
            "evidence": b.ev(
                source_url="https://pubmed.ncbi.nlm.nih.gov/30063100/",
                supporting_passage="Red blood cells obtained from our patient showed elevated ODC protein and polyamine levels compared to healthy controls",
                publication_date="2018",
                evidence_type="peer_reviewed_article",
                experimental_context="Patient RBC ODC protein / polyamine measurements",
                evidence_strength="strong",
                limitations="Predicted nonsense consequence must not be read as enzyme loss.",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:G84R:assoc:lof_unresolved",
            "source": "allele:ODC1_p.Gly84Arg",
            "target": "disease:odc1_lof_unresolved",
            "type": "source_reports_association",
            "relationship_status": "hypothesis",
            "plain_language": "G84R is discussed in LoF/neurologic enrichment literature — association remains unresolved as a Mendelian disease.",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/books/NBK583220/",
                supporting_passage="One missense variant was enriched in a population of individuals with neurologic conditions (0.68% of such individuals) [Prokop et al 2021]",
                publication_date="2022",
                evidence_type="genereviews",
                population_context="0.68% enrichment figure as cited by GeneReviews from Prokop et al.; not a proven causal rate",
                evidence_strength="low",
                limitations="GeneReviews concludes LoF disease phenotype is unclear / unlikely deleterious.",
                contradictory_evidence="Later structural/enzymology work has questioned simple catalytic LoF interpretations for G84R.",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:babs:phenotype:alopecia",
            "source": "disease:babs",
            "target": "phenotype:alopecia",
            "type": "source_reports_association",
            "plain_language": "Early non-congenital alopecia is a hallmark BABS feature.",
            "evidence": b.ev(
                source_url="https://rarediseases.org/rare-diseases/bachmann-bupp-syndrome/",
                supporting_passage="hair loss in clumps begins in the first few weeks of life",
                publication_date="2023",
                evidence_type="nord_disease_page",
                evidence_strength="moderate",
                reporting_basis="NORD page last updated 2/21/2023 (retrieved 2026-10-03)",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:babs:phenotype:dd",
            "source": "disease:babs",
            "target": "phenotype:developmental_delay",
            "type": "source_reports_association",
            "plain_language": "Global developmental delay is commonly reported in BABS.",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/books/NBK583220/",
                supporting_passage="Developmental delay is evident early in life with both motor and speech delays",
                publication_date="2022",
                evidence_type="genereviews",
                evidence_strength="moderate",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:babs:phenotype:hypotonia",
            "source": "disease:babs",
            "target": "phenotype:hypotonia",
            "type": "source_reports_association",
            "plain_language": "Hypotonia is part of the BABS clinical picture.",
            "evidence": b.ev(
                source_url="https://rarediseases.org/rare-diseases/bachmann-bupp-syndrome/",
                supporting_passage="low muscle tone (hypotonia)",
                publication_date="2023",
                evidence_type="nord_disease_page",
                evidence_strength="moderate",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:pmid30063100:reports:babs",
            "source": "pmid:30063100",
            "target": "disease:babs",
            "type": "clinical_evidence_supports_outcome",
            "plain_language": "Bupp 2018 reports the index BABS / ODC1 GoF case.",
            "evidence": b.ev(
                source_url="https://pubmed.ncbi.nlm.nih.gov/30063100/",
                supporting_passage="Novel de novo pathogenic variant in the ODC1 gene in a girl with developmental delay, alopecia, and dysmorphic features",
                publication_date="2018",
                evidence_type="peer_reviewed_article",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:pmid30475435:reports:babs",
            "source": "pmid:30475435",
            "target": "disease:babs",
            "type": "clinical_evidence_supports_outcome",
            "plain_language": "Rodan 2018 adds further C-terminal GoF cases.",
            "evidence": b.ev(
                source_url="https://pubmed.ncbi.nlm.nih.gov/30475435/",
                supporting_passage="Gain-of-function variants in the ODC1 gene cause a syndromic neurodevelopmental disorder",
                publication_date="2018",
                evidence_type="peer_reviewed_article",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:pmid36007106:reports:babs",
            "source": "pmid:36007106",
            "target": "disease:babs",
            "type": "clinical_evidence_supports_outcome",
            "plain_language": "GeneReviews summarizes diagnosis, mechanism, and investigational DFMO status.",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/books/NBK583220/",
                supporting_passage="An experimental targeted treatment with difluoromethylornithine (DFMO) is being explored on a compassionate use basis; it is not currently an FDA-approved treatment for BABS",
                publication_date="2022",
                evidence_type="genereviews",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:dfmo:targets:ODC1",
            "source": "intervention:dfmo_eflornithine_investigational",
            "target": "gene:ODC1",
            "type": "intervention_targets",
            "plain_language": "DFMO inhibits ODC enzyme activity (pharmacologic target).",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/books/NBK583220/",
                supporting_passage="Difluoromethylornithine (DFMO). A compassionate-use protocol investigating the use of this drug in the targeted treatment of individuals with BABS",
                publication_date="2022",
                evidence_type="genereviews",
                evidence_strength="moderate",
                limitations="Targeting ODC ≠ regulatory approval for BABS.",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:dfmo:investigates:babs",
            "source": "intervention:dfmo_eflornithine_investigational",
            "target": "disease:babs",
            "type": "study_investigates_intervention",
            "plain_language": "DFMO is under investigational/compassionate-use evaluation for BABS — not labeled approved here.",
            "evidence": b.ev(
                source_url="https://rarediseases.org/rare-diseases/bachmann-bupp-syndrome/",
                supporting_passage="Under an investigational new drug approval through the FDA, a compassionate-use protocol is investigating the use of difluoromethylornithine (DFMO, also known as eflornithine)",
                publication_date="2023",
                evidence_type="nord_disease_page",
                evidence_strength="moderate",
                limitations="Time-sensitive status; verify before any outreach or claim.",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:icpd:asset_for:babs",
            "source": "asset:icpd",
            "target": "disease:babs",
            "type": "asset_developed_for",
            "plain_language": "ICPD is described as the center investigating DFMO for BABS/polyaminopathies.",
            "evidence": b.ev(
                source_url="https://rarediseases.org/rare-diseases/bachmann-bupp-syndrome/",
                supporting_passage="through the International Center for Polyamine Disorders",
                publication_date="2023",
                evidence_type="nord_disease_page",
                species="Homo sapiens",
                evidence_strength="moderate",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:nord:supports:babs",
            "source": "org:nord_babs",
            "target": "disease:babs",
            "type": "organization_supports_community",
            "plain_language": "NORD publishes a verified public BABS information page.",
            "evidence": b.ev(
                source_url="https://rarediseases.org/rare-diseases/bachmann-bupp-syndrome/",
                supporting_passage="Bachmann-Bupp Syndrome",
                publication_date="2023",
                evidence_type="nord_disease_page",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:snyder:related_support:babs",
            "source": "org:snyder_robinson",
            "target": "disease:babs",
            "type": "organization_supports_community",
            "relationship_status": "hypothesis",
            "plain_language": "Snyder-Robinson Foundation is listed as related polyaminopathy support — not BABS-only.",
            "evidence": b.ev(
                source_url="https://rarediseases.org/rare-diseases/bachmann-bupp-syndrome/",
                supporting_passage="Snyder-Robinson Foundation",
                publication_date="2023",
                evidence_type="nord_disease_page",
                evidence_strength="low",
                limitations="Primary mission is Snyder-Robinson syndrome; availability for BABS not claimed.",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:cancer_hypothesis:from:gene",
            "source": "gene:ODC1",
            "target": "hypothesis:odc1_cancer_expression_separate",
            "type": "proposed_cross_disease_connection",
            "relationship_status": "hypothesis",
            "plain_language": "Cancer expression biology shares the gene name but is kept as a separate non-germline context.",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/books/NBK583220/",
                supporting_passage="Due to its role in neoplastic cell growth and proliferation, the polyamine pathway and ODC are ...",
                publication_date="2022",
                evidence_type="genereviews",
                evidence_strength="low",
                limitations="Do not treat cancer upregulation as BABS mechanism or shared treatment proof.",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:dfmo:leads_to:question",
            "source": "intervention:dfmo_eflornithine_investigational",
            "target": "question:odc1_dfmo_evidence_and_lof_gap",
            "type": "suggests_next_research_step",
            "relationship_status": "hypothesis",
            "plain_language": "Investigational DFMO status motivates a concrete evidence/access question.",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/books/NBK583220/",
                supporting_passage="it is not currently an FDA-approved treatment for BABS",
                publication_date="2022",
                evidence_type="genereviews",
                evidence_strength="moderate",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:icpd:could_inform:question",
            "source": "asset:icpd",
            "target": "question:odc1_dfmo_evidence_and_lof_gap",
            "type": "potential_collaborator_for",
            "relationship_status": "hypothesis",
            "plain_language": "ICPD may inform DFMO protocol/status questions — availability not claimed.",
            "evidence": b.ev(
                source_url="https://rarediseases.org/rare-diseases/bachmann-bupp-syndrome/",
                supporting_passage="compassionate-use protocol is investigating the use of difluoromethylornithine ... through the International Center for Polyamine Disorders",
                publication_date="2023",
                evidence_type="nord_disease_page",
                evidence_strength="moderate",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:nord:could_inform:question",
            "source": "org:nord_babs",
            "target": "question:odc1_dfmo_evidence_and_lof_gap",
            "type": "potential_collaborator_for",
            "relationship_status": "hypothesis",
            "plain_language": "NORD page is a public information partner lead for families — not a treatment recommender.",
            "evidence": b.ev(
                source_url="https://rarediseases.org/rare-diseases/bachmann-bupp-syndrome/",
                supporting_passage="Current treatment is aimed at the specific symptoms present in each individual",
                publication_date="2023",
                evidence_type="nord_disease_page",
                evidence_strength="moderate",
            ),
        }
    )

    b.log(
        "accept",
        "BABS is caused by heterozygous ODC1 C-terminal gain-of-function variants",
        reason="GeneReviews, OMIM 619075, Bupp/Rodan papers",
        sources=["PMID:30063100", "PMID:30475435", "NBK583220", "OMIM:619075"],
    )
    b.log(
        "accept",
        "DFMO/eflornithine for BABS is investigational / compassionate-use, not FDA-approved for BABS",
        reason="GeneReviews and NORD explicit statements",
        sources=["NBK583220", "https://rarediseases.org/rare-diseases/bachmann-bupp-syndrome/"],
    )
    b.log(
        "accept",
        "Keep predicted truncation distinct from functional loss for K448X",
        reason="Patient biochemistry shows elevated ODC/putrescine (GoF)",
        sources=["PMID:30063100"],
    )
    b.log(
        "reject",
        "ODC1 loss-of-function is an established Mendelian disease equivalent to BABS",
        reason="GeneReviews: LoF phenotype unclear / unlikely deleterious",
        sources=["NBK583220"],
        status="rejected",
    )
    b.log(
        "reject",
        "Cancer ODC1 upregulation is the same disease mechanism as BABS",
        reason="Somatic/expression oncology context ≠ germline C-terminal GoF syndrome",
        sources=["NBK583220", "hackathon notes caution"],
        status="rejected",
    )
    b.log(
        "reject",
        "Infer BABS pathogenicity from any pLoF annotation automatically",
        reason="BABS alleles are GoF C-terminal cluster; pLoF rules would misclassify mechanism",
        sources=["PMID:38671509", "NBK583220"],
        status="rejected",
    )
    b.log(
        "unresolved",
        "Whether G84R has any Mendelian disease role",
        reason="Enrichment reports exist but causation not established; functional interpretations contested",
        sources=["PMID:33806076", "NBK583220"],
        status="unresolved",
    )
    b.log(
        "unresolved",
        "Current number of patients on DFMO and open/closed compassionate-use status",
        reason="Time-sensitive; NORD/GeneReviews describe IND/compassionate-use without freezing enrollment counts here",
        sources=["NBK583220", "NORD BABS page"],
        status="unresolved",
    )

    journey = {
        "id": "journey:odc1_babs_research_discovery",
        "title": "ODC1 / BABS research discovery journey",
        "intended_user": "Patient-group organizer or rare-disease research coordinator",
        "plain_language": (
            "Start from Bachmann-Bupp syndrome, follow C-terminal gain-of-function biology "
            "(not loss-of-function), connect to GeneReviews/NORD evidence, then to ICPD "
            "investigational DFMO research and a next question that keeps LoF and cancer "
            "contexts separate. No approval or treatment recommendation is asserted."
        ),
        "node_path": [
            "disease:babs",
            "gene:ODC1",
            "mechanism:odc1_c_terminal_gof",
            "allele:ODC1_p.Lys448Ter",
            "pmid:30063100",
            "pmid:36007106",
            "intervention:dfmo_eflornithine_investigational",
            "asset:icpd",
            "org:nord_babs",
            "disease:odc1_lof_unresolved",
            "question:odc1_dfmo_evidence_and_lof_gap",
        ],
        "edge_path": [
            "edge:mechanism:gof:relevant:babs",
            "edge:gene:ODC1:participates:polyamine",
            "edge:K448X:supports:gof",
            "edge:pmid30063100:reports:babs",
            "edge:pmid36007106:reports:babs",
            "edge:dfmo:investigates:babs",
            "edge:icpd:asset_for:babs",
            "edge:nord:supports:babs",
            "edge:lof_disease:related_distinct:babs",
            "edge:dfmo:leads_to:question",
            "edge:icpd:could_inform:question",
        ],
        "answers": {
            "relevant_communities": ["org:nord_babs", "org:snyder_robinson"],
            "existing_assets": ["asset:icpd", "intervention:dfmo_eflornithine_investigational"],
            "who_could_help": ["asset:icpd", "org:nord_babs"],
            "next_step": (
                "Verify current ICPD compassionate-use DFMO public information and keep LoF/"
                "cancer claims labeled unresolved/separate in any collaboration brief."
            ),
        },
    }

    demo = build_demo()
    gaps = """# ODC1 curated-layer gaps

- DFMO approval status for BABS is explicitly investigational (not asserted as approved).
- LoF Mendelian disease association unresolved (shown as separate node).
- Cancer ODC1 upregulation kept as a separation hypothesis, not a BABS edge for treatment.
- Bachmann-Bupp Family Coalition mentioned in literature was not given a standalone verified website node.
- No cross-edges to HBB, ARID1B, or GATA6.
"""
    summary = f"""# ODC1 collection summary

- Dataset: odc1
- Journey status: complete (for established BABS GoF path; LoF/cancer gaps explicit)
- Retrieval date: {RETRIEVAL_DATE}
- Curated nodes: {len(b.nodes)}
- Curated edges: {len(b.edges)}
- Anchor sources: PMID 30063100, 30475435; GeneReviews NBK583220; NORD BABS page
- Expert reviewed: false
"""
    write_outputs(
        OUTPUT,
        dataset_id="odc1",
        focus_gene="ODC1",
        builder=b,
        journey=journey,
        demo=demo,
        gaps=gaps,
        summary=summary,
    )
    print(f"ODC1 curated graph written: nodes={len(b.nodes)} edges={len(b.edges)}")


def build_demo() -> dict:
    return {
        "product_one_liner": "Search a rare disease and follow sourced connections to related biology, communities, and research assets.",
        "product_name": "Rare Disease Atlas",
        "dataset_id": "odc1",
        "dataset_label": "ODC1 / Bachmann-Bupp syndrome",
        "journey_status": "complete",
        "journey_status_note": "Complete path for established BABS GoF → investigational DFMO/ICPD → next question. LoF and cancer contexts remain explicit gaps/separations.",
        "default_focus_id": "disease:babs",
        "default_partner_id": "org:nord_babs",
        "default_asset_ids": [
            "asset:icpd",
            "intervention:dfmo_eflornithine_investigational",
        ],
        "landing_disclaimer": "DFMO for BABS is investigational/compassionate-use in this curated layer — not an approval claim.",
        "example_searches": [
            {"label": "Bachmann-Bupp", "query": "Bachmann-Bupp"},
            {"label": "ODC1", "query": "ODC1"},
            {"label": "DFMO", "query": "DFMO"},
        ],
        "search_entries": [
            {
                "id": "disease:babs",
                "label": "Bachmann-Bupp syndrome (BABS)",
                "category": "disease",
                "disambiguation_note": "Established ODC1 C-terminal gain-of-function disorder. Distinct from unresolved LoF leads.",
                "synonyms": [
                    "bachmann-bupp",
                    "bachmann bupp",
                    "babs",
                    "odc1-related neurodevelopmental disorder",
                    "nedaba",
                ],
            },
            {
                "id": "disease:odc1_lof_unresolved",
                "label": "ODC1 loss-of-function neurologic association (unresolved)",
                "category": "disease",
                "disambiguation_note": "Not established Mendelian disease; kept separate from BABS.",
                "synonyms": ["odc1 lof", "odc1 loss of function", "g84r"],
            },
            {
                "id": "gene:ODC1",
                "label": "ODC1",
                "category": "gene",
                "disambiguation_note": "Ornithine decarboxylase 1 gene.",
                "synonyms": ["odc1", "ornithine decarboxylase", "odc"],
            },
            {
                "id": "allele:ODC1_p.Lys448Ter",
                "label": "ODC1 p.Lys448Ter (K448X)",
                "category": "variant",
                "disambiguation_note": "C-terminal nonsense with GoF biochemistry — not enzyme loss.",
                "synonyms": ["k448x", "p.lys448ter", "c.1342a>t"],
            },
            {
                "id": "mechanism:odc1_c_terminal_gof",
                "label": "ODC1 C-terminal gain-of-function",
                "category": "mechanism",
                "disambiguation_note": "Reduced degradation / accumulated active ODC.",
                "synonyms": ["odc1 gain of function", "c-terminal gof", "gain-of-function"],
            },
            {
                "id": "intervention:dfmo_eflornithine_investigational",
                "label": "DFMO / eflornithine (investigational for BABS)",
                "category": "intervention",
                "disambiguation_note": "Investigational/compassionate-use for BABS — not asserted as approved for BABS.",
                "synonyms": ["dfmo", "eflornithine", "difluoromethylornithine"],
            },
            {
                "id": "org:nord_babs",
                "label": "NORD Bachmann-Bupp page",
                "category": "organization",
                "disambiguation_note": "Umbrella rare-disease organization page for BABS.",
                "synonyms": ["nord", "nord bachmann-bupp"],
            },
        ],
        "category_legend": default_legend(),
        "stages": [
            {
                "id": "understand",
                "label": "Understand the connection",
                "summary": "Follow BABS to C-terminal GoF biology and keep unresolved LoF separate.",
                "anchor_node_id": "disease:babs",
                "preferred_edge_id": "edge:mechanism:gof:relevant:babs",
                "node_ids": [
                    "disease:babs",
                    "genotype:odc1_het_gof",
                    "allele:ODC1_p.Lys448Ter",
                    "allele:ODC1_p.Gln419Ter",
                    "gene:ODC1",
                    "protein:ODC",
                    "mechanism:odc1_c_terminal_gof",
                    "process:polyamine_biosynthesis",
                    "phenotype:alopecia",
                    "phenotype:developmental_delay",
                    "disease:odc1_lof_unresolved",
                    "allele:ODC1_p.Gly84Arg",
                ],
                "edge_ids": [
                    "edge:genotype:defines:babs",
                    "edge:genotype:has:K448X",
                    "edge:K448X:allele_of:ODC1",
                    "edge:gene:ODC1:encodes:protein",
                    "edge:gene:ODC1:participates:polyamine",
                    "edge:process:polyamine:supports:gof",
                    "edge:mechanism:gof:relevant:babs",
                    "edge:K448X:supports:gof",
                    "edge:babs:phenotype:alopecia",
                    "edge:babs:phenotype:dd",
                    "edge:lof_disease:related_distinct:babs",
                    "edge:G84R:assoc:lof_unresolved",
                ],
            },
            {
                "id": "explore",
                "label": "Explore resources",
                "summary": "GeneReviews/NORD evidence, investigational DFMO, ICPD, and related polyaminopathy support — with approval caveats.",
                "anchor_node_id": "disease:babs",
                "preferred_edge_id": "edge:dfmo:investigates:babs",
                "node_ids": [
                    "disease:babs",
                    "mechanism:odc1_c_terminal_gof",
                    "pmid:30063100",
                    "pmid:30475435",
                    "pmid:36007106",
                    "intervention:dfmo_eflornithine_investigational",
                    "asset:icpd",
                    "org:nord_babs",
                    "org:snyder_robinson",
                    "hypothesis:odc1_cancer_expression_separate",
                    "gene:ODC1",
                ],
                "edge_ids": [
                    "edge:mechanism:gof:relevant:babs",
                    "edge:pmid30063100:reports:babs",
                    "edge:pmid30475435:reports:babs",
                    "edge:pmid36007106:reports:babs",
                    "edge:dfmo:targets:ODC1",
                    "edge:dfmo:investigates:babs",
                    "edge:icpd:asset_for:babs",
                    "edge:nord:supports:babs",
                    "edge:snyder:related_support:babs",
                    "edge:cancer_hypothesis:from:gene",
                ],
            },
            {
                "id": "prepare",
                "label": "Prepare next step",
                "summary": "Prepare a sourced brief about DFMO evidence/access without approving therapy or merging LoF leads.",
                "anchor_node_id": "question:odc1_dfmo_evidence_and_lof_gap",
                "preferred_edge_id": "edge:dfmo:leads_to:question",
                "node_ids": [
                    "question:odc1_dfmo_evidence_and_lof_gap",
                    "intervention:dfmo_eflornithine_investigational",
                    "asset:icpd",
                    "org:nord_babs",
                    "disease:odc1_lof_unresolved",
                ],
                "edge_ids": [
                    "edge:dfmo:leads_to:question",
                    "edge:icpd:could_inform:question",
                    "edge:nord:could_inform:question",
                ],
            },
        ],
        "edge_plain_language": {
            "edge:mechanism:gof:relevant:babs": "C-terminal gain-of-function is the established BABS mechanism.",
            "edge:K448X:supports:gof": "K448X shows elevated ODC/putrescine — predicted truncation ≠ loss of function.",
            "edge:lof_disease:related_distinct:babs": "Unresolved LoF associations are kept distinct from BABS.",
            "edge:dfmo:investigates:babs": "DFMO is investigational/compassionate-use for BABS, not asserted as approved.",
            "edge:icpd:asset_for:babs": "ICPD is the research center described for DFMO investigation.",
            "edge:nord:supports:babs": "NORD provides a verified public BABS information page.",
        },
        "asset_assessments": [
            {
                "asset_id": "asset:icpd",
                "asset_kind": "research_center",
                "title": "International Center for Polyamine Disorders (ICPD)",
                "description": "Translational/clinical program described as investigating DFMO compassionate-use for BABS.",
                "owner": "Corewell Health / Michigan State University collaboration (as described in public pages)",
                "source_url": "https://rarediseases.org/rare-diseases/bachmann-bupp-syndrome/",
                "designed_for": {
                    "disease": "Polyaminopathies including BABS",
                    "genotype": "ODC1 GoF / related disorders",
                    "population": "Ultra-rare diagnosed patients (verify eligibility)",
                    "species": "Homo sapiens",
                },
                "access": "Described via NORD/GeneReviews; verify current contact. Atlas sends nothing automatically.",
                "relevance_to_journey": "Primary research asset for investigational DFMO pathway questions.",
                "comparison": {
                    "may_be_reusable": [
                        "Compassionate-use / IND framing for collaboration briefs",
                        "Polyaminopathy natural-history research model"
                    ],
                    "what_differs": [
                        "Investigational access ≠ regulatory approval",
                        "BABS GoF biology ≠ cancer ODC1 expression context"
                    ],
                    "needs_expert_review": [
                        "Current protocol status and eligibility",
                        "What can be stated publicly vs requires direct contact"
                    ],
                    "adaptation_status": "Potential collaboration to investigate",
                    "validation_question": "What public evidence exists today for DFMO compassionate-use status in BABS?",
                },
            },
            {
                "asset_id": "intervention:dfmo_eflornithine_investigational",
                "asset_kind": "investigational_intervention",
                "title": "DFMO / eflornithine (investigational for BABS)",
                "description": "ODC inhibitor used under compassionate-use/IND investigation for BABS per GeneReviews/NORD.",
                "owner": "Various; BABS investigation described via ICPD",
                "source_url": "https://www.ncbi.nlm.nih.gov/books/NBK583220/",
                "designed_for": {
                    "disease": "BABS (investigational)",
                    "genotype": "ODC1 C-terminal GoF",
                    "population": "Diagnosed BABS patients under protocol",
                    "species": "Homo sapiens",
                },
                "access": "Not presented as generally available approved therapy for BABS.",
                "relevance_to_journey": "Concrete intervention node that must keep approval status honest.",
                "comparison": {
                    "may_be_reusable": [
                        "Mechanism-aligned inhibitor rationale for expert discussion"
                    ],
                    "what_differs": [
                        "FDA-approved uses in other indications ≠ BABS approval",
                        "Individual-patient reports ≠ population efficacy"
                    ],
                    "needs_expert_review": [
                        "How to discuss benefits/risks without overclaiming",
                        "Whether any formal trial registry record should be cited"
                    ],
                    "adaptation_status": "Investigational — not approved for BABS in this atlas",
                    "validation_question": "Which public sources should a brief cite for DFMO status without implying approval?",
                },
            },
            {
                "asset_id": "org:nord_babs",
                "asset_kind": "patient_organization",
                "title": "NORD Bachmann-Bupp syndrome information page",
                "description": "Public rare-disease information page with clinical summary and research pointers.",
                "owner": "National Organization for Rare Disorders",
                "source_url": "https://rarediseases.org/rare-diseases/bachmann-bupp-syndrome/",
                "designed_for": {
                    "disease": "Bachmann-Bupp syndrome",
                    "genotype": "Community-level",
                    "population": "Patients, families, clinicians",
                    "species": None,
                },
                "access": "Public webpage.",
                "relevance_to_journey": "Verified community-facing information partner lead.",
                "comparison": {
                    "may_be_reusable": ["Family-facing disease summary language"],
                    "what_differs": ["Umbrella org page ≠ BABS-only foundation"],
                    "needs_expert_review": ["Whether NORD can connect to family coalitions"],
                    "adaptation_status": "Information resource",
                    "validation_question": "What community priorities should appear alongside investigational DFMO language?",
                },
            },
            {
                "asset_id": "org:snyder_robinson",
                "asset_kind": "patient_organization",
                "title": "Snyder-Robinson Foundation",
                "description": "Related polyaminopathy advocacy organization listed in NORD BABS resources.",
                "owner": "Snyder-Robinson Foundation",
                "source_url": "https://www.snyder-robinson.org/",
                "designed_for": {
                    "disease": "Snyder-Robinson syndrome (primary); polyaminopathy community overlap",
                    "genotype": "Not ODC1-specific",
                    "population": "Polyaminopathy families/research stakeholders",
                    "species": None,
                },
                "access": "Public website.",
                "relevance_to_journey": "Possible adjacent collaborator; not a BABS-only org.",
                "comparison": {
                    "may_be_reusable": ["Polyaminopathy community networking patterns"],
                    "what_differs": ["Different primary gene/disease"],
                    "needs_expert_review": ["Whether they advise on BABS questions"],
                    "adaptation_status": "Potential adjacent collaboration",
                    "validation_question": "Can Snyder-Robinson advise on polyaminopathy research infrastructure relevant to BABS without implying shared treatments?",
                },
            },
        ],
        "registry_gap": {
            "status": "investigational_treatment_present_formal_registry_not_verified",
            "explanation": (
                "ICPD/DFMO investigational pathway is publicly described, but this slice does not "
                "include a verified standalone BABS patient registry with a confirmed data-access SOP."
            ),
            "missing_evidence": [
                "Standalone BABS registry name/owner/access process",
                "Current DFMO compassionate-use enrollment status frozen with a retrieval date"
            ],
            "next_question": "Is there a publicly documented BABS registry distinct from ICPD clinical investigation?",
        },
        "unsupported_search": {
            "sources_searched": [
                "Curated ODC1/BABS demonstration layer (GeneReviews, NORD, ClinVar GoF alleles, ICPD/DFMO investigational framing)",
                "Other curated datasets remain separate"
            ],
            "coverage_note": "Coverage is limited to curated demonstration datasets in this prototype.",
        },
        "proposal_defaults": {
            "research_question": (
                "What evidence is still needed to evaluate DFMO access pathways for BABS without "
                "conflating unresolved ODC1 loss-of-function associations or cancer-expression findings?"
            ),
            "proposed_next_step": (
                "Review GeneReviews/NORD DFMO status language with ICPD public materials, list what "
                "remains investigational, and keep G84R/LoF and cancer upregulation in a separate "
                "unresolved section of the brief."
            ),
            "partner_gap_if_unknown": "No individual clinician availability is asserted. Use public organization contacts after human verification.",
        },
        "unsupported_missing_evidence": [
            "A curated entity match for this query in the demonstration layer",
            "A reviewed edge connecting it into a curated dataset journey without merging unrelated disease labels",
        ],
        "unsupported_next_question_template": (
            'What primary public source would establish whether "{query}" belongs in the '
            "Rare Disease Atlas curated layer, and which disease scope should it be mapped "
            "to without merging synonyms?"
        ),
    }


if __name__ == "__main__":
    curate()
