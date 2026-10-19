import { afterEach, describe, expect, it, vi } from "vitest";

const endMock = vi.fn().mockResolvedValue(undefined);

// db.ts opens a real Postgres connection on construction, which this test
// must never do — mock pg's Pool so getPool()/closePool() can be exercised
// without a live database.
vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(function FakePool(this: object) {
    Object.assign(this, { query: vi.fn(), end: endMock });
  }),
}));

const { getPool, setPool, closePool } = await import("./db.js");

describe("closePool", () => {
  afterEach(() => {
    setPool(undefined);
    endMock.mockClear();
  });

  it("ends the real pool once getPool() has created one", async () => {
    getPool();

    await closePool();

    expect(endMock).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when no real pool has been created yet", async () => {
    await closePool();

    expect(endMock).not.toHaveBeenCalled();
  });

  it("never ends a test-injected pool from setPool()", async () => {
    setPool({ query: vi.fn() });

    await closePool();

    expect(endMock).not.toHaveBeenCalled();
  });

  it("lets getPool() create a fresh pool again after closePool()", async () => {
    getPool();
    await closePool();

    getPool();
    await closePool();

    expect(endMock).toHaveBeenCalledTimes(2);
  });
});
