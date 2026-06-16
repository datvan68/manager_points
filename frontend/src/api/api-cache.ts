type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

class ApiCache {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  async get<T>(key: string, fetcher: () => Promise<T>, ttl = this.defaultTTL): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && (now - cached.timestamp < ttl)) {
      return cached.data;
    }

    // Deduplicate concurrent requests
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    const promise = fetcher().then((data) => {
      this.cache.set(key, { data, timestamp: Date.now() });
      this.pendingRequests.delete(key);
      return data;
    }).catch((err) => {
      this.pendingRequests.delete(key);
      throw err;
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  invalidate(keyPattern: string | RegExp) {
    if (typeof keyPattern === 'string') {
      this.cache.delete(keyPattern);
    } else {
      for (const key of this.cache.keys()) {
        if (keyPattern.test(key)) {
          this.cache.delete(key);
        }
      }
    }
  }

  clear() {
    this.cache.clear();
    this.pendingRequests.clear();
  }
}

export const apiCache = new ApiCache();
