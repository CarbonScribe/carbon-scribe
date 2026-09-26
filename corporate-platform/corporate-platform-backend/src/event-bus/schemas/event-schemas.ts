import * as Joi from 'joi';
import { baseEventSchema } from './base-event.schema';

// ============================================================================
// Credit Event Schemas
// ============================================================================

/**
 * Credit purchased event data schema
 */
const creditPurchasedDataSchema = Joi.object({
  creditId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  price: Joi.number().positive().required(),
  currency: Joi.string().required(),
  projectId: Joi.string().required(),
  companyId: Joi.string().required(),
  userId: Joi.string().required(),
  purchaseDate: Joi.string().isoDate().required(),
  transactionHash: Joi.string().optional(),
  metadata: Joi.object().optional(),
});

export const creditPurchasedSchema = baseEventSchema.keys({
  type: Joi.string().valid('credit.purchased').required(),
  data: creditPurchasedDataSchema.required(),
});

/**
 * Credit retired event data schema
 */
const creditRetiredDataSchema = Joi.object({
  creditId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  companyId: Joi.string().required(),
  userId: Joi.string().required(),
  retirementDate: Joi.string().isoDate().required(),
  purpose: Joi.string().required(),
  transactionHash: Joi.string().required(),
  certificateId: Joi.string().optional(),
  metadata: Joi.object().optional(),
});

export const creditRetiredSchema = baseEventSchema.keys({
  type: Joi.string().valid('credit.retired').required(),
  data: creditRetiredDataSchema.required(),
});

/**
 * Credit transferred event data schema
 */
const creditTransferredDataSchema = Joi.object({
  creditId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  fromCompanyId: Joi.string().required(),
  toCompanyId: Joi.string().required(),
  fromUserId: Joi.string().required(),
  toUserId: Joi.string().required(),
  transferDate: Joi.string().isoDate().required(),
  transactionHash: Joi.string().required(),
  metadata: Joi.object().optional(),
});

export const creditTransferredSchema = baseEventSchema.keys({
  type: Joi.string().valid('credit.transferred').required(),
  data: creditTransferredDataSchema.required(),
});

/**
 * Credit listed event data schema
 */
const creditListedDataSchema = Joi.object({
  creditId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  price: Joi.number().positive().required(),
  currency: Joi.string().required(),
  companyId: Joi.string().required(),
  userId: Joi.string().required(),
  listingDate: Joi.string().isoDate().required(),
  expirationDate: Joi.string().isoDate().optional(),
  metadata: Joi.object().optional(),
});

export const creditListedSchema = baseEventSchema.keys({
  type: Joi.string().valid('credit.listed').required(),
  data: creditListedDataSchema.required(),
});

// ============================================================================
// Retirement Event Schemas
// ============================================================================

/**
 * Retirement created event data schema
 */
const retirementCreatedDataSchema = Joi.object({
  retirementId: Joi.string().required(),
  companyId: Joi.string().required(),
  userId: Joi.string().required(),
  creditId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  purpose: Joi.string().required(),
  retirementDate: Joi.string().isoDate().required(),
  certificateUrl: Joi.string().uri().optional(),
  transactionHash: Joi.string().required(),
  metadata: Joi.object().optional(),
});

export const retirementCreatedSchema = baseEventSchema.keys({
  type: Joi.string().valid('retirement.created').required(),
  data: retirementCreatedDataSchema.required(),
});

/**
 * Retirement verified event data schema
 */
const retirementVerifiedDataSchema = Joi.object({
  retirementId: Joi.string().required(),
  companyId: Joi.string().required(),
  verificationDate: Joi.string().isoDate().required(),
  verifier: Joi.string().required(),
  status: Joi.string().valid('verified', 'rejected', 'pending').required(),
  certificateHash: Joi.string().optional(),
  notes: Joi.string().optional(),
  metadata: Joi.object().optional(),
});

export const retirementVerifiedSchema = baseEventSchema.keys({
  type: Joi.string().valid('retirement.verified').required(),
  data: retirementVerifiedDataSchema.required(),
});

// ============================================================================
// Portfolio Event Schemas
// ============================================================================

/**
 * Portfolio updated event data schema
 */
const portfolioUpdatedDataSchema = Joi.object({
  portfolioId: Joi.string().required(),
  companyId: Joi.string().required(),
  userId: Joi.string().required(),
  updateDate: Joi.string().isoDate().required(),
  changes: Joi.array()
    .items(
      Joi.object({
        field: Joi.string().required(),
        oldValue: Joi.any().optional(),
        newValue: Joi.any().required(),
      }),
    )
    .required(),
  metadata: Joi.object().optional(),
});

export const portfolioUpdatedSchema = baseEventSchema.keys({
  type: Joi.string().valid('portfolio.updated').required(),
  data: portfolioUpdatedDataSchema.required(),
});

/**
 * Portfolio snapshot event data schema
 */
