import * as Joi from 'joi';

/**
 * Base event schema with common required fields
 * All events must extend this base schema
 */
export const baseEventSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    'string.empty': 'Event ID is required',
    'string.uuid': 'Event ID must be a valid UUID',
    'any.required': 'Event ID is required',
  }),
  type: Joi.string().required().messages({
    'string.empty': 'Event type is required',
    'any.required': 'Event type is required',
  }),
  source: Joi.string().required().messages({
    'string.empty': 'Event source is required',
    'any.required': 'Event source is required',
  }),
  timestamp: Joi.string().isoDate().required().messages({
    'string.empty': 'Event timestamp is required',
    'string.isoDate': 'Event timestamp must be a valid ISO date string',
    'any.required': 'Event timestamp is required',
  }),
  correlationId: Joi.string().required().messages({
    'string.empty': 'Correlation ID is required',
    'any.required': 'Correlation ID is required',
  }),
  userId: Joi.string().optional().allow(null),
  companyId: Joi.string().optional().allow(null),
  data: Joi.any().required().messages({
    'any.required': 'Event data is required',
  }),
  version: Joi.string()
    .pattern(/^\d+\.\d+\.\d+$/)
    .required()
    .messages({
      'string.empty': 'Event version is required',
      'string.pattern.base':
        'Event version must be in semver format (e.g., 1.0.0)',
      'any.required': 'Event version is required',
    }),
});

/**
 * Base validation options
 */
export const validationOptions = {
  abortEarly: false,
  allowUnknown: false,
  stripUnknown: true,
};
