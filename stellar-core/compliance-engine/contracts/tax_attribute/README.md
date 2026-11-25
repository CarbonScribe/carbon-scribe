# Tax Attribute Contract

## Events

| Topic | Data | When |
|-------|------|------|
| `tax_att` + `token_id` | `(tag_id, issuer, valid_from, valid_until)` | Successful `attach_tax_attribute` |
| `tax_rev` + `token_id` | `(tag_id, revoked_by)` | Successful `revoke_attribute` |
| `iss_add` | issuer address | Issuer added |
| `iss_rem` | issuer address | Issuer removed |

Failed attach/revoke paths do not publish events. Typed events
`AttributeAttachedEvent` / `AttributeRevokedEvent` are also published.