const portfolioSnapshotDataSchema = Joi.object({
  portfolioId: Joi.string().required(),
  companyId: Joi.string().required(),
  snapshotDate: Joi.string().isoDate().required(),
  totalCredits: Joi.number().min(0).required(),
  totalValue: Joi.number().min(0).required(),
  currency: Joi.string().required(),
  holdings: Joi.array()
    .items(
      Joi.object({
        creditId: Joi.string().required(),
        amount: Joi.number().positive().required(),
        value: Joi.number().positive().required(),
      }),
    )
    .required(),
  metadata: Joi.object().optional(),
});

export const portfolioSnapshotSchema = baseEventSchema.keys({
  type: Joi.string().valid('portfolio.snapshot').required(),
  data: portfolioSnapshotDataSchema.required(),
});

// ============================================================================
// Marketplace Event Schemas
// ============================================================================

/**
 * Marketplace listing created event data schema
 */
const marketplaceListingCreatedDataSchema = Joi.object({
  listingId: Joi.string().required(),
  creditId: Joi.string().required(),
  companyId: Joi.string().required(),
  userId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  price: Joi.number().positive().required(),
  currency: Joi.string().required(),
  createdAt: Joi.string().isoDate().required(),
  expiresAt: Joi.string().isoDate().optional(),
  metadata: Joi.object().optional(),
});

export const marketplaceListingCreatedSchema = baseEventSchema.keys({
  type: Joi.string().valid('marketplace.listing.created').required(),
  data: marketplaceListingCreatedDataSchema.required(),
});

/**
 * Marketplace offer made event data schema
 */
const marketplaceOfferMadeDataSchema = Joi.object({
  offerId: Joi.string().required(),
  listingId: Joi.string().required(),
  companyId: Joi.string().required(),
  userId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  price: Joi.number().positive().required(),
  currency: Joi.string().required(),
  offeredAt: Joi.string().isoDate().required(),
  expiresAt: Joi.string().isoDate().optional(),
  metadata: Joi.object().optional(),
});

export const marketplaceOfferMadeSchema = baseEventSchema.keys({
  type: Joi.string().valid('marketplace.offer.made').required(),
  data: marketplaceOfferMadeDataSchema.required(),
});

/**
 * Marketplace transaction completed event data schema
 */
const marketplaceTransactionCompletedDataSchema = Joi.object({
  transactionId: Joi.string().required(),
  listingId: Joi.string().required(),
  offerId: Joi.string().optional(),
  buyerCompanyId: Joi.string().required(),
  sellerCompanyId: Joi.string().required(),
  buyerUserId: Joi.string().required(),
  sellerUserId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  price: Joi.number().positive().required(),
  currency: Joi.string().required(),
  completedAt: Joi.string().isoDate().required(),
  transactionHash: Joi.string().required(),
  metadata: Joi.object().optional(),
});

export const marketplaceTransactionCompletedSchema = baseEventSchema.keys({
  type: Joi.string().valid('marketplace.transaction.completed').required(),
  data: marketplaceTransactionCompletedDataSchema.required(),
});

// ============================================================================
// Team Event Schemas
// ============================================================================

/**
 * Team member added event data schema
 */
const teamMemberAddedDataSchema = Joi.object({
  teamId: Joi.string().required(),
  companyId: Joi.string().required(),
  memberId: Joi.string().required(),
  addedByUserId: Joi.string().required(),
  role: Joi.string().valid('admin', 'member', 'viewer').required(),
  addedAt: Joi.string().isoDate().required(),
  metadata: Joi.object().optional(),
});

export const teamMemberAddedSchema = baseEventSchema.keys({
  type: Joi.string().valid('team.member.added').required(),
  data: teamMemberAddedDataSchema.required(),
});

/**
 * Team member removed event data schema
 */
const teamMemberRemovedDataSchema = Joi.object({
  teamId: Joi.string().required(),
  companyId: Joi.string().required(),
  memberId: Joi.string().required(),
  removedByUserId: Joi.string().required(),
  removedAt: Joi.string().isoDate().required(),
  reason: Joi.string().optional(),
  metadata: Joi.object().optional(),
});

export const teamMemberRemovedSchema = baseEventSchema.keys({
  type: Joi.string().valid('team.member.removed').required(),
  data: teamMemberRemovedDataSchema.required(),
});

/**
 * Team role updated event data schema
 */
const teamRoleUpdatedDataSchema = Joi.object({
  teamId: Joi.string().required(),
  companyId: Joi.string().required(),
  memberId: Joi.string().required(),
  updatedByUserId: Joi.string().required(),
  oldRole: Joi.string().valid('admin', 'member', 'viewer').required(),
  newRole: Joi.string().valid('admin', 'member', 'viewer').required(),
  updatedAt: Joi.string().isoDate().required(),
  metadata: Joi.object().optional(),
});

export const teamRoleUpdatedSchema = baseEventSchema.keys({
  type: Joi.string().valid('team.role.updated').required(),
  data: teamRoleUpdatedDataSchema.required(),
});

// ============================================================================
// Compliance Event Schemas
// ============================================================================

/**
 * Compliance check completed event data schema
 */
const complianceCheckCompletedDataSchema = Joi.object({
  checkId: Joi.string().required(),
  companyId: Joi.string().required(),
  userId: Joi.string().required(),
  framework: Joi.string().required(),
  status: Joi.string().valid('passed', 'failed', 'pending').required(),
  score: Joi.number().min(0).max(100).required(),
  completedAt: Joi.string().isoDate().required(),
  details: Joi.object().optional(),
  metadata: Joi.object().optional(),
});

