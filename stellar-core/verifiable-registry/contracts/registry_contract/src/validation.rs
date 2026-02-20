use crate::types::Error;
use soroban_sdk::String;

/// Validate IPFS CID format
/// Basic validation to ensure the CID follows common IPFS patterns
/// CIDv0: Qm followed by 44 base58 characters
/// CIDv1: starts with 'b' followed by base32 characters, or other multibase prefixes
pub fn validate_ipfs_cid(cid: &String) -> Result<(), Error> {
    let len = cid.len();

    // Minimum CID length check (CIDv0 is 46 chars, CIDv1 can be longer)
    if len < 46 {
        return Err(Error::InvalidCidFormat);
    }

    // Maximum reasonable CID length (prevent garbage data)
    if len > 100 {
        return Err(Error::InvalidCidFormat);
    }

    // Convert String to Bytes for byte-level access
    let cid_bytes = cid.to_bytes();

    // Get first two bytes to check for CIDv0 format (starts with "Qm")
    let first_byte = cid_bytes.get(0).unwrap_or(0);
    let second_byte = cid_bytes.get(1).unwrap_or(0);

    if first_byte == b'Q' && second_byte == b'm' {
        // CIDv0 should be exactly 46 characters
        if len != 46 {
            return Err(Error::InvalidCidFormat);
        }

        // Verify all characters after "Qm" are valid base58 characters
        for i in 2..len {
            let byte = cid_bytes.get(i).unwrap_or(0);
            if !is_base58_byte(byte) {
                return Err(Error::InvalidCidFormat);
            }
        }

        return Ok(());
    }

    // Check for CIDv1 format (starts with common multibase prefixes)
    // 'b' = base32, 'z' = base58btc, 'f' = base16, etc.
    if first_byte == b'b'
        || first_byte == b'z'
        || first_byte == b'f'
        || first_byte == b'B'
        || first_byte == b'Z'
        || first_byte == b'F'
        || first_byte == b'u'
        || first_byte == b'U'
    {
        // For CIDv1, we just check it has reasonable length and valid charset for the prefix
        if first_byte == b'b' || first_byte == b'B' {
            // base32 - check for valid base32 characters
            for i in 1..len {
                let byte = cid_bytes.get(i).unwrap_or(0);
                if !is_base32_byte(byte) {
                    return Err(Error::InvalidCidFormat);
                }
            }
        }

        return Ok(());
    }

    // If none of the known formats match, reject
    Err(Error::InvalidCidFormat)
}

/// Check if a byte is a valid base58 character
fn is_base58_byte(b: u8) -> bool {
    matches!(b,
        b'1'..=b'9' | b'A'..=b'H' | b'J'..=b'N' | b'P'..=b'Z' | b'a'..=b'k' | b'm'..=b'z'
    )
}

/// Check if a byte is a valid base32 character
fn is_base32_byte(b: u8) -> bool {
    matches!(b, b'a'..=b'z' | b'2'..=b'7' | b'A'..=b'Z')
}
