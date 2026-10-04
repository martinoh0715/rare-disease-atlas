/** Strict JSON Schema for OpenAI Structured Outputs. */
export const evaluationResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "assessment_id",
    "conclusion_label",
    "opportunity_summary",
    "why_relevant",
    "reuse_elements",
    "unknown_questions",
    "recommended_next_step",
    "potential_time_savings",
    "evidence_limitations_explanation",
  ],
  properties: {
    assessment_id: { type: "string" },
    conclusion_label: {
      type: "string",
      enum: [
        "potential_reuse_worth_investigating",
        "important_differences_require_review",
        "insufficient_evidence_to_assess",
        "evidence_argues_against_proposed_reuse",
      ],
    },
    opportunity_summary: { type: "string" },
    why_relevant: {
      type: "object",
      additionalProperties: false,
      required: [
        "documented_findings",
        "ai_interpretation",
        "proposed_opportunity",
      ],
      properties: {
        documented_findings: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["claim", "evidence_ids"],
            properties: {
              claim: { type: "string" },
              evidence_ids: { type: "array", items: { type: "string" } },
            },
          },
        },
        ai_interpretation: { type: "string" },
        proposed_opportunity: { type: "string" },
      },
    },
    reuse_elements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "element",
          "assessment",
          "rationale",
          "important_differences",
          "evidence_ids",
          "must_verify_before_proceeding",
        ],
        properties: {
          element: { type: "string" },
          assessment: {
            type: "string",
            enum: [
              "potentially_reusable",
              "needs_adaptation",
              "insufficient_information",
              "evidence_argues_against_reuse",
            ],
          },
          rationale: { type: "string" },
          important_differences: {
            type: "array",
            items: { type: "string" },
          },
          evidence_ids: { type: "array", items: { type: "string" } },
          must_verify_before_proceeding: { type: "string" },
        },
      },
    },
    unknown_questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["unknown", "why_it_matters", "resolvable_by"],
        properties: {
          unknown: { type: "string" },
          why_it_matters: { type: "string" },
          resolvable_by: { type: "string" },
        },
      },
    },
    recommended_next_step: {
      type: "object",
      additionalProperties: false,
      required: ["milestone", "actions"],
      properties: {
        milestone: { type: "string" },
        actions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "action",
              "role_or_organization",
              "information_needed",
              "decision_enabled",
            ],
            properties: {
              action: { type: "string" },
              role_or_organization: { type: "string" },
              information_needed: { type: "string" },
              decision_enabled: { type: "string" },
            },
          },
        },
      },
    },
    potential_time_savings: { type: "string" },
    evidence_limitations_explanation: { type: "string" },
  },
} as const;
