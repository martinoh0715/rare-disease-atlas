#!/usr/bin/env python3
"""Curate GATA6-related disorders demonstration layer."""

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
            "id": "gene:GATA6",
            "type": "gene",
            "label": "GATA6",
            "full_name": "GATA binding protein 6",
            "chromosome": "18q11.2",
            "omim": "OMIM:601656",
            "plain_language": "Transcription-factor gene important for pancreas, heart, and other endoderm-derived organs.",
        }
    )
    b.add_node(
        {
            "id": "protein:GATA6",
            "type": "protein",
            "label": "GATA6 transcription factor",
            "plain_language": "Protein product of GATA6 that regulates developmental gene expression.",
        }
    )
    b.add_node(
        {
            "id": "disease:hdca_gata6",
            "type": "disease",
            "label": "Pancreatic agenesis/hypoplasia with congenital heart defects (OMIM 600001)",
            "mondo": "MONDO:0100540",
            "orphanet": "Orphanet:2255",
            "omim": "OMIM:600001",
            "genotype_scope": "Heterozygous pathogenic GATA6 variant",
            "plain_language": "Autosomal-dominant developmental disorder linking pancreatic agenesis/hypoplasia with congenital heart defects.",
        }
    )
    b.add_node(
        {
            "id": "disease:gata6_spectrum",
            "type": "disease",
            "label": "GATA6-related diabetes / developmental spectrum",
            "plain_language": "Gene-centered umbrella from pancreatic agenesis to later-onset diabetes with variable exocrine and cardiac features.",
            "notes": "Gene-centered collection ≠ automatic single mechanism for every presentation.",
        }
    )
    b.add_node(
        {
            "id": "disease:gata6_chd",
            "type": "disease",
            "label": "GATA6-related congenital heart disease",
            "plain_language": "Cardiac malformations associated with heterozygous GATA6 variants, with or without pancreatic features.",
        }
    )
    b.add_node(
        {
            "id": "mechanism:gata6_haploinsufficiency",
            "type": "mechanism",
            "label": "GATA6 haploinsufficiency",
            "plain_language": "One impaired GATA6 copy is not enough for typical organ development in many affected people. Allele-level functional proof still varies.",
        }
    )
    b.add_node(
        {
            "id": "process:endoderm_organogenesis",
            "type": "biological_process",
            "label": "Endoderm organogenesis (pancreas / heart / gut)",
            "plain_language": "Developmental programs forming pancreas, heart outflow structures, and related organs.",
        }
    )
    b.add_node(
        {
            "id": "phenotype:pancreatic_agenesis",
            "type": "phenotype",
            "label": "Pancreatic agenesis / severe hypoplasia",
            "plain_language": "Absent or severely underdeveloped pancreas causing neonatal diabetes and exocrine insufficiency when present.",
        }
    )
    b.add_node(
        {
            "id": "phenotype:congenital_heart_defect",
            "type": "phenotype",
            "label": "Congenital heart defect (often outflow tract)",
            "plain_language": "Structural heart malformations; common but not universal across every GATA6 presentation.",
        }
    )
    b.add_node(
        {
            "id": "phenotype:neonatal_diabetes",
            "type": "phenotype",
            "label": "Neonatal / early-onset diabetes",
            "plain_language": "Insulin-requiring diabetes presenting neonatally or in early life in many ascertained cases.",
        }
    )
    b.add_node(
        {
            "id": "allele:GATA6_p.Lys502fs",
            "type": "allele",
            "label": "GATA6 p.Lys502fs",
            "hgvs_c": "NM_005257.6:c.1504_1505del",
            "hgvs_p_modern": "p.Lys502fs",
            "reference_transcript": "NM_005257.6",
            "clinvar_variation_id": "39844",
            "predicted_molecular_consequence": "frameshift / predicted LoF",
            "plain_language": "Representative frameshift allele. Family reports show variable diabetes severity — presentation is not identical across carriers.",
        }
    )
    b.add_node(
        {
            "id": "allele:GATA6_p.Arg493Ter",
            "type": "allele",
            "label": "GATA6 p.Arg493Ter",
            "hgvs_c": "NM_005257.6:c.1477C>T",
            "hgvs_p_modern": "p.Arg493Ter",
            "reference_transcript": "NM_005257.6",
            "clinvar_variation_id": "653141",
            "predicted_molecular_consequence": "nonsense / predicted LoF",
            "experimentally_observed_effect": "NMD with reduced GATA6 transcript reported in patient blood RNA (Suzuki et al.)",
            "plain_language": "Nonsense allele with published NMD evidence — predicted consequence supported experimentally for this allele.",
        }
    )
    b.add_node(
        {
            "id": "clinvar:39844",
            "type": "variant",
            "label": "ClinVar VCV000039844 (p.Lys502fs)",
            "clinvar_variation_id": "39844",
            "source_url": "https://www.ncbi.nlm.nih.gov/clinvar/variation/39844/",
        }
    )
    b.add_node(
        {
            "id": "clinvar:653141",
            "type": "variant",
            "label": "ClinVar VCV000653141 (p.Arg493Ter)",
            "clinvar_variation_id": "653141",
            "source_url": "https://www.ncbi.nlm.nih.gov/clinvar/variation/653141/",
        }
    )
    b.add_node(
        {
            "id": "genotype:gata6_het",
            "type": "genotype",
            "label": "Heterozygous GATA6 pathogenic genotype (typical)",
            "genotype_scope": "One pathogenic GATA6 allele + one reference allele; often de novo; mosaicism reported in parents",
            "plain_language": "Typical genotype context is heterozygous — not a recessive homozygous structure.",
        }
    )
    b.add_node(
        {
            "id": "pmid:22158542",
            "type": "publication",
            "label": "Allen et al. 2012 — GATA6 haploinsufficiency causes pancreatic agenesis",
            "pmid": "22158542",
            "pubdate": "2012",
            "journal": "Nat Genet",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/22158542/",
            "plain_language": "Found de novo heterozygous inactivating GATA6 variants in 15/27 (56%) pancreatic-agenesis patients in that cohort.",
        }
    )
    b.add_node(
        {
            "id": "pmid:23223019",
            "type": "publication",
            "label": "De Franco et al. 2013 — broad GATA6 diabetes spectrum",
            "pmid": "23223019",
            "pubdate": "2013",
            "journal": "Diabetes",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/23223019/",
            "plain_language": "Expands presentations from pancreatic agenesis to later-onset diabetes; congenital heart defects frequent among probands (source-attributed).",
        }
    )
    b.add_node(
        {
            "id": "pmid:24310933",
            "type": "publication",
            "label": "Suzuki et al. 2014 — NMD evidence for GATA6 p.Arg493Ter",
            "pmid": "24310933",
            "pubdate": "2014",
            "journal": "Am J Med Genet A",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/24310933/",
            "plain_language": "Reports nonsense-mediated decay supporting haploinsufficiency for a nonsense allele.",
        }
    )
    b.add_node(
        {
            "id": "asset:uchicago_monogenic_diabetes_registry",
            "type": "research_asset",
            "label": "University of Chicago Monogenic Diabetes Registry",
            "species": "Homo sapiens",
            "source_url": "https://monogenicdiabetes.uchicago.edu/",
            "access_info": "Public registry/research program pages. Participation and data access require contacting the program; no participant-level data in this atlas.",
            "plain_language": "Longitudinal monogenic-diabetes research registry that includes GATA6 among genes discussed on public pages.",
        }
    )
    b.add_node(
        {
            "id": "asset:exeter_neonatal_diabetes_testing",
            "type": "research_asset",
            "label": "Exeter / PanelApp neonatal diabetes gene testing context",
            "source_url": "https://panelapp.genomicsengland.co.uk/panels/293/gene/GATA6/",
            "access_info": "Public gene-panel curation page (Green gene). Not a patient organization.",
            "plain_language": "Shows GATA6 is an established neonatal-diabetes panel gene in UK/GMS curation.",
        }
    )
    b.add_node(
        {
            "id": "org:international_pancreatic_agenesis_consortium",
            "type": "organization",
            "label": "International Pancreatic Agenesis Consortium (research authorship group)",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/22158542/",
            "access_info": "Consortium listed as co-author group on Allen et al.; no standalone public patient-org site verified here.",
            "plain_language": "Research consortium that ascertained pancreatic-agenesis cases for GATA6 discovery — not verified as an ongoing patient foundation.",
            "notes": "Partner availability and current contact pathway not established in this curated slice.",
        }
    )
    b.add_node(
        {
            "id": "gap:gata6_dedicated_patient_org",
            "type": "research_question",
            "label": "Gap: no verified GATA6-dedicated patient foundation in this slice",
            "plain_language": "Unlike FAR for ARID1B, a GATA6-only advocacy organization with a primary public site was not verified here.",
            "uncertainties": [
                "Whether a dedicated org exists under another name",
                "Whether CHD or neonatal-diabetes orgs can speak for GATA6-specific priorities",
            ],
        }
    )
    b.add_node(
        {
            "id": "question:gata6_partner_and_natural_history_gap",
            "type": "research_question",
            "label": "Which public natural-history or community partner can support genotype-aware GATA6 research questions?",
            "plain_language": "Next step focuses on filling the partner/natural-history gap without inventing a foundation or treatment claim.",
            "uncertainties": [
                "No dedicated GATA6 foundation verified",
                "Registry access pathways need human verification",
                "Cardiac-only vs pancreatic-agenesis cohorts may need different endpoints",
            ],
            "validation_questions": [
                "Can the Chicago Monogenic Diabetes Registry support GATA6-specific queries with documented consent/access?",
                "Which CHD vs pancreatic endpoints should remain separate in any brief?",
            ],
        }
    )

    # Edges
    b.add_edge(
        {
            "id": "edge:gene:GATA6:encodes:protein",
            "source": "gene:GATA6",
            "target": "protein:GATA6",
            "type": "encodes",
            "plain_language": "GATA6 encodes the GATA6 transcription factor.",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/gene/2627",
                supporting_passage="GATA6 GATA binding protein 6 [Homo sapiens (human)]",
                publication_date=None,
                evidence_type="structured_database",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:gene:GATA6:participates:endoderm",
            "source": "gene:GATA6",
            "target": "process:endoderm_organogenesis",
            "type": "gene_participates_in_process",
            "plain_language": "GATA6 participates in endoderm organogenesis relevant to pancreas and heart.",
            "evidence": b.ev(
                source_url="https://pubmed.ncbi.nlm.nih.gov/22158542/",
                supporting_passage="establish a key role for the transcription factor GATA6 in human pancreatic development",
                publication_date="2012",
                evidence_type="peer_reviewed_article",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:process:endoderm:supports:haploinsufficiency",
            "source": "process:endoderm_organogenesis",
            "target": "mechanism:gata6_haploinsufficiency",
            "type": "experiment_supports_mechanism",
            "plain_language": "Developmental dosage sensitivity frames GATA6 haploinsufficiency.",
            "evidence": b.ev(
                source_url="https://pubmed.ncbi.nlm.nih.gov/22158542/",
                supporting_passage="GATA6 haploinsufficiency causes pancreatic agenesis in humans",
                publication_date="2012",
                evidence_type="peer_reviewed_article",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:mechanism:haplo:relevant:spectrum",
            "source": "mechanism:gata6_haploinsufficiency",
            "target": "disease:gata6_spectrum",
            "type": "mechanism_relevant_to_disease",
            "plain_language": "Haploinsufficiency is the primary mechanism framing across the GATA6 spectrum.",
            "evidence": b.ev(
                source_url="https://pubmed.ncbi.nlm.nih.gov/22158542/",
                supporting_passage="de novo heterozygous inactivating mutations in GATA6 in 15/27 (56%) individuals with pancreatic agenesis",
                publication_date="2012",
                evidence_type="peer_reviewed_article",
                population_context="15/27 pancreatic-agenesis cohort (Allen et al. 2012), not a general-population rate",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:mechanism:haplo:relevant:hdca",
            "source": "mechanism:gata6_haploinsufficiency",
            "target": "disease:hdca_gata6",
            "type": "mechanism_relevant_to_disease",
            "plain_language": "Heterozygous GATA6 mutation causes OMIM 600001 / HDCA framing.",
            "evidence": b.ev(
                source_url="https://omim.org/entry/600001",
                supporting_passage="congenital heart defects and other congenital anomalies (HDCA) is caused by heterozygous mutation in the GATA6 gene",
                publication_date=None,
                evidence_type="omim_clinical_synopsis",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:hdca:narrower:spectrum",
            "source": "disease:hdca_gata6",
            "target": "disease:gata6_spectrum",
            "type": "narrower_than",
            "plain_language": "OMIM 600001 pancreatic+heart framing is a narrower clinical subset within the broader GATA6 spectrum language.",
            "evidence": b.ev(
                source_url="https://pubmed.ncbi.nlm.nih.gov/23223019/",
                supporting_passage="Heterozygous GATA6 mutations cause a wide spectrum of diabetes manifestations, ranging from pancreatic agenesis to adult-onset diabetes",
                publication_date="2013",
                evidence_type="peer_reviewed_article",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:chd:related_distinct:hdca",
            "source": "disease:gata6_chd",
            "target": "disease:hdca_gata6",
            "type": "related_but_distinct_from",
            "plain_language": "Cardiac-focused GATA6 disease language overlaps HDCA but is kept distinct when pancreas features are absent or unproven.",
            "evidence": b.ev(
                source_url="https://search.clinicalgenome.org/kb/gene-validity/CGGV:assertion_a7a0fdd7-f796-4921-95b6-709fd859b6d3-2023-11-21T170000.000Z",
                supporting_passage="GATA6 is definitively associated with autosomal dominant GATA6-related congenital heart disease with or without pancreatic agenesis or neonatal diabetes",
                publication_date="2023",
                evidence_type="clingen_gene_validity",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:genotype:defines:spectrum",
            "source": "genotype:gata6_het",
            "target": "disease:gata6_spectrum",
            "type": "genotype_defines",
            "plain_language": "Typical disease-associated genotype context is heterozygous GATA6 variation.",
            "evidence": b.ev(
                source_url="https://pubmed.ncbi.nlm.nih.gov/22158542/",
                supporting_passage="de novo heterozygous inactivating mutations in GATA6",
                publication_date="2012",
                evidence_type="peer_reviewed_article",
                genotype_context="heterozygous, often de novo",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:genotype:has:Lys502fs",
            "source": "genotype:gata6_het",
            "target": "allele:GATA6_p.Lys502fs",
            "type": "genotype_includes_allele",
            "plain_language": "Example heterozygous genotype can include p.Lys502fs.",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/clinvar/variation/39844/",
                supporting_passage="NM_005257.6(GATA6):c.1504_1505del (p.Lys502fs)",
                publication_date=None,
                evidence_type="clinvar_structured_record",
                evidence_strength="moderate",
                limitations="Illustrative allele; variable expressivity reported in family literature.",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:Lys502fs:allele_of:GATA6",
            "source": "allele:GATA6_p.Lys502fs",
            "target": "gene:GATA6",
            "type": "allele_of",
            "plain_language": "p.Lys502fs is an allele of GATA6.",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/clinvar/variation/39844/",
                supporting_passage="Gene: GATA6",
                publication_date=None,
                evidence_type="clinvar_structured_record",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:Arg493Ter:allele_of:GATA6",
            "source": "allele:GATA6_p.Arg493Ter",
            "target": "gene:GATA6",
            "type": "allele_of",
            "plain_language": "p.Arg493Ter is an allele of GATA6.",
            "evidence": b.ev(
                source_url="https://www.ncbi.nlm.nih.gov/clinvar/variation/653141/",
                supporting_passage="NM_005257.6(GATA6):c.1477C>T (p.Arg493Ter)",
                publication_date=None,
                evidence_type="clinvar_structured_record",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:clinvar:39844:record",
            "source": "clinvar:39844",
            "target": "allele:GATA6_p.Lys502fs",
            "type": "clinvar_record_for_allele",
            "plain_language": "ClinVar variation 39844 records this frameshift allele.",
        }
    )
    b.add_edge(
        {
            "id": "edge:clinvar:653141:record",
            "source": "clinvar:653141",
            "target": "allele:GATA6_p.Arg493Ter",
            "type": "clinvar_record_for_allele",
            "plain_language": "ClinVar variation 653141 records this nonsense allele.",
        }
    )
    b.add_edge(
        {
            "id": "edge:Arg493Ter:nmd_supports:haplo",
            "source": "allele:GATA6_p.Arg493Ter",
            "target": "mechanism:gata6_haploinsufficiency",
            "type": "experiment_supports_mechanism",
            "plain_language": "Published NMD for p.Arg493Ter supports haploinsufficiency for that allele — not a universal pLoF rule.",
            "evidence": b.ev(
                source_url="https://pubmed.ncbi.nlm.nih.gov/24310933/",
                supporting_passage="This finding provides the evidence for the occurrence of nonsense-mediated mRNA decay (NMD) in the p.Arg493X mutation",
                publication_date="2014",
                evidence_type="peer_reviewed_article",
                experimental_context="Patient peripheral-blood RNA RT-PCR / qRT-PCR",
                evidence_strength="moderate",
                limitations="Allele-specific; do not infer NMD for every predicted truncating GATA6 variant.",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:spectrum:phenotype:pancreas",
            "source": "disease:hdca_gata6",
            "target": "phenotype:pancreatic_agenesis",
            "type": "source_reports_association",
            "plain_language": "Pancreatic agenesis/hypoplasia is a defining feature in the OMIM 600001 / Allen cohort framing.",
            "evidence": b.ev(
                source_url="https://pubmed.ncbi.nlm.nih.gov/22158542/",
                supporting_passage="15/27 (56%) individuals with pancreatic agenesis",
                publication_date="2012",
                evidence_type="peer_reviewed_article",
                population_context="Allen 2012 pancreatic-agenesis ascertainment cohort",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:spectrum:phenotype:chd",
            "source": "disease:gata6_spectrum",
            "target": "phenotype:congenital_heart_defect",
            "type": "source_reports_association",
            "plain_language": "Congenital heart defects are frequent in GATA6 diabetes spectrum cohorts, with source-specific denominators.",
            "evidence": b.ev(
                source_url="https://pubmed.ncbi.nlm.nih.gov/23223019/",
                supporting_passage="Extrapancreatic features were observed in all 24 probands and three parents, with congenital heart defects most frequent (83%)",
                publication_date="2013",
                evidence_type="peer_reviewed_article",
                population_context="83% among 24 probands in De Franco et al. 2013 expansion cohort — not a universal population prevalence",
                evidence_strength="moderate",
                reporting_basis="De Franco et al. 2013; retain denominator when citing",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:spectrum:phenotype:ndm",
            "source": "disease:gata6_spectrum",
            "target": "phenotype:neonatal_diabetes",
            "type": "source_reports_association",
            "plain_language": "Neonatal or early diabetes is a common clinical presentation in ascertained GATA6 cases.",
            "evidence": b.ev(
                source_url="https://monogenicdiabetes.uchicago.edu/what-monogenic-diabetes",
                supporting_passage="Mutations within the GATA6 gene can result in neonatal diabetes",
                publication_date=None,
                evidence_type="research_program_primary_page",
                evidence_strength="moderate",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:pmid22158542:reports:hdca",
            "source": "pmid:22158542",
            "target": "disease:hdca_gata6",
            "type": "clinical_evidence_supports_outcome",
            "plain_language": "Allen 2012 is the key discovery paper for GATA6 pancreatic agenesis with CHD.",
            "evidence": b.ev(
                source_url="https://pubmed.ncbi.nlm.nih.gov/22158542/",
                supporting_passage="14 of the 15 mutation-positive patients had congenital heart defects in addition to pancreatic agenesis",
                publication_date="2012",
                evidence_type="peer_reviewed_article",
                population_context="14/15 mutation-positive patients in Allen 2012",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:pmid23223019:reports:spectrum",
            "source": "pmid:23223019",
            "target": "disease:gata6_spectrum",
            "type": "clinical_evidence_supports_outcome",
            "plain_language": "De Franco 2013 documents variable diabetes severity within GATA6.",
            "evidence": b.ev(
                source_url="https://pubmed.ncbi.nlm.nih.gov/23223019/",
                supporting_passage="ranging from pancreatic agenesis to adult-onset diabetes with subclinical or no exocrine insufficiency",
                publication_date="2013",
                evidence_type="peer_reviewed_article",
                evidence_strength="strong",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:pmid24310933:supports:nmd",
            "source": "pmid:24310933",
            "target": "allele:GATA6_p.Arg493Ter",
            "type": "source_reports_association",
            "plain_language": "Suzuki 2014 reports the p.Arg493Ter allele and NMD findings.",
            "evidence": b.ev(
                source_url="https://pubmed.ncbi.nlm.nih.gov/24310933/",
                supporting_passage="heterozygous for a novel de novo nonsense mutation of c.1477C>T, p. Arg493X",
                publication_date="2014",
                evidence_type="peer_reviewed_article",
                evidence_strength="moderate",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:registry:asset_for:spectrum",
            "source": "asset:uchicago_monogenic_diabetes_registry",
            "target": "disease:gata6_spectrum",
            "type": "asset_developed_for",
            "plain_language": "Chicago Monogenic Diabetes Registry supports research on monogenic diabetes including GATA6.",
            "evidence": b.ev(
                source_url="https://monogenicdiabetes.uchicago.edu/",
                supporting_passage="The University of Chicago Monogenic Diabetes Registry is a longitudinal study that allows us to follow up with families with known or suspected monogenic diabetes",
                publication_date=None,
                evidence_type="research_program_primary_page",
                species="Homo sapiens",
                evidence_strength="moderate",
                limitations="Registry is broader than GATA6-only; access requires program contact.",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:panelapp:asset_for:spectrum",
            "source": "asset:exeter_neonatal_diabetes_testing",
            "target": "disease:gata6_spectrum",
            "type": "asset_developed_for",
            "plain_language": "PanelApp marks GATA6 Green for neonatal diabetes testing panels.",
            "evidence": b.ev(
                source_url="https://panelapp.genomicsengland.co.uk/panels/293/gene/GATA6/",
                supporting_passage="Pancreatic agenesis and congenital heart defects, OMIM:600001",
                publication_date=None,
                evidence_type="gene_panel_curation",
                evidence_strength="moderate",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:consortium:supports:hdca",
            "source": "org:international_pancreatic_agenesis_consortium",
            "target": "disease:hdca_gata6",
            "type": "organization_supports_community",
            "relationship_status": "established",
            "plain_language": "Consortium contributed case ascertainment for the discovery cohort — research group, not a verified patient foundation.",
            "evidence": b.ev(
                source_url="https://pubmed.ncbi.nlm.nih.gov/22158542/",
                supporting_passage="International Pancreatic Agenesis Consortium",
                publication_date="2012",
                evidence_type="peer_reviewed_article",
                evidence_strength="low",
                limitations="No standalone public patient-org website verified in this slice.",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:gap:leads_to:question",
            "source": "gap:gata6_dedicated_patient_org",
            "target": "question:gata6_partner_and_natural_history_gap",
            "type": "suggests_next_research_step",
            "relationship_status": "hypothesis",
            "plain_language": "Missing dedicated advocacy partner motivates an explicit next research/collaboration question.",
            "evidence": b.ev(
                source_url="https://monogenicdiabetes.uchicago.edu/",
                supporting_passage="Monogenic Diabetes Registry is a longitudinal study",
                publication_date=None,
                evidence_type="research_program_primary_page",
                evidence_strength="low",
                limitations="Gap statement is curator assessment of missing dedicated GATA6 foundation evidence.",
            ),
        }
    )
    b.add_edge(
        {
            "id": "edge:registry:could_inform:question",
            "source": "asset:uchicago_monogenic_diabetes_registry",
            "target": "question:gata6_partner_and_natural_history_gap",
            "type": "potential_collaborator_for",
            "relationship_status": "hypothesis",
            "plain_language": "Registry is a potential research partner for genotype-aware questions — availability not claimed.",
            "evidence": b.ev(
                source_url="https://monogenicdiabetes.uchicago.edu/",
                supporting_passage="follow up with families with known or suspected monogenic diabetes",
                publication_date=None,
                evidence_type="research_program_primary_page",
                evidence_strength="moderate",
                limitations="Not a patient advocacy foundation; contact/access must be verified by humans.",
            ),
        }
    )

    # Review log
    b.log(
        "accept",
        "GATA6 haploinsufficiency causes pancreatic agenesis with frequent CHD in discovery cohorts",
        reason="Allen 2012 + OMIM 600001 + ClinGen definitive gene-disease validity",
        sources=["PMID:22158542", "OMIM:600001", "ClinGen GATA6 gene validity"],
    )
    b.log(
        "accept",
        "Keep pancreatic-agenesis/HDCA distinct from broader later-onset diabetes spectrum",
        reason="De Franco 2013 explicitly describes spectrum; collapsing labels would hide differences",
        sources=["PMID:23223019"],
    )
    b.log(
        "accept",
        "p.Arg493Ter has allele-specific NMD evidence supporting haploinsufficiency",
        reason="Suzuki 2014 reports NMD and reduced transcript",
        sources=["PMID:24310933"],
    )
    b.log(
        "reject",
        "All GATA6 presentations involve identical variants or identical severity",
        reason="Familial Lys502fs and spectrum papers show variable diabetes and CHD expressivity",
        sources=["ClinVar 39844", "PMID:23223019"],
        status="rejected",
    )
    b.log(
        "reject",
        "Infer functional loss for every predicted LoF GATA6 annotation automatically",
        reason="Require allele-level evidence; pLoF clustering is not a universal rule",
        sources=["PMID:38671509", "PMID:24310933"],
        status="rejected",
    )
    b.log(
        "reject",
        "Claim a dedicated GATA6 patient foundation partnership in this atlas",
        reason="No verified GATA6-only foundation primary site found; consortium ≠ patient org",
        sources=["curator search 2026-10-03"],
        status="rejected",
    )
    b.log(
        "unresolved",
        "Current access pathway and GATA6-specific fields in Chicago registry",
        reason="Public pages confirm registry exists; consent/access details need human verification",
        sources=["https://monogenicdiabetes.uchicago.edu/"],
        status="unresolved",
    )
    b.log(
        "unresolved",
        "Whether CHD percentages from notes (80–87%) apply outside cited cohorts",
        reason="Only source-attributed cohort percentages are retained on edges",
        sources=["PMID:23223019", "PMID:22158542"],
        status="unresolved",
    )

    journey = {
        "id": "journey:gata6_research_discovery",
        "title": "GATA6 spectrum research discovery journey",
        "intended_user": "Patient-group organizer or rare-disease research coordinator",
        "plain_language": (
            "Start from the GATA6-related spectrum, follow haploinsufficiency biology and "
            "variant-specific NMD evidence, then connect to publications and the Chicago "
            "Monogenic Diabetes Registry. A dedicated GATA6 patient foundation was not "
            "verified — that gap is shown explicitly. No treatment recommendation is made."
        ),
        "node_path": [
            "disease:gata6_spectrum",
            "gene:GATA6",
            "mechanism:gata6_haploinsufficiency",
            "disease:hdca_gata6",
            "allele:GATA6_p.Arg493Ter",
            "pmid:22158542",
            "pmid:23223019",
            "asset:uchicago_monogenic_diabetes_registry",
            "gap:gata6_dedicated_patient_org",
            "question:gata6_partner_and_natural_history_gap",
        ],
        "edge_path": [
            "edge:mechanism:haplo:relevant:spectrum",
            "edge:gene:GATA6:participates:endoderm",
            "edge:hdca:narrower:spectrum",
            "edge:Arg493Ter:nmd_supports:haplo",
            "edge:pmid22158542:reports:hdca",
            "edge:pmid23223019:reports:spectrum",
            "edge:registry:asset_for:spectrum",
            "edge:gap:leads_to:question",
            "edge:registry:could_inform:question",
        ],
        "answers": {
            "relevant_communities": [
                "asset:uchicago_monogenic_diabetes_registry",
                "org:international_pancreatic_agenesis_consortium",
            ],
            "existing_assets": [
                "asset:uchicago_monogenic_diabetes_registry",
                "asset:exeter_neonatal_diabetes_testing",
            ],
            "who_could_help": ["asset:uchicago_monogenic_diabetes_registry"],
            "next_step": (
                "Verify registry access for GATA6-specific questions and identify whether any "
                "CHD or neonatal-diabetes community partner can fill the missing foundation gap."
            ),
        },
    }

    demo = build_demo()
    gaps = """# GATA6 curated-layer gaps

- No verified GATA6-dedicated patient foundation / advocacy organization primary site.
- International Pancreatic Agenesis Consortium is a research authorship group, not a living patient-org contact pathway.
- Chicago Monogenic Diabetes Registry access/consent details not frozen as verified operational facts.
- No approved disease-modifying gene therapy claim.
- No cross-edges to HBB, ARID1B, or ODC1.
"""
    summary = f"""# GATA6 collection summary

- Dataset: gata6
- Journey status: partial (partner/foundation gap explicit)
- Retrieval date: {RETRIEVAL_DATE}
- Curated nodes: {len(b.nodes)}
- Curated edges: {len(b.edges)}
- Anchor publications: PMID 22158542, 23223019, 24310933
- Assets: Chicago Monogenic Diabetes Registry; PanelApp neonatal diabetes gene page
- Expert reviewed: false
"""
    write_outputs(
        OUTPUT,
        dataset_id="gata6",
        focus_gene="GATA6",
        builder=b,
        journey=journey,
        demo=demo,
        gaps=gaps,
        summary=summary,
    )
    print(f"GATA6 curated graph written: nodes={len(b.nodes)} edges={len(b.edges)}")


def build_demo() -> dict:
    return {
        "product_one_liner": "Search a rare disease and follow sourced connections to related biology, communities, and research assets.",
        "product_name": "Rare Disease Atlas",
        "dataset_id": "gata6",
        "dataset_label": "GATA6-related disorders",
        "journey_status": "partial",
        "journey_status_note": "Biology and publications are sourced; dedicated patient-foundation partner not verified — gap shown in Prepare step.",
        "default_focus_id": "disease:gata6_spectrum",
        "default_partner_id": "asset:uchicago_monogenic_diabetes_registry",
        "default_asset_ids": [
            "asset:uchicago_monogenic_diabetes_registry",
            "asset:exeter_neonatal_diabetes_testing",
        ],
        "landing_disclaimer": "GATA6 presentations vary widely; this atlas does not recommend treatments.",
        "example_searches": [
            {"label": "GATA6", "query": "GATA6"},
            {"label": "pancreatic agenesis", "query": "pancreatic agenesis"},
            {"label": "neonatal diabetes", "query": "neonatal diabetes"},
        ],
        "search_entries": [
            {
                "id": "disease:gata6_spectrum",
                "label": "GATA6-related diabetes / developmental spectrum",
                "category": "disease",
                "disambiguation_note": "Gene-centered umbrella; keep distinct from OMIM 600001 pancreatic+heart subset.",
                "synonyms": [
                    "gata6",
                    "gata6-related",
                    "gata6 spectrum",
                    "gata6 diabetes",
                ],
            },
            {
                "id": "disease:hdca_gata6",
                "label": "Pancreatic agenesis/hypoplasia with congenital heart defects (OMIM 600001)",
                "category": "disease",
                "disambiguation_note": "OMIM 600001 / HDCA framing for GATA6.",
                "synonyms": [
                    "pancreatic agenesis",
                    "pancreatic hypoplasia",
                    "hdca",
                    "omim 600001",
                    "pachd",
                ],
            },
            {
                "id": "disease:gata6_chd",
                "label": "GATA6-related congenital heart disease",
                "category": "disease",
                "disambiguation_note": "Cardiac focus with or without pancreatic features.",
                "synonyms": ["gata6 chd", "gata6 congenital heart"],
            },
            {
                "id": "gene:GATA6",
                "label": "GATA6",
                "category": "gene",
                "disambiguation_note": "GATA-binding transcription factor gene on 18q11.2.",
                "synonyms": ["gata6", "gata binding protein 6"],
            },
            {
                "id": "allele:GATA6_p.Arg493Ter",
                "label": "GATA6 p.Arg493Ter",
                "category": "variant",
                "disambiguation_note": "Nonsense allele with published NMD evidence.",
                "synonyms": ["p.arg493ter", "c.1477c>t", "arg493x"],
            },
            {
                "id": "allele:GATA6_p.Lys502fs",
                "label": "GATA6 p.Lys502fs",
                "category": "variant",
                "disambiguation_note": "Frameshift allele with variable familial expressivity.",
                "synonyms": ["p.lys502fs", "c.1504_1505del", "1504delaa"],
            },
            {
                "id": "mechanism:gata6_haploinsufficiency",
                "label": "GATA6 haploinsufficiency",
                "category": "mechanism",
                "disambiguation_note": "Primary disease-mechanism framing for heterozygous LoF-class patterns.",
                "synonyms": ["gata6 haploinsufficiency", "haploinsufficiency"],
            },
            {
                "id": "phenotype:neonatal_diabetes",
                "label": "Neonatal / early-onset diabetes",
                "category": "phenotype",
                "disambiguation_note": "Clinical phenotype used in GATA6 ascertainment — not a single genotype.",
                "synonyms": ["neonatal diabetes", "ndm", "permanent neonatal diabetes"],
            },
        ],
        "category_legend": default_legend(),
        "stages": [
            {
                "id": "understand",
                "label": "Understand the connection",
                "summary": "Follow GATA6 spectrum to haploinsufficiency, OMIM 600001 subset, and variant-specific NMD evidence.",
                "anchor_node_id": "disease:gata6_spectrum",
                "preferred_edge_id": "edge:mechanism:haplo:relevant:spectrum",
                "node_ids": [
                    "disease:gata6_spectrum",
                    "genotype:gata6_het",
                    "allele:GATA6_p.Lys502fs",
                    "allele:GATA6_p.Arg493Ter",
                    "gene:GATA6",
                    "mechanism:gata6_haploinsufficiency",
                    "process:endoderm_organogenesis",
                    "disease:hdca_gata6",
                    "disease:gata6_chd",
                    "phenotype:pancreatic_agenesis",
                    "phenotype:congenital_heart_defect",
                    "pmid:22158542",
                ],
                "edge_ids": [
                    "edge:genotype:defines:spectrum",
                    "edge:genotype:has:Lys502fs",
                    "edge:Lys502fs:allele_of:GATA6",
                    "edge:Arg493Ter:allele_of:GATA6",
                    "edge:gene:GATA6:participates:endoderm",
                    "edge:process:endoderm:supports:haploinsufficiency",
                    "edge:mechanism:haplo:relevant:spectrum",
                    "edge:hdca:narrower:spectrum",
                    "edge:chd:related_distinct:hdca",
                    "edge:Arg493Ter:nmd_supports:haplo",
                    "edge:spectrum:phenotype:pancreas",
                    "edge:pmid22158542:reports:hdca",
                ],
            },
            {
                "id": "explore",
                "label": "Explore resources",
                "summary": "Publications, registry/testing assets, and the explicit missing dedicated patient-foundation gap.",
                "anchor_node_id": "disease:gata6_spectrum",
                "preferred_edge_id": "edge:registry:asset_for:spectrum",
                "node_ids": [
                    "disease:gata6_spectrum",
                    "disease:hdca_gata6",
                    "mechanism:gata6_haploinsufficiency",
                    "pmid:22158542",
                    "pmid:23223019",
                    "pmid:24310933",
                    "asset:uchicago_monogenic_diabetes_registry",
                    "asset:exeter_neonatal_diabetes_testing",
                    "org:international_pancreatic_agenesis_consortium",
                    "gap:gata6_dedicated_patient_org",
                    "phenotype:neonatal_diabetes",
                ],
                "edge_ids": [
                    "edge:mechanism:haplo:relevant:spectrum",
                    "edge:pmid22158542:reports:hdca",
                    "edge:pmid23223019:reports:spectrum",
                    "edge:pmid24310933:supports:nmd",
                    "edge:registry:asset_for:spectrum",
                    "edge:panelapp:asset_for:spectrum",
                    "edge:consortium:supports:hdca",
                    "edge:spectrum:phenotype:ndm",
                    "edge:spectrum:phenotype:chd",
                ],
            },
            {
                "id": "prepare",
                "label": "Prepare next step",
                "summary": "Turn the partner/natural-history gap into a sourced collaboration brief — without inventing a foundation.",
                "anchor_node_id": "question:gata6_partner_and_natural_history_gap",
                "preferred_edge_id": "edge:registry:could_inform:question",
                "node_ids": [
                    "question:gata6_partner_and_natural_history_gap",
                    "gap:gata6_dedicated_patient_org",
                    "asset:uchicago_monogenic_diabetes_registry",
                    "org:international_pancreatic_agenesis_consortium",
                ],
                "edge_ids": [
                    "edge:gap:leads_to:question",
                    "edge:registry:could_inform:question",
                ],
            },
        ],
        "edge_plain_language": {
            "edge:mechanism:haplo:relevant:spectrum": "Haploinsufficiency is the core mechanism framing for GATA6-related disease.",
            "edge:hdca:narrower:spectrum": "OMIM 600001 pancreatic+heart disease is a narrower subset of the broader spectrum.",
            "edge:Arg493Ter:nmd_supports:haplo": "Published NMD supports haploinsufficiency for p.Arg493Ter specifically.",
            "edge:pmid22158542:reports:hdca": "Allen 2012 linked heterozygous GATA6 variants to pancreatic agenesis with CHD.",
            "edge:registry:asset_for:spectrum": "Chicago Monogenic Diabetes Registry is a public research asset including GATA6 context.",
            "edge:gap:leads_to:question": "Missing dedicated foundation evidence motivates the next collaboration question.",
        },
        "asset_assessments": [
            {
                "asset_id": "asset:uchicago_monogenic_diabetes_registry",
                "asset_kind": "patient_registry",
                "title": "University of Chicago Monogenic Diabetes Registry",
                "description": "Longitudinal research registry for families with known or suspected monogenic diabetes; public pages mention GATA6.",
                "owner": "University of Chicago Monogenic Diabetes program",
                "source_url": "https://monogenicdiabetes.uchicago.edu/",
                "designed_for": {
                    "disease": "Monogenic diabetes (includes GATA6 among others)",
                    "genotype": "Gene-specific fields not verified here",
                    "population": "Families with known/suspected monogenic diabetes",
                    "species": "Homo sapiens",
                },
                "access": "Public program pages; participation/data access require contacting the program. Atlas sends nothing automatically.",
                "relevance_to_journey": "Best verified research-community asset while a dedicated GATA6 foundation remains missing.",
                "comparison": {
                    "may_be_reusable": [
                        "Longitudinal monogenic-diabetes follow-up framing",
                        "Public education pages on GATA6-associated malformations"
                    ],
                    "what_differs": [
                        "Registry is not GATA6-only",
                        "Research registry ≠ patient advocacy foundation"
                    ],
                    "needs_expert_review": [
                        "Current GATA6 enrollment and data-access pathway",
                        "Whether cardiac-only GATA6 cases are in scope"
                    ],
                    "adaptation_status": "Potential research collaboration to investigate",
                    "validation_question": "Can the registry answer a genotype-aware GATA6 natural-history question under its current consent model?",
                },
            },
            {
                "asset_id": "asset:exeter_neonatal_diabetes_testing",
                "asset_kind": "diagnostic_panel_curation",
                "title": "PanelApp / neonatal diabetes gene curation for GATA6",
                "description": "Green gene curation linking GATA6 to pancreatic agenesis and congenital heart defects / neonatal diabetes panels.",
                "owner": "Genomics England PanelApp / NHS GMS curation",
                "source_url": "https://panelapp.genomicsengland.co.uk/panels/293/gene/GATA6/",
                "designed_for": {
                    "disease": "Neonatal diabetes / pancreatic agenesis and CHD",
                    "genotype": "Diagnostic sequencing context",
                    "population": "Clinical testing referrals",
                    "species": "Homo sapiens",
                },
                "access": "Public curation page.",
                "relevance_to_journey": "Shows diagnostic-testing infrastructure exists even when advocacy infrastructure is thin.",
                "comparison": {
                    "may_be_reusable": ["Panel inclusion rationale for research briefs"],
                    "what_differs": ["Panel curation ≠ natural-history study"],
                    "needs_expert_review": ["How panel language should appear in community materials"],
                    "adaptation_status": "Evidence/reference asset",
                    "validation_question": "Which panel phenotype terms should be preserved vs avoided when speaking with families?",
                },
            },
            {
                "asset_id": "org:international_pancreatic_agenesis_consortium",
                "asset_kind": "research_consortium",
                "title": "International Pancreatic Agenesis Consortium",
                "description": "Authorship/research consortium on Allen et al. 2012; not verified as a patient foundation.",
                "owner": "Multi-institution research group (see publication)",
                "source_url": "https://pubmed.ncbi.nlm.nih.gov/22158542/",
                "designed_for": {
                    "disease": "Pancreatic agenesis research ascertainment",
                    "genotype": "GATA6 discovery cohort context",
                    "population": "Clinician-referred agenesis cases",
                    "species": "Homo sapiens",
                },
                "access": "No standalone public org site verified; publication only.",
                "relevance_to_journey": "Historical research network — do not treat as a current partner contact.",
                "comparison": {
                    "may_be_reusable": ["Ascertainment definitions from the discovery paper"],
                    "what_differs": ["Consortium authorship ≠ ongoing advocacy organization"],
                    "needs_expert_review": ["Whether any consortium site still operates"],
                    "adaptation_status": "Historical reference only",
                    "validation_question": "Is there a current public contact for pancreatic-agenesis research collaboration beyond publications?",
                },
            },
        ],
        "registry_gap": {
            "status": "registry_present_dedicated_org_missing",
            "explanation": (
                "A monogenic-diabetes research registry is publicly documented, but this curated "
                "slice did not verify a GATA6-dedicated patient foundation or a confirmed "
                "registry data-access SOP for GATA6-only queries."
            ),
            "missing_evidence": [
                "Dedicated GATA6 patient organization primary website",
                "Registry access process + genotype fields verified for GATA6 extracts"
            ],
            "next_question": "Which organization can represent GATA6 family priorities while registry access is clarified?",
        },
        "unsupported_search": {
            "sources_searched": [
                "Curated GATA6 demonstration layer (Allen/De Franco/Suzuki, ClinVar examples, Chicago registry, PanelApp)",
                "Other curated datasets remain separate"
            ],
            "coverage_note": "Coverage is limited to curated demonstration datasets in this prototype.",
        },
        "proposal_defaults": {
            "research_question": (
                "Which public natural-history or community partner can support genotype-aware "
                "GATA6 research questions without collapsing pancreatic-agenesis and later-onset "
                "diabetes presentations?"
            ),
            "proposed_next_step": (
                "Contact the Chicago Monogenic Diabetes Registry via its public channels to ask "
                "about GATA6-specific follow-up fields, and separately search for any CHD/neonatal-diabetes "
                "advocacy partner willing to advise — without claiming a dedicated GATA6 foundation exists."
            ),
            "partner_gap_if_unknown": "No individual researcher availability is asserted. Dedicated GATA6 foundation not verified.",
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
