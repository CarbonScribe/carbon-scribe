# Methodology Validation Module

This module provides compliance validation for methodologies during project onboarding, ensuring that the selected methodology exists in the Methodology Library contract, is issued by a recognized authority, and meets active status requirements before allowing project creation.

## Structure
- `models.go`: Response/request types for validation
- `methodology-validator.service.go`: Core validation logic
- `handler.go`: API endpoints for validation

## Endpoints
- `GET /api/v1/projects/validate-methodology/:tokenId` — Validate a single methodology
- `POST /api/v1/projects/validate-methodology/batch` — Batch validate multiple methodologies
- `GET /api/v1/methodologies/:tokenId` — Get methodology details from contract

## Usage
Integrate the validator in the onboarding flow to enforce compliance before project creation. See `methodology-validator.service.go` for validation logic and `handler.go` for API usage.
