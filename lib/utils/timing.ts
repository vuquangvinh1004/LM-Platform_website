const ENABLE_TIMINGS = process.env.LOG_QUERY_TIMINGS === "1";

export async function timed<T>(label: string, task: () => Promise<T>): Promise<T> {
  if (!ENABLE_TIMINGS) {
    return task();
  }

  const start = performance.now();

  try {
    return await task();
  } finally {
    const elapsed = Math.round(performance.now() - start);
    console.info(`[timing] ${label}: ${elapsed}ms`);
  }
}
