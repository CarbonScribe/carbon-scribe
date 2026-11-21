use crate::types::Error;
use soroban_sdk::{Address, Bytes, Executable, String};

const MAX_PROJECT_ID_LEN: u32 = 128;

// --- IPFS CID validation (#639) ---
//
// Both supported CID forms are validated by decoding the multibase payload
// back to raw bytes and checking the resulting multihash/CID structure, not
// just the textual length and character set. A string that merely "looks
// like" a CID (right length, right first character, right alphabet) but
// decodes to garbage, or to a codec/hash function CarbonScribe doesn't
// support, is now rejected before anchor_document ever persists it.
//
// Multihash prefix for a 32-byte SHA2-256 digest: function code 0x12,
// length 0x20. Both single-byte varints — the only encoding these two
// fields ever take for the hash function/length values this contract
// supports.
const MULTIHASH_SHA2_256_CODE: u8 = 0x12;
const MULTIHASH_SHA2_256_LEN: u8 = 0x20;

/// Raw multihash length for a CIDv0: 2-byte prefix (code + length) + 32-byte digest.
const CIDV0_MULTIHASH_LEN: usize = 34;

/// CIDv1's version byte.
const CIDV1_VERSION: u8 = 0x01;

/// Decoded byte length of a CIDv1 wrapping a SHA2-256 multihash: version(1) +
/// codec(1) + multihash function(1) + multihash length(1) + digest(32).
const CIDV1_SHA2_256_LEN: usize = 36;

/// Upper bound on a decoded CIDv1 base32 payload, sized for this contract's
/// 100-character max CID length (99 base32 chars * 5 bits / 8 bits-per-byte
/// rounds down well under this).
const CIDV1_DECODE_BUF_LEN: usize = 64;

/// Multicodec values this contract accepts for a CIDv1's data codec.
/// dag-pb (0x70) and raw (0x55) cover every CID this registry is expected to
/// anchor today; any other codec is rejected rather than guessed at.
fn is_supported_codec(codec: u8) -> bool {
    matches!(codec, 0x70 | 0x55)
}

/// Validate IPFS CID format.
///
/// Supported encodings, each decoded and structurally verified:
/// - CIDv0: "Qm" + 44 base58btc characters, decoding to a 0x12 0x20
///   (SHA2-256, 32-byte digest) multihash.
/// - CIDv1 base32 ("b..."): decoding to version 0x01, a supported codec
///   (dag-pb or raw), and the same SHA2-256 multihash shape.
///
/// Every other declared multibase prefix (base58btc 'z', base16 'f'/'F',
/// base64url 'u'/'U', and the uppercase base32 variant 'B') has no
/// decode-and-verify implementation here and is rejected explicitly rather
/// than accepted on its first byte alone, as it previously was.
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
        return validate_cidv0(&cid_bytes, len);
    }

    match first_byte {
        b'b' => validate_cidv1_base32(&cid_bytes, len),
        _ => Err(Error::InvalidCidFormat),
    }
}

/// CIDv0 is the base58btc encoding of a raw multihash — the "Qm" seen at
/// the start is simply the first two characters that encoding happens to
/// produce for a SHA2-256 multihash, not a literal prefix to strip before
/// decoding. The full 46-character string is decoded as one base58 value.
fn validate_cidv0(cid_bytes: &Bytes, len: u32) -> Result<(), Error> {
    if len != 46 {
        return Err(Error::InvalidCidFormat);
    }

    let decoded = decode_base58::<CIDV0_MULTIHASH_LEN>(cid_bytes, 0, len)?;

    if decoded[0] != MULTIHASH_SHA2_256_CODE || decoded[1] != MULTIHASH_SHA2_256_LEN {
        return Err(Error::InvalidCidFormat);
    }

    Ok(())
}

/// Decodes the base32 payload following the leading 'b' and verifies it
/// parses as a CIDv1 wrapping a supported codec and a SHA2-256 multihash.
fn validate_cidv1_base32(cid_bytes: &Bytes, len: u32) -> Result<(), Error> {
    let payload_len = len - 1;
    let (decoded, decoded_len) = decode_base32::<CIDV1_DECODE_BUF_LEN>(cid_bytes, 1, payload_len)?;

    if decoded_len != CIDV1_SHA2_256_LEN {
        return Err(Error::InvalidCidFormat);
    }

    let version = decoded[0];
    let codec = decoded[1];
    let hash_fn = decoded[2];
    let hash_len = decoded[3];

    if version != CIDV1_VERSION {
        return Err(Error::InvalidCidFormat);
    }
    if !is_supported_codec(codec) {
        return Err(Error::InvalidCidFormat);
    }
    if hash_fn != MULTIHASH_SHA2_256_CODE || hash_len != MULTIHASH_SHA2_256_LEN {
        return Err(Error::InvalidCidFormat);
    }

    Ok(())
}

