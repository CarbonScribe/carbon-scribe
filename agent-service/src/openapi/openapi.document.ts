/**
 * OpenAPI 3.0.3 specification for agent-service.
 *
 * Single source of truth for the HTTP API contracts of agent-service, covering:
 * - Health and readiness probes (/health/liveness, /health/readiness)
 * - The four agent execution routes (/agents/discovery/run, /agents/pdd-draft/run,
 *   /agents/compliance-report/run, /agents/alert-triage/run)
 * - The human approval queue routes (/approvals, /approvals/{requestId}/approve,
 *   /approvals/{requestId}/reject)
 * - The OpenAPI discovery routes (/openapi.json, /openapi.yaml)
 */

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "agent-service API",
    version: "0.0.1",
    description:
      "Standalone agentic AI service for CarbonScribe — credit discovery, PDD drafting, compliance-report drafting, and alert-triage agents that call into corporate-platform and project-portal as tools.",
    contact: {
      name: "CarbonScribe Engineering",
    },
    license: {
      name: "UNLICENSED",
    },
  },
  servers: [
    {
      url: "http://localhost:4500",
      description: "Local development server",
    },
    {
      url: "/",
      description: "Current host / environment root",
    },
  ],
  tags: [
    {
      name: "Health",
      description:
        "Liveness and readiness health probes for orchestrators (kubelet, ECS)",
    },
    {
      name: "Agents",
      description: "Agentic AI execution endpoints",
    },
    {
      name: "Approvals",
      description:
        "Human approval queue and decision actions for consequential agent outcomes",
    },
    {
      name: "OpenAPI",
      description: "Machine-readable API contracts and schema specifications",
    },
  ],
  paths: {
    "/health/liveness": {
      get: {
        tags: ["Health"],
        summary: "Liveness probe",
        description:
          "Confirms the Express process is running and responsive. Does not touch downstream dependencies (Anthropic, Postgres, upstream clients) so transient outages do not trigger container restarts.",
        operationId: "getLiveness",
        responses: {
          "200": {
            description: "Service process is alive and handling HTTP requests",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HealthLivenessResponse",
                },
                example: {
                  status: "healthy",
                  timestamp: "2026-09-29T18:00:00.000Z",
                  service: "agent-service",
                  liveness: "up",
                },
              },
            },
          },
        },
      },
    },
    "/health/readiness": {
      get: {
        tags: ["Health"],
        summary: "Readiness probe",
        description:
          "Performs parallel time-boxed checks against the Anthropic API, corporate-platform-backend, and project-portal-backend. Returns 200 if all three dependencies are healthy, or 503 with per-dependency diagnostics if any check fails or times out.",
        operationId: "getReadiness",
        responses: {
          "200": {
            description:
              "All upstream dependencies and LLM providers are reachable and ready",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HealthReadinessResponse",
                },
                example: {
                  status: "healthy",
                  timestamp: "2026-09-29T18:00:00.000Z",
                  uptimeSeconds: 3600,
                  checks: {
                    anthropic: { status: "healthy", latencyMs: 145 },
                    corporatePlatform: { status: "healthy", latencyMs: 42 },
                    projectPortal: { status: "healthy", latencyMs: 38 },
                  },
                },
              },
            },
          },
          "503": {
            description:
              "One or more upstream dependencies failed their reachability checks",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HealthReadinessResponse",
                },
                example: {
                  status: "unhealthy",
                  timestamp: "2026-09-29T18:00:00.000Z",
                  uptimeSeconds: 3600,
                  checks: {
                    anthropic: { status: "healthy", latencyMs: 145 },
                    corporatePlatform: {
                      status: "unhealthy",
                      error: "corporate-platform reachability check timed out",
                    },
                    projectPortal: { status: "healthy", latencyMs: 38 },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/agents/discovery/run": {
      post: {
        tags: ["Agents"],
        summary: "Run credit-discovery agent",
        description:
          "Searches the marketplace and buyer portfolio to generate a shortlist of carbon credits matching buyer criteria (budget, sector, co-benefit priorities, compliance framework) with grounded justifications and citations.",
        operationId: "runDiscoveryAgent",
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          description:
            "Discovery agent execution parameters and buyer criteria",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/DiscoveryRunRequest",
              },
              example: {
                requestId: "req-disc-001",
                requestedBy: "corporate-platform",
                input: {
                  companyId: "comp-123",
                  budget: 25000,
                  sector: "technology",
                  methodology: "REDD+",
                  complianceFramework: "csrd",
                  maxPricePerTonne: 30,
                  coBenefits: ["biodiversity", "community-development"],
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description:
              "Agent execution succeeded and generated drafted recommendations",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/DiscoveryRunResponse",
                },
                example: {
                  agent: "discovery",
                  requestId: "req-disc-001",
                  status: "drafted",
                  output: {
                    recommendations: [
                      {
                        creditId: "cred-redd-456",
                        justification:
                          "Verified VCS avoided deforestation credit aligned with CSRD reporting and within $30/tonne target.",
                      },
                    ],
                    notes: "Full match found for requested sector and budget.",
                  },
                  citations: [
                    {
                      source: "marketplace",
                      reference: "cred-redd-456",
                    },
                  ],
                },
              },
            },
          },
          "401": {
            $ref: "#/components/responses/UnauthorizedError",
          },
          "502": {
            $ref: "#/components/responses/AgentRunFailure",
          },
        },
      },
    },
    "/agents/pdd-draft/run": {
      post: {
        tags: ["Agents"],
        summary: "Run PDD drafting agent",
        description:
          "Matches a project developer's raw submission (land details, activity type, target methodology) to eligible methodologies, identifies missing documentation, and drafts PDD narrative sections with explicit citations.",
        operationId: "runPddDraftAgent",
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          description:
            "PDD drafting input with project details and methodology criteria",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/PddDraftRunRequest",
              },
              example: {
                requestId: "req-pdd-002",
                requestedBy: "project-portal",
                input: {
                  activityType: "agroforestry",
                  country: "Kenya",
                  hectares: 150,
                  landDetails: "Degraded agricultural land in Nakuru County",
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description:
              "PDD drafting completed with drafted sections and flagged data gaps",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/PddDraftRunResponse",
                },
                example: {
                  agent: "pdd-draft",
                  requestId: "req-pdd-002",
                  status: "drafted",
                  output: {
                    methodology:
                      "VM0042 - Improved Agricultural Land Management",
                    sections: [
                      {
                        name: "Project Description & Boundary",
                        content:
                          "The project encompasses 150 hectares of smallholder agroforestry in Nakuru County, Kenya...",
                      },
                    ],
                    incompleteSections: [
                      {
                        name: "Baseline Carbon Stock Assessment",
                        reason:
                          "Soil sample laboratory data from year 0 has not yet been uploaded.",
                      },
                    ],
                  },
                  citations: [
                    {
                      source: "project-portal.methodologies",
                      reference: "VM0042",
                    },
                  ],
                },
              },
            },
          },
          "401": {
            $ref: "#/components/responses/UnauthorizedError",
          },
          "502": {
            $ref: "#/components/responses/AgentRunFailure",
          },
        },
      },
    },
    "/agents/compliance-report/run": {
      post: {
        tags: ["Agents"],
        summary: "Run compliance-report drafting agent",
        description:
          "Assembles portfolio retirement evidence for a company and reporting framework (CSRD, CBAM, CORSIA, SBTi, GHG Protocol), drafting report narrative sections and identifying evidence gaps. Because regulatory submissions are consequential, successful runs always produce a 'needs-approval' status requiring human sign-off before submission.",
        operationId: "runComplianceReportAgent",
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          description:
            "Company identity, compliance framework, and reporting period",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ComplianceReportRunRequest",
              },
              example: {
                requestId: "req-comp-003",
                requestedBy: "corporate-platform",
                input: {
                  companyId: "comp-acme-corp",
                  framework: "csrd",
                  periodStart: "2025-01-01",
                  periodEnd: "2025-12-31",
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description:
              "Compliance report draft created and placed in the needs-approval review queue",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ComplianceReportRunResponse",
                },
                example: {
                  agent: "compliance-report",
                  requestId: "req-comp-003",
                  status: "needs-approval",
                  output: {
                    framework: "csrd",
                    sections: [
                      {
                        name: "E1 Climate Change - Carbon Credit Offsetting",
                        content:
                          "During FY2025, Acme Corp retired 12,500 tonnes of verified credits across 3 nature-based projects...",
                      },
                    ],
                    gaps: [
                      {
                        description:
                          "Audit trail entries for Q4 retirements are still pending final on-chain transaction hashes.",
                      },
                    ],
                  },
                  citations: [
                    {
                      source: "corporatePlatformClient.getPortfolio",
                      reference: "comp-acme-corp",
                    },
                  ],
                },
              },
            },
          },
          "401": {
            $ref: "#/components/responses/UnauthorizedError",
          },
          "502": {
            $ref: "#/components/responses/AgentRunFailure",
          },
        },
      },
    },
    "/agents/alert-triage/run": {
      post: {
        tags: ["Agents"],
        summary: "Run alert-triage agent",
        description:
          "Correlates satellite NDVI data, IoT sensors, and weather context for candidate deforestation/anomaly alerts to produce a triage verdict (escalate, suppress, needs-more-data). An 'escalate' verdict produces a 'needs-approval' status so a human reviewer validates the incident before downstream notifications fire.",
        operationId: "runAlertTriageAgent",
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          description: "Candidate alert details and sensor/satellite context",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AlertTriageRunRequest",
              },
              example: {
                requestId: "req-alert-004",
                requestedBy: "project-portal",
                input: {
                  projectId: "proj-amazon-01",
                  alertId: "alert-987",
                  ndviDropPercent: 28.5,
                  sensorReadings: {
                    canopyCoverLoss: 0.18,
                    soilMoistureIndex: 0.32,
                  },
                  weatherContext: {
                    droughtCondition: false,
                    cloudCoverPercent: 5,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Alert triage classification completed",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AlertTriageRunResponse",
                },
                example: {
                  agent: "alert-triage",
                  requestId: "req-alert-004",
                  status: "needs-approval",
                  output: {
                    verdict: "escalate",
                    reasoning:
                      "Sustained 28.5% NDVI drop across clear-sky imagery combined with 18% canopy loss indicates genuine localized deforestation rather than seasonal foliage variation.",
                  },
                  citations: [
                    {
                      source: "satellite-ndvi",
                      reference: "sentinel-2-tile-202609",
                    },
                  ],
                },
              },
            },
          },
          "401": {
            $ref: "#/components/responses/UnauthorizedError",
          },
          "502": {
            $ref: "#/components/responses/AgentRunFailure",
          },
        },
      },
    },
    "/approvals": {
      get: {
        tags: ["Approvals"],
        summary: "List pending approval requests",
        description:
          "Returns all agent outcomes currently queued for human review. Access is restricted to internal caller identities registered in APPROVAL_REVIEWER_SERVICES.",
        operationId: "listPendingApprovals",
        security: [
          {
            bearerAuth: [],
          },
        ],
        responses: {
          "200": {
            description: "List of pending approval requests",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApprovalListResponse",
                },
                example: {
                  approvals: [
                    {
                      requestId: "req-alert-004",
                      agent: "alert-triage",
                      actionType: "alert-triage.escalate",
                      requestedBy: "project-portal",
                      originalResult: {
                        agent: "alert-triage",
                        requestId: "req-alert-004",
                        status: "needs-approval",
                        output: {
                          verdict: "escalate",
                          reasoning: "Deforestation anomaly detected.",
                        },
                        citations: [],
                      },
                      originalInput: {
                        projectId: "proj-amazon-01",
                      },
                      status: "pending",
                      reviewer: null,
                      reviewerCallingService: null,
                      decisionAt: null,
                      createdAt: "2026-09-29T18:00:00.000Z",
                    },
                  ],
                },
              },
            },
          },
          "401": {
            $ref: "#/components/responses/UnauthorizedError",
          },
          "403": {
            $ref: "#/components/responses/ForbiddenError",
          },
        },
      },
    },
    "/approvals/{requestId}/approve": {
      post: {
        tags: ["Approvals"],
        summary: "Approve a pending action",
        description:
          "Approves a queued agent outcome, logs the decision to the audit log, and schedules the corresponding downstream action in the transactional outbox table.",
        operationId: "approveRequest",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "requestId",
            in: "path",
            required: true,
            description: "Unique identifier of the approval request",
            schema: {
              type: "string",
            },
          },
        ],
        requestBody: {
          required: true,
          description:
            "Human reviewer identity asserted by the calling service",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ApprovalDecisionRequest",
              },
              example: {
                reviewerId: "usr-auditor-42",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Approval recorded and queued for outbox dispatch",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApprovalDecisionResponse",
                },
              },
            },
          },
          "400": {
            $ref: "#/components/responses/BadRequestError",
          },
          "401": {
            $ref: "#/components/responses/UnauthorizedError",
          },
          "403": {
            $ref: "#/components/responses/ForbiddenError",
          },
          "404": {
            $ref: "#/components/responses/NotFoundError",
          },
          "409": {
            $ref: "#/components/responses/ConflictError",
          },
        },
      },
    },
    "/approvals/{requestId}/reject": {
      post: {
        tags: ["Approvals"],
        summary: "Reject a pending action",
        description:
          "Rejects a queued agent outcome and records the human decision in the audit log without scheduling an outbox action.",
        operationId: "rejectRequest",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "requestId",
            in: "path",
            required: true,
            description: "Unique identifier of the approval request",
            schema: {
              type: "string",
            },
          },
        ],
        requestBody: {
          required: true,
          description:
            "Human reviewer identity asserted by the calling service",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ApprovalDecisionRequest",
              },
              example: {
                reviewerId: "usr-auditor-42",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Rejection recorded",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApprovalDecisionResponse",
                },
              },
            },
          },
          "400": {
            $ref: "#/components/responses/BadRequestError",
          },
          "401": {
            $ref: "#/components/responses/UnauthorizedError",
          },
          "403": {
            $ref: "#/components/responses/ForbiddenError",
          },
          "404": {
            $ref: "#/components/responses/NotFoundError",
          },
          "409": {
            $ref: "#/components/responses/ConflictError",
          },
        },
      },
    },
    "/openapi.json": {
      get: {
        tags: ["OpenAPI"],
        summary: "Get OpenAPI specification in JSON format",
        description:
          "Returns the machine-readable OpenAPI 3.0.3 specification in JSON format. Unauthenticated.",
        operationId: "getOpenApiJson",
        responses: {
          "200": {
            description: "OpenAPI 3.0.3 specification JSON",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  description: "OpenAPI 3.0.3 document",
                },
              },
            },
          },
        },
      },
    },
    "/openapi.yaml": {
      get: {
        tags: ["OpenAPI"],
        summary: "Get OpenAPI specification in YAML format",
        description:
          "Returns the machine-readable OpenAPI 3.0.3 specification in YAML format. Unauthenticated.",
        operationId: "getOpenApiYaml",
        responses: {
          "200": {
            description: "OpenAPI 3.0.3 specification YAML",
            content: {
              "text/yaml": {
                schema: {
                  type: "string",
                  description: "OpenAPI 3.0.3 document in YAML format",
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Internal service-to-service JWT passed as 'Authorization: Bearer <token>'. Signed using HS256 with the secret configured for the calling service issuer in SERVICE_TOKEN_SECRETS.",
      },
    },
    responses: {
      UnauthorizedError: {
        description: "Missing, malformed, expired, or untrusted service JWT",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/UnauthorizedErrorResponse",
            },
            example: {
              error: "unauthorized",
            },
          },
        },
      },
      ForbiddenError: {
        description:
          "Authenticated calling service is not in APPROVAL_REVIEWER_SERVICES allowlist",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ForbiddenErrorResponse",
            },
            example: {
              error: "approval permission required",
            },
          },
        },
      },
      NotFoundError: {
        description: "Approval request ID does not exist in the store",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/NotFoundErrorResponse",
            },
            example: {
              error: "approval request not found",
            },
          },
        },
      },
      ConflictError: {
        description:
          "Approval request is already in a non-pending terminal state",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ConflictErrorResponse",
            },
            example: {
              error: "approval request is already approved",
            },
          },
        },
      },
      BadRequestError: {
        description: "Missing required reviewerId field",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/BadRequestErrorResponse",
            },
            example: {
              error: "reviewerId is required",
            },
          },
        },
      },
      AgentRunFailure: {
        description:
          "Agent execution encountered an LLM provider error, parsing issue, tool failure, or refusal",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/AgentRunFailureResponse",
            },
            example: {
              agent: "discovery",
              requestId: "req-disc-001",
              status: "failed",
              output: {
                error: "Anthropic API error: Rate limit exceeded",
              },
              errorCategory: "rate_limited",
              retryable: true,
            },
          },
        },
      },
    },
    schemas: {
      AgentName: {
        type: "string",
        enum: ["discovery", "pdd-draft", "compliance-report", "alert-triage"],
        description: "Identifier of the agent handling the request",
      },
      AgentRunStatus: {
        type: "string",
        enum: ["drafted", "needs-approval", "failed"],
        description:
          "Outcome status of the run. 'drafted' indicates safe recommendation/draft; 'needs-approval' requires human sign-off; 'failed' indicates execution failure.",
      },
      ErrorCategory: {
        type: "string",
        enum: [
          "rate_limited",
          "connection_error",
          "invalid_request",
          "unknown",
        ],
        description: "Classification of the underlying failure cause",
      },
      AgentCitation: {
        type: "object",
        required: ["source", "reference"],
        description:
          "Source record or evidence grounded by the agent in its response",
        properties: {
          source: {
            type: "string",
            description: "Upstream system, tool, or document source identifier",
          },
          reference: {
            type: "string",
            description:
              "Unique reference ID, record identifier, or section name",
          },
        },
      },
      ComplianceFramework: {
        type: "string",
        enum: ["csrd", "cbam", "corsia", "sbti", "ghg-protocol"],
        description: "Recognized carbon compliance or ESG reporting framework",
      },
      HealthLivenessResponse: {
        type: "object",
        required: ["status", "timestamp", "service", "liveness"],
        properties: {
          status: {
            type: "string",
            example: "healthy",
          },
          timestamp: {
            type: "string",
            format: "date-time",
            example: "2026-09-29T18:00:00.000Z",
          },
          service: {
            type: "string",
            example: "agent-service",
          },
          liveness: {
            type: "string",
            example: "up",
          },
        },
      },
      HealthCheckDetail: {
        type: "object",
        required: ["status"],
        properties: {
          status: {
            type: "string",
            enum: ["healthy", "unhealthy"],
          },
          latencyMs: {
            type: "number",
            description: "Roundtrip check latency in milliseconds",
            example: 45,
          },
          error: {
            type: "string",
            description: "Error message when check fails or times out",
          },
        },
      },
      HealthReadinessResponse: {
        type: "object",
        required: ["status", "timestamp", "uptimeSeconds", "checks"],
        properties: {
          status: {
            type: "string",
            enum: ["healthy", "unhealthy"],
          },
          timestamp: {
            type: "string",
            format: "date-time",
            example: "2026-09-29T18:00:00.000Z",
          },
          uptimeSeconds: {
            type: "integer",
            example: 3600,
          },
          checks: {
            type: "object",
            required: ["anthropic", "corporatePlatform", "projectPortal"],
            properties: {
              anthropic: {
                $ref: "#/components/schemas/HealthCheckDetail",
              },
              corporatePlatform: {
                $ref: "#/components/schemas/HealthCheckDetail",
              },
              projectPortal: {
                $ref: "#/components/schemas/HealthCheckDetail",
              },
            },
          },
        },
      },
      DiscoveryRunInput: {
        type: "object",
        description:
          "Buyer preferences and constraints for carbon credit discovery",
        properties: {
          companyId: {
            type: "string",
            description:
              "Company ID to look up existing portfolio holdings and risk profile",
          },
          budget: {
            type: "number",
            description: "Maximum total budget in USD",
          },
          sector: {
            type: "string",
            description: "Industry sector or credit project category",
          },
          methodology: {
            type: "string",
            description:
              "Preferred carbon credit methodology (e.g. REDD+, VM0042)",
          },
          complianceFramework: {
            $ref: "#/components/schemas/ComplianceFramework",
          },
          vintage: {
            type: "string",
            description: "Preferred vintage year or range",
          },
          maxPricePerTonne: {
            type: "number",
            description: "Maximum acceptable price per credit in USD",
          },
          coBenefits: {
            type: "array",
            items: {
              type: "string",
            },
            description:
              "Desired UN SDG co-benefits (e.g. biodiversity, clean-water)",
          },
        },
      },
      DiscoveryRunRequest: {
        type: "object",
        required: ["requestId", "requestedBy", "input"],
        properties: {
          requestId: {
            type: "string",
            description: "Caller-provided idempotency and trace ID",
          },
          requestedBy: {
            type: "string",
            description:
              "Caller-asserted user/service identity (overridden by verified token issuer)",
          },
          input: {
            $ref: "#/components/schemas/DiscoveryRunInput",
          },
        },
      },
      DiscoveryRecommendation: {
        type: "object",
        required: ["creditId", "justification"],
        properties: {
          creditId: {
            type: "string",
            description: "Marketplace credit identifier",
          },
          justification: {
            type: "string",
            description:
              "Data-grounded justification for why this credit fits buyer criteria",
          },
        },
      },
      DiscoveryOutput: {
        type: "object",
        required: ["recommendations"],
        properties: {
          recommendations: {
            type: "array",
            items: {
              $ref: "#/components/schemas/DiscoveryRecommendation",
            },
          },
          notes: {
            type: "string",
            description: "Explanation for empty or partial shortlists",
          },
        },
      },
      DiscoveryRunResponse: {
        type: "object",
        required: ["agent", "requestId", "status", "output", "citations"],
        properties: {
          agent: {
            type: "string",
            enum: ["discovery"],
          },
          requestId: {
            type: "string",
          },
          status: {
            type: "string",
            enum: ["drafted", "needs-approval"],
          },
          output: {
            $ref: "#/components/schemas/DiscoveryOutput",
          },
          citations: {
            type: "array",
            items: {
              $ref: "#/components/schemas/AgentCitation",
            },
          },
        },
      },
      PddDraftRunInput: {
        type: "object",
        description: "Project developer raw submission data",
        properties: {
          activityType: {
            type: "string",
            description:
              "Project activity type (agroforestry, improved forest management, biochar, mangrove restoration, soil carbon, renewable energy)",
          },
          country: {
            type: "string",
            description: "Country where project land is located",
          },
          hectares: {
            type: "number",
            description: "Total project area in hectares",
          },
          landDetails: {
            type: "string",
            description:
              "Land tenure, soil characteristics, and baseline conditions",
          },
          targetMethodology: {
            type: "string",
            description: "Optional preferred methodology code",
          },
        },
      },
      PddDraftRunRequest: {
        type: "object",
        required: ["requestId", "requestedBy", "input"],
        properties: {
          requestId: {
            type: "string",
            description: "Caller-provided idempotency and trace ID",
          },
          requestedBy: {
            type: "string",
            description:
              "Caller-asserted identity (overridden by verified token issuer)",
          },
          input: {
            $ref: "#/components/schemas/PddDraftRunInput",
          },
        },
      },
      PddDraftOutput: {
        type: "object",
        required: ["sections", "incompleteSections"],
        properties: {
          methodology: {
            type: "string",
            description: "The matched methodology name/code if eligible",
          },
          sections: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "content"],
              properties: {
                name: {
                  type: "string",
                },
                content: {
                  type: "string",
                },
              },
            },
          },
          incompleteSections: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "reason"],
              properties: {
                name: {
                  type: "string",
                },
                reason: {
                  type: "string",
                  description:
                    "Specific documentation or data required to draft this section",
                },
              },
            },
          },
        },
      },
      PddDraftRunResponse: {
        type: "object",
        required: ["agent", "requestId", "status", "output", "citations"],
        properties: {
          agent: {
            type: "string",
            enum: ["pdd-draft"],
          },
          requestId: {
            type: "string",
          },
          status: {
            type: "string",
            enum: ["drafted", "needs-approval"],
          },
          output: {
            $ref: "#/components/schemas/PddDraftOutput",
          },
          citations: {
            type: "array",
            items: {
              $ref: "#/components/schemas/AgentCitation",
            },
          },
        },
      },
      ComplianceReportRunInput: {
        type: "object",
        required: ["companyId", "framework"],
        properties: {
          companyId: {
            type: "string",
            description:
              "Company identifier whose retirement records will be assembled",
          },
          framework: {
            $ref: "#/components/schemas/ComplianceFramework",
          },
          periodStart: {
            type: "string",
            description: "Reporting period start date (YYYY-MM-DD)",
          },
          periodEnd: {
            type: "string",
            description: "Reporting period end date (YYYY-MM-DD)",
          },
        },
      },
      ComplianceReportRunRequest: {
        type: "object",
        required: ["requestId", "requestedBy", "input"],
        properties: {
          requestId: {
            type: "string",
          },
          requestedBy: {
            type: "string",
          },
          input: {
            $ref: "#/components/schemas/ComplianceReportRunInput",
          },
        },
      },
      ComplianceReportOutput: {
        type: "object",
        required: ["sections", "gaps"],
        properties: {
          framework: {
            $ref: "#/components/schemas/ComplianceFramework",
          },
          sections: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "content"],
              properties: {
                name: {
                  type: "string",
                },
                content: {
                  type: "string",
                },
              },
            },
          },
          gaps: {
            type: "array",
            items: {
              type: "object",
              required: ["description"],
              properties: {
                description: {
                  type: "string",
                },
              },
            },
          },
        },
      },
      ComplianceReportRunResponse: {
        type: "object",
        required: ["agent", "requestId", "status", "output", "citations"],
        properties: {
          agent: {
            type: "string",
            enum: ["compliance-report"],
          },
          requestId: {
            type: "string",
          },
          status: {
            type: "string",
            enum: ["needs-approval", "drafted"],
          },
          output: {
            $ref: "#/components/schemas/ComplianceReportOutput",
          },
          citations: {
            type: "array",
            items: {
              $ref: "#/components/schemas/AgentCitation",
            },
          },
        },
      },
      AlertTriageRunInput: {
        type: "object",
        required: ["projectId"],
        properties: {
          projectId: {
            type: "string",
            description: "Project ID where the anomaly was detected",
          },
          alertId: {
            type: "string",
            description: "Candidate alert identifier",
          },
          ndviDropPercent: {
            type: "number",
            description: "Percentage drop in satellite NDVI vegetation index",
          },
          sensorReadings: {
            type: "object",
            description:
              "Ground IoT sensor readings (soil moisture, acoustic, canopy loss)",
          },
          weatherContext: {
            type: "object",
            description:
              "Regional weather parameters (drought, precipitation, cloud cover)",
          },
        },
      },
      AlertTriageRunRequest: {
        type: "object",
        required: ["requestId", "requestedBy", "input"],
        properties: {
          requestId: {
            type: "string",
          },
          requestedBy: {
            type: "string",
          },
          input: {
            $ref: "#/components/schemas/AlertTriageRunInput",
          },
        },
      },
      AlertTriageOutput: {
        type: "object",
        required: ["verdict", "reasoning"],
        properties: {
          verdict: {
            type: "string",
            enum: ["escalate", "suppress", "needs-more-data"],
            description: "Triage recommendation for this candidate alert",
          },
          reasoning: {
            type: "string",
            description: "Evidence correlation justifying the verdict",
          },
        },
      },
      AlertTriageRunResponse: {
        type: "object",
        required: ["agent", "requestId", "status", "output", "citations"],
        properties: {
          agent: {
            type: "string",
            enum: ["alert-triage"],
          },
          requestId: {
            type: "string",
          },
          status: {
            type: "string",
            enum: ["needs-approval", "drafted"],
          },
          output: {
            $ref: "#/components/schemas/AlertTriageOutput",
          },
          citations: {
            type: "array",
            items: {
              $ref: "#/components/schemas/AgentCitation",
            },
          },
        },
      },
      AgentRunFailureResponse: {
        type: "object",
        required: ["agent", "requestId", "status", "output"],
        properties: {
          agent: {
            $ref: "#/components/schemas/AgentName",
          },
          requestId: {
            type: "string",
          },
          status: {
            type: "string",
            enum: ["failed"],
          },
          output: {
            type: "object",
            required: ["error"],
            properties: {
              error: {
                type: "string",
                description: "Detailed failure description",
              },
            },
          },
          errorCategory: {
            $ref: "#/components/schemas/ErrorCategory",
          },
          retryable: {
            type: "boolean",
            description: "Whether the failure is transient and retryable",
          },
        },
      },
      ApprovalStatus: {
        type: "string",
        enum: ["pending", "approved", "rejected"],
        description: "State of an approval request in the human review queue",
      },
      ApprovalRecord: {
        type: "object",
        required: [
          "requestId",
          "agent",
          "actionType",
          "requestedBy",
          "originalResult",
          "status",
          "reviewer",
          "reviewerCallingService",
          "originalInput",
          "decisionAt",
          "createdAt",
        ],
        properties: {
          requestId: {
            type: "string",
          },
          agent: {
            $ref: "#/components/schemas/AgentName",
          },
          actionType: {
            type: "string",
            example: "alert-triage.escalate",
          },
          requestedBy: {
            type: "string",
          },
          originalResult: {
            type: "object",
            description: "The complete AgentRunResult produced by the agent",
          },
          originalInput: {
            type: "object",
            nullable: true,
            description:
              "Snapshot of the input passed to the original agent run",
          },
          status: {
            $ref: "#/components/schemas/ApprovalStatus",
          },
          reviewer: {
            type: "string",
            nullable: true,
            description:
              "Service-asserted human reviewer ID who decided the approval",
          },
          reviewerCallingService: {
            type: "string",
            nullable: true,
            description:
              "Verified JWT issuer of the service submitting the decision",
          },
          decisionAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      ApprovalListResponse: {
        type: "object",
        required: ["approvals"],
        properties: {
          approvals: {
            type: "array",
            items: {
              $ref: "#/components/schemas/ApprovalRecord",
            },
          },
        },
      },
      ApprovalDecisionRequest: {
        type: "object",
        required: ["reviewerId"],
        properties: {
          reviewerId: {
            type: "string",
            description:
              "Identifier of the human reviewer asserting the decision",
          },
        },
      },
      ApprovalDecisionResponse: {
        type: "object",
        required: ["approval"],
        properties: {
          approval: {
            $ref: "#/components/schemas/ApprovalRecord",
          },
        },
      },
      UnauthorizedErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "string",
            example: "unauthorized",
          },
        },
      },
      ForbiddenErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "string",
            example: "approval permission required",
          },
        },
      },
      NotFoundErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "string",
            example: "approval request not found",
          },
        },
      },
      ConflictErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "string",
            example: "approval request is already approved",
          },
        },
      },
      BadRequestErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "string",
            example: "reviewerId is required",
          },
        },
      },
    },
  },
} as const;
