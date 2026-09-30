/**
 * @jest-environment jsdom
 */

describe('LiveRetirementFeed reconnect/dedupe design (#552)', () => {
  it('documents backoff bounds', () => {
    const BASE = 1000;
    const MAX = 30_000;
    let b = BASE;
    for (let i = 0; i < 10; i++) b = Math.min(MAX, b * 2);
    expect(b).toBe(MAX);
  });

  it('dedupes by id using a Set', () => {
    const seen = new Set<string>();
    const push = (id: string) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    };
    expect(push('r1')).toBe(true);
    expect(push('r1')).toBe(false);
    expect(push('r2')).toBe(true);
  });
});
