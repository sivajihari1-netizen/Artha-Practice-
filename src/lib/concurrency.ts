/**
 * Runs `fn` over `items` with at most `limit` in flight at once — an async
 * pool, not `Promise.all` (unbounded) and not a plain sequential loop
 * (Phase 5 of the recurring-task-cron fix: bounded concurrency, no new
 * dependency like p-limit needed for something this small).
 *
 * Each item's result/error is captured independently — one item throwing
 * does not stop the others or reject the whole call, matching "a failure in
 * Firm A must not prevent Firm B from being processed."
 */
export type SettledResult<T> = { status: "fulfilled"; value: T } | { status: "rejected"; reason: unknown };

export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<SettledResult<R>[]> {
  const results: SettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i], i) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
