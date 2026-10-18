use crate::types::Error;
use soroban_sdk::{Address, Bytes, Executable, String};

/// Validate CIDv0 and lowercase base32 CIDv1 values supported by this contract.
/// CIDv1 supports the dag-pb and raw codecs with SHA2-256 multihashes.
pub fn validate_ipfs_cid(cid: &String) -> Result<(), Error> {
    let len = cid.len();

    if len > 100 {
        return Err(Error::InvalidCidFormat);
    }

    let cid_bytes = cid.to_bytes();
    let first_byte = cid_bytes.get(0).unwrap_or(0);
    let second_byte = cid_bytes.get(1).unwrap_or(0);

    if first_byte == b'Q' && second_byte == b'm' {
        if len != 46 {
            return Err(Error::InvalidCidFormat);
        }

        let mut decoded = [0u8; 64];
        let decoded_len =
            decode_base58(&cid_bytes, 0, len, &mut decoded).ok_or(Error::InvalidCidFormat)?;
        return if decoded_len == 34 && decoded[0] == 0x12 && decoded[1] == 0x20 {
            Ok(())
        } else {
            Err(Error::InvalidCidFormat)
        };
    }

    if first_byte == b'b' {
        let mut decoded = [0u8; 64];
        let decoded_len =
            decode_base32(&cid_bytes, 1, len, &mut decoded).ok_or(Error::InvalidCidFormat)?;
        return validate_cidv1(&decoded, decoded_len);
    }

    // Other multibase encodings are intentionally unsupported.
    Err(Error::InvalidCidFormat)
}

fn decode_base58(input: &Bytes, start: u32, end: u32, output: &mut [u8; 64]) -> Option<usize> {
    let mut leading_zeroes = 0usize;
    while start + (leading_zeroes as u32) < end
        && input.get(start + leading_zeroes as u32) == Some(b'1')
    {
        leading_zeroes += 1;
    }

    let mut used = 0usize;
    for position in start..end {
        let digit = base58_value(input.get(position)?)? as u32;
        let mut carry = digit;

        for byte in output.iter_mut().take(used) {
            let value = (*byte as u32) * 58 + carry;
            *byte = value as u8;
            carry = value >> 8;
        }

        while carry > 0 {
            if used == output.len() {
                return None;
            }
            output[used] = carry as u8;
            used += 1;
            carry >>= 8;
        }
    }

    let decoded_len = leading_zeroes.checked_add(used)?;
    if decoded_len > output.len() {
        return None;
    }

    output[..used].reverse();
    output.copy_within(0..used, leading_zeroes);
    output[..leading_zeroes].fill(0);
    Some(decoded_len)
}

fn base58_value(byte: u8) -> Option<u8> {
    match byte {
        b'1'..=b'9' => Some(byte - b'1'),
        b'A'..=b'H' => Some(byte - b'A' + 9),
        b'J'..=b'N' => Some(byte - b'J' + 17),
        b'P'..=b'Z' => Some(byte - b'P' + 22),
        b'a'..=b'k' => Some(byte - b'a' + 33),
        b'm'..=b'z' => Some(byte - b'm' + 44),
        _ => None,
    }
}

fn decode_base32(input: &Bytes, start: u32, end: u32, output: &mut [u8; 64]) -> Option<usize> {
    let mut output_len = 0usize;
    let mut accumulator = 0u32;
    let mut bits = 0u8;

    for position in start..end {
        let value = base32_value(input.get(position)?)? as u32;
        accumulator = (accumulator << 5) | value;
        bits += 5;

        if bits >= 8 {
            bits -= 8;
            if output_len == output.len() {
                return None;
            }
            output[output_len] = ((accumulator >> bits) & 0xff) as u8;
            output_len += 1;
            accumulator &= (1 << bits) - 1;
        }
    }

    if accumulator != 0 {
        return None;
    }

    Some(output_len)
}

fn base32_value(byte: u8) -> Option<u8> {
    match byte {
        b'a'..=b'z' => Some(byte - b'a'),
        b'2'..=b'7' => Some(byte - b'2' + 26),
        _ => None,
    }
}

fn validate_cidv1(bytes: &[u8; 64], len: usize) -> Result<(), Error> {
    let mut position = 0usize;
    if read_varint(bytes, len, &mut position) != Some(1) {
        return Err(Error::InvalidCidFormat);
    }

    let codec = read_varint(bytes, len, &mut position);
    if codec != Some(0x55) && codec != Some(0x70) {
        return Err(Error::InvalidCidFormat);
    }

    if read_varint(bytes, len, &mut position) != Some(0x12)
        || read_varint(bytes, len, &mut position) != Some(32)
        || len.checked_sub(position) != Some(32)
    {
        return Err(Error::InvalidCidFormat);
    }

    Ok(())
}

fn read_varint(bytes: &[u8; 64], len: usize, position: &mut usize) -> Option<u64> {
    let start = *position;
    let mut value = 0u64;

    loop {
        if *position >= len || *position - start >= 10 {
            return None;
        }
        let byte = bytes[*position];
        *position += 1;
        let shift = ((*position - start - 1) * 7) as u32;

        if shift == 63 && byte & 0x7e != 0 {
            return None;
        }
        value |= ((byte & 0x7f) as u64).checked_shl(shift)?;

        if byte & 0x80 == 0 {
            if *position - start > 1 && byte == 0 {
                return None;
            }
            return Some(value);
        }
    }
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