export const complianceCheckCompletedSchema = baseEventSchema.keys({
  type: Joi.string().valid('compliance.check.completed').required(),
  data: complianceCheckCompletedDataSchema.required(),
});

/**
 * Compliance report generated event data schema
 */
const complianceReportGeneratedDataSchema = Joi.object({
  reportId: Joi.string().required(),
  companyId: Joi.string().required(),
  userId: Joi.string().required(),
  framework: Joi.string().required(),
  reportType: Joi.string().required(),
  generatedAt: Joi.string().isoDate().required(),
  reportUrl: Joi.string().uri().required(),
  summary: Joi.object().required(),
  metadata: Joi.object().optional(),
});

export const complianceReportGeneratedSchema = baseEventSchema.keys({
  type: Joi.string().valid('compliance.report.generated').required(),
  data: complianceReportGeneratedDataSchema.required(),
});

// ============================================================================
// Blockchain Event Schemas
// ============================================================================

/**
 * Blockchain transaction initiated event data schema
 */
const blockchainTransactionInitiatedDataSchema = Joi.object({
  transactionId: Joi.string().required(),
  companyId: Joi.string().required(),
  userId: Joi.string().required(),
  contractId: Joi.string().required(),
  methodName: Joi.string().required(),
  args: Joi.array().required(),
  initiatedAt: Joi.string().isoDate().required(),
  metadata: Joi.object().optional(),
});

export const blockchainTransactionInitiatedSchema = baseEventSchema.keys({
  type: Joi.string().valid('blockchain.transaction.initiated').required(),
  data: blockchainTransactionInitiatedDataSchema.required(),
});

/**
 * Blockchain transaction confirmed event data schema
 */
const blockchainTransactionConfirmedDataSchema = Joi.object({
  transactionId: Joi.string().required(),
  companyId: Joi.string().required(),
  userId: Joi.string().required(),
  transactionHash: Joi.string().required(),
  status: Joi.string().valid('success', 'failed', 'pending').required(),
  confirmedAt: Joi.string().isoDate().required(),
  result: Joi.any().optional(),
  error: Joi.string().optional(),
  metadata: Joi.object().optional(),
});

export const blockchainTransactionConfirmedSchema = baseEventSchema.keys({
  type: Joi.string().valid('blockchain.transaction.confirmed').required(),
  data: blockchainTransactionConfirmedDataSchema.required(),
});

// ============================================================================
// Notification Event Schemas
// ============================================================================

/**
 * Notification sent event data schema
 */
const notificationSentDataSchema = Joi.object({
  notificationId: Joi.string().required(),
  userId: Joi.string().required(),
  companyId: Joi.string().optional(),
  type: Joi.string().required(),
  channel: Joi.string().valid('email', 'slack', 'in-app', 'sms').required(),
  subject: Joi.string().required(),
  sentAt: Joi.string().isoDate().required(),
  metadata: Joi.object().optional(),
});

export const notificationSentSchema = baseEventSchema.keys({
  type: Joi.string().valid('notification.sent').required(),
  data: notificationSentDataSchema.required(),
});

// ============================================================================
// Event Schema Registry
// ============================================================================

/**
 * Event schema registry mapping event types to their schemas
 */
export const EventSchemaRegistry: Record<string, Joi.ObjectSchema> = {
  // Credit events
  'credit.purchased': creditPurchasedSchema,
  'credit.retired': creditRetiredSchema,
  'credit.transferred': creditTransferredSchema,
  'credit.listed': creditListedSchema,

  // Retirement events
  'retirement.created': retirementCreatedSchema,
  'retirement.verified': retirementVerifiedSchema,

  // Portfolio events
  'portfolio.updated': portfolioUpdatedSchema,
  'portfolio.snapshot': portfolioSnapshotSchema,

  // Marketplace events
  'marketplace.listing.created': marketplaceListingCreatedSchema,
  'marketplace.offer.made': marketplaceOfferMadeSchema,
  'marketplace.transaction.completed': marketplaceTransactionCompletedSchema,

  // Team events
  'team.member.added': teamMemberAddedSchema,
  'team.member.removed': teamMemberRemovedSchema,
  'team.role.updated': teamRoleUpdatedSchema,

  // Compliance events
  'compliance.check.completed': complianceCheckCompletedSchema,
  'compliance.report.generated': complianceReportGeneratedSchema,

  // Blockchain events
  'blockchain.transaction.initiated': blockchainTransactionInitiatedSchema,
  'blockchain.transaction.confirmed': blockchainTransactionConfirmedSchema,

  // Notification events
  'notification.sent': notificationSentSchema,
};

/**
 * Get schema for a specific event type
 */
export function getEventSchema(eventType: string): Joi.ObjectSchema | null {
  return EventSchemaRegistry[eventType] || null;
}

/**
 * Check if an event type has a registered schema
 */
export function hasEventSchema(eventType: string): boolean {
  return eventType in EventSchemaRegistry;
}
