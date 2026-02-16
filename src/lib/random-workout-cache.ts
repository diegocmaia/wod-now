type CacheEntry<T> = {
  value: T;
  expiresAtMs: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

const ttlMs = Math.max(
  1,
  Number(process.env.RANDOM_WOD_CACHE_TTL_SECONDS ?? 30)
) * 1000;
const maxEntries = Math.max(1, Number(process.env.RANDOM_WOD_CACHE_MAX_KEYS ?? 200));

export const getRandomWorkoutCache = <T>(key: string): T | null => {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() >= entry.expiresAtMs) {
    cache.delete(key);
    return null;
  }

  return entry.value as T;
};

export const setRandomWorkoutCache = <T>(key: string, value: T): void => {
  if (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, {
    value,
    expiresAtMs: Date.now() + ttlMs
  });
};

export const clearRandomWorkoutCache = (): void => {
  cache.clear();
};
