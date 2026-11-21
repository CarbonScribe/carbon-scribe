import * as crypto from 'crypto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(key: string): boolean {
  if (typeof key !== 'string') {
    return false;
  }
  return UUID_REGEX.test(key.trim());
}

export function computeRequestHash(body: any): string {
  const serialize = (val: any): string => {
    if (val === null || typeof val !== 'object') {
      return JSON.stringify(val);
    }
    if (Array.isArray(val)) {
      return `[${val.map(serialize).join(',')}]`;
    }
    const keys = Object.keys(val).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${serialize(val[k])}`).join(',')}}`;
  };

  const normalized = serialize(body ?? {});
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
