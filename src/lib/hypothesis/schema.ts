/** Strict JSON Schema for OpenAI Structured Outputs (Responses API). */
export const hypothesisResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["hypotheses", "evidence_limitations_explanation"],
  properties: {
    evidence_limitations_explanation: { type: "string" },
    hypotheses: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "hypothesis_id",
          "source_node_id",
          "target_node_id",
          "proposed_relationship_type",
          "title",
          "plain_language_summary",
          "established_premises",
          "scientific_rationale",
          "relevant_differences",
          "counterevidence",
          "missing_evidence",
          "validation_question",
          "proposed_next_step",
          "generation_status",
        ],
        properties: {
          hypothesis_id: { type: "string" },
          source_node_id: { type: "string" },
          target_node_id: { type: "string" },
          proposed_relationship_type: {
            type: "string",
            enum: [
              "proposed_shared_mechanism",
              "proposed_assay_adaptation",
              "proposed_asset_adaptation",
              "proposed_cross_disease_connection",
              "potential_collaborator_for",
              "suggests_next_research_step",
              "proposed_experiment",
            ],
          },
          title: { type: "string" },
          plain_language_summary: { type: "string" },
          established_premises: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["claim", "evidence_ids"],
              properties: {
                claim: { type: "string" },
                evidence_ids: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
          scientific_rationale: { type: "string" },
          relevant_differences: {
            type: "array",
            items: { type: "string" },
          },
          counterevidence: {
            type: "array",
            items: { type: "string" },
          },
          missing_evidence: {
            type: "array",
            items: { type: "string" },
          },
          validation_question: { type: "string" },
          proposed_next_step: { type: "string" },
          generation_status: {
            type: "string",
            enum: ["proposed", "insufficient_evidence", "rejected_validation"],
          },
        },
      },
    },
  },
} as const;