/// Maps a single base58btc character to its 0..57 digit value.
fn base58_value(b: u8) -> Option<u8> {
    match b {
        b'1'..=b'9' => Some(b - b'1'),
        b'A'..=b'H' => Some(9 + (b - b'A')),
        b'J'..=b'N' => Some(17 + (b - b'J')),
        b'P'..=b'Z' => Some(22 + (b - b'P')),
        b'a'..=b'k' => Some(33 + (b - b'a')),
        b'm'..=b'z' => Some(44 + (b - b'm')),
        _ => None,
    }
}

/// Decodes `count` base58btc characters starting at `start` into a
/// fixed-size, big-endian byte buffer — the standard "treat the string as
/// one big base-58 number" algorithm, done without heap allocation since
/// this runs in a `no_std` contract. Any character outside the base58
/// alphabet, or a value too large to fit in `N` bytes, is rejected.
fn decode_base58<const N: usize>(
    cid_bytes: &Bytes,
    start: u32,
    count: u32,
) -> Result<[u8; N], Error> {
    let mut out = [0u8; N];

    for i in 0..count {
        let byte = cid_bytes.get(start + i).unwrap_or(0);
        let digit = base58_value(byte).ok_or(Error::InvalidCidFormat)?;

        let mut carry = digit as u32;
        for slot in out.iter_mut().rev() {
            let value = (*slot as u32) * 58 + carry;
            *slot = (value & 0xFF) as u8;
            carry = value >> 8;
        }
        if carry != 0 {
            // The decoded value doesn't fit in N bytes.
            return Err(Error::InvalidCidFormat);
        }
    }

    Ok(out)
}

/// Maps a single lowercase RFC4648 base32 character to its 0..31 digit value.
fn base32_value(b: u8) -> Option<u8> {
    match b {
        b'a'..=b'z' => Some(b - b'a'),
        b'2'..=b'7' => Some(26 + (b - b'2')),
        _ => None,
    }
}

/// Decodes `count` base32 characters starting at `start` into a fixed-size
/// byte buffer, 5 bits at a time, returning the buffer along with how many
/// bytes were actually produced (base32's 5-bit groups don't divide evenly
/// into 8-bit bytes). Any character outside the base32 alphabet, or a
/// decoded length exceeding `N`, is rejected.
fn decode_base32<const N: usize>(
    cid_bytes: &Bytes,
    start: u32,
    count: u32,
) -> Result<([u8; N], usize), Error> {
    let mut out = [0u8; N];
    let mut out_len: usize = 0;
    let mut buffer: u32 = 0;
    let mut bits: u32 = 0;

    for i in 0..count {
        let byte = cid_bytes.get(start + i).unwrap_or(0);
        let value = base32_value(byte).ok_or(Error::InvalidCidFormat)?;

        buffer = (buffer << 5) | (value as u32);
        bits += 5;

        if bits >= 8 {
            bits -= 8;
            if out_len >= N {
                return Err(Error::InvalidCidFormat);
            }
            out[out_len] = ((buffer >> bits) & 0xFF) as u8;
            out_len += 1;
        }
    }

    Ok((out, out_len))
}

/// Validate that an address is a valid destination for ownership transfer.
/// Rejects contract addresses (Wasm and StellarAsset) since they cannot
/// authenticate as project owners without explicit owner interfaces.
/// Accepts account addresses and non-existent addresses (which may become
/// valid accounts in the future).
pub fn validate_address(address: &Address) -> Result<(), Error> {
    match address.executable() {
        Some(Executable::Wasm(_)) | Some(Executable::StellarAsset) => {
            Err(Error::InvalidAddress)
        }
        _ => Ok(()),
    }
}

/// Normalizes a project ID to a canonical lowercase key format.
/// This keeps storage keys stable across case variations like "Project-1" and "project-1".
pub fn normalize_project_id(env: &soroban_sdk::Env, project_id: &String) -> String {
    let bytes = project_id.to_bytes();
    let mut normalized = [0u8; 128];

    for i in 0..project_id.len() {
        let byte = bytes.get(i).unwrap_or(0);
        normalized[i as usize] = match byte {
            b'A'..=b'Z' => byte + 32,
            _ => byte,
        };
    }

    String::from_bytes(env, &normalized[..project_id.len() as usize])
}

/// Validates a project ID for registry storage and URL-safe identifiers.
/// Allowed characters are alphanumeric plus - / _ and the value must be non-empty,
/// not whitespace-only, and within a safe length cap.
pub fn validate_project_id(project_id: &String) -> Result<(), Error> {
    let len = project_id.len();
    if len == 0 || len > MAX_PROJECT_ID_LEN {
        return Err(Error::InvalidProjectId);
    }

    let bytes = project_id.to_bytes();

    for i in 0..len {
        let byte = bytes.get(i).unwrap_or(0);

        if byte.is_ascii_whitespace() {
            return Err(Error::InvalidProjectId);
        }

        match byte {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'/' => {}
            _ => return Err(Error::InvalidProjectId),
        }
    }

    Ok(())
}
