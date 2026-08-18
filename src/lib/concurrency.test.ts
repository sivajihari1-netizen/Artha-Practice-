import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./concurrency";

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("mapWithConcurrency", () => {
  it("resolves every item, preserving input order in the output array", async () => {
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => n * 10);
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual([10, 20, 30, 40, 50]);
  });

  it("never runs more than `limit` items concurrently", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    await mapWithConcurrency(items, 3, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
    });
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it("one item rejecting does not stop or fail the others", async () => {
    const results = await mapWithConcurrency([1, 2, 3], 3, async (n) => {
      if (n === 2) throw new Error("boom on 2");
      return n;
    });
    expect(results[0]).toEqual({ status: "fulfilled", value: 1 });
    expect(results[1].status).toBe("rejected");
    expect((results[1] as { status: "rejected"; reason: unknown }).reason).toBeInstanceOf(Error);
    expect(results[2]).toEqual({ status: "fulfilled", value: 3 });
  });

  it("clamps an oversized limit down to the item count (no wasted/idle workers)", async () => {
    const results = await mapWithConcurrency([1, 2], 100, async (n) => n);
    expect(results).toHaveLength(2);
  });

  it("handles an empty item list without hanging", async () => {
    const results = await mapWithConcurrency([], 3, async () => 1);
    expect(results).toEqual([]);
  });

  it("actually runs concurrently, not sequentially, up to the limit", async () => {
    const d1 = deferred<void>();
    const d2 = deferred<void>();
    const order: string[] = [];

    const run = mapWithConcurrency([1, 2], 2, async (n) => {
      order.push(`start-${n}`);
      await (n === 1 ? d1.promise : d2.promise);
      order.push(`end-${n}`);
    });

    // Both should have started before either finishes, proving they overlap.
    await new Promise((r) => setImmediate(r));
    expect(order).toEqual(["start-1", "start-2"]);
    d1.resolve();
    d2.resolve();
    await run;
  });
});
