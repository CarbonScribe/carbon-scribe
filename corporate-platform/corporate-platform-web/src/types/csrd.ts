// ─── Enums & Literals ─────────────────────────────────────────────────────────

export type MaterialityCategory = 'environmental' | 'social' | 'governance';

export type AssuranceLevel = 'LIMITED' | 'REASONABLE';

export type EsrsStandard =
  | 'ESRS E1'
  | 'ESRS E2'
  | 'ESRS E3'
  | 'ESRS E4'
  | 'ESRS E5'
  | 'ESRS S1'
  | 'ESRS S2'
  | 'ESRS S3'
  | 'ESRS S4'
  | 'ESRS G1';

// ─── Materiality ──────────────────────────────────────────────────────────────

export interface MaterialityTopicPayload {
  id: string;
  name: string;
  category: MaterialityCategory;
  /** 1–5 */
  impactScore: number;
  /** 1–5 */
  financialScore: number;
  justification: string;
  relatedStandard?: EsrsStandard;
}

export interface CreateMaterialityAssessmentPayload {
  assessmentYear: number;
  impacts: MaterialityTopicPayload[];
  risks: MaterialityTopicPayload[];
  metadata?: Record<string, unknown>;
}

export interface MaterialityTopic extends MaterialityTopicPayload {
  isMaterial?: boolean;
}

export interface MaterialityThresholds {
  impact: number;
  financial: number;
}

export interface MaterialityAssessmentResult {
  topics: MaterialityTopic[];
  materialTopics: MaterialityTopic[];
  overallSummary: string;
  thresholds: MaterialityThresholds;
  coverageByCategory: Record<MaterialityCategory, number>;
}

export interface MaterialityAssessment {
  id: string;
  companyId: string;
  assessmentYear: number;
  status: string;
  impacts: MaterialityTopicPayload[];
  risks: MaterialityTopicPayload[];
  doubleMateriality?: MaterialityAssessmentResult | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  completedAt?: string | null;
}

// ─── ESRS Disclosures ─────────────────────────────────────────────────────────

export interface DisclosureRequirement {
  id: string;
  standard: EsrsStandard;
  requirement: string;
  description: string;
  dataPoints: string[];
}

export interface RecordDisclosurePayload {
  reportingPeriod: string;
  standard: EsrsStandard;
  disclosureRequirement: string;
  dataPoint: string;
  value: string | number | boolean | Record<string, unknown>;
  assuranceLevel?: AssuranceLevel;
}

export interface DisclosureQuery {
  reportingPeriod?: string;
  standard?: EsrsStandard;
}

export interface UpdateAssurancePayload {
  assuranceLevel: AssuranceLevel;
  assuredBy: string;
}

export interface Disclosure {
  id: string;
  companyId: string;
  reportingPeriod: string;
  standard: EsrsStandard;
  disclosureRequirement: string;
  dataPoint: string;
  value: unknown;
  assuranceLevel?: AssuranceLevel | null;
  assuredBy?: string | null;
  createdAt: string;
}

// ─── CSRD Reports ─────────────────────────────────────────────────────────────

export interface CsrdReportMetadata {
  auditorName?: string;
  auditFirm?: string;
  isExternalAssured: boolean;
  customChapters?: string[];
  tags?: string[];
  generatedAt?: string;
  format?: string;
  totalDisclosures?: number;
  standardsCovered?: string[];
}

export interface CsrdReport {
  id: string;
  companyId: string;
  reportingYear: number;
  status: string;
  metadata: CsrdReportMetadata | null;
  reportUrl?: string | null;
  createdAt: string;
}

// ─── Readiness ────────────────────────────────────────────────────────────────

export interface CsrdReadiness {
  overall: number;
  byStandard: Record<string, number>;
  missingDisclosures: string[];
  recommendations: string[];
}

// ─── Offset Verification ──────────────────────────────────────────────────────

export interface OffsetVerificationTokenResult {
  tokenId: string;
  valid: boolean;
  message?: string;
}

export interface OffsetVerificationResult {
  valid: boolean;
  results: OffsetVerificationTokenResult[];
  totalValid: number;
  totalTokens: number;
}
