# Security Guide

This document describes the security posture of the backend and the practices
contributors must follow.

## Threat model

The primary threats are:

- **Brute-force and credential-stuffing** against authentication endpoints.
- **Flooding** of minting, payment, and wallet-challenge endpoints.
- **Stored cross-site scripting** via user-controlled content.
- **Information disclosure** through overly verbose error responses.

## Rate limiting

Rate limiting is the first line of defense for authentication and
high-value endpoints. Limits are applied per route:

| Route | Key | Default limit |
|---|---|---|
| login | IP | 5 / 15 min |
| register | IP | 3 / hour |
| refresh | IP | 10 / hour |
| request-password-reset | IP | 3 / hour |
| wallet-login / wallet-challenge | IP | 5 / min |
| mint | user/IP | 10 / min |
| initiate-payment | user/IP | 5 / min |

Response headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`,
`X-RateLimit-Reset`) expose limit state to well-behaved clients.

Graduated cooldown locks apply increasing penalties to repeated violators.

## Secrets handling

- Never commit secrets or credentials.
- Store signing keys and provider secrets in the environment or a secret
  manager.
- Rotate secrets on any suspected exposure.

## Input validation

- Validate and coerce all request inputs before use.
- Reject oversized payloads.
- Treat all user-controlled content as untrusted when rendering.

## Output encoding

User-controlled content must be HTML-escaped at the rendering layer to prevent
stored cross-site scripting.

## Error responses

Error responses must be generic; do not leak stack traces, internal paths, or
whether an account exists (which enables user enumeration).

## Dependencies

Keep dependencies updated. CI includes vulnerability scanning on the
dependency graph; address high-severity findings before merge.

## Reporting

Report vulnerabilities privately to the maintainers rather than opening a
public issue with exploit details.
