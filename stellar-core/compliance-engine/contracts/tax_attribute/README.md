# Tax Attribute Contract

The `tax_attribute` contract manages tax compliance attributes, jurisdictions, and eligibility rules for tokenized carbon assets on Stellar (Soroban). Authorized issuers can attach regulatory eligibility tags (e.g. IRC-45Q, SEC-REG-D) to tokens, which can be queried by marketplace settlement contracts or revoked by issuers/administrators.

---

## Events Schema

The contract emits on-chain events for off-chain auditors, indexers, and compliance engines:

### 1. `tax_att` (Tax Attribute Attached)
Emitted immediately when an authorized issuer attaches a new tax attribute to a token.

- **Topics**: `(Symbol::short("tax_att"), token_id: u32)`
  - Topic 0: `Symbol::short("tax_att")`
  - Topic 1: `token_id` (`u32`)
- **Data (Payload)**: `(tag_id: String, issuer: Address, valid_from: u64, valid_until: u64)`
  - `tag_id`: Unique identifier for the tax attribute tag
  - `issuer`: Address of the authorized issuer that attached the attribute
  - `valid_from`: Unix timestamp from which the attribute becomes eligible
  - `valid_until`: Unix timestamp after which the attribute expires

### 2. `tax_rev` (Tax Attribute Revoked)
Emitted immediately when an administrator or the original issuing authority detaches an attribute from a token.

- **Topics**: `(Symbol::short("tax_rev"), token_id: u32)`
  - Topic 0: `Symbol::short("tax_rev")`
  - Topic 1: `token_id` (`u32`)
- **Data (Payload)**: `(tag_id: String, revoked_by: Address)`
  - `tag_id`: Unique identifier of the revoked tag
  - `revoked_by`: Address of the caller executing the revocation

### 3. `iss_add` / `iss_rem` (Issuer Management)
Emitted when administrators add or remove authorized attribute issuing authorities.

- **`iss_add`**: Topic `(Symbol::short("iss_add"),)`, Data: `issuer: Address`
- **`iss_rem`**: Topic `(Symbol::short("iss_rem"),)`, Data: `issuer: Address`

---

## Guarantees
- Events are emitted **strictly after persistent state is updated**.
- Failed operations, unauthorized invocations, and duplicate submissions return errors and emit **no** events.
