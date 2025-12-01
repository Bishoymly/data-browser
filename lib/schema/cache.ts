import { SchemaMetadata } from '@/types/schema';

const CACHE_KEY_PREFIX = 'db_schema_cache_';

export class SchemaCache {
  static getCacheKey(connectionId: string): string {
    return `${CACHE_KEY_PREFIX}${connectionId}`;
  }

  static set(connectionId: string, metadata: SchemaMetadata): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        this.getCacheKey(connectionId),
        JSON.stringify(metadata)
      );
    }
  }

  static get(connectionId: string): SchemaMetadata | null {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(this.getCacheKey(connectionId));
      if (cached) {
        try {
          return JSON.parse(cached) as SchemaMetadata;
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  static clear(connectionId: string): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.getCacheKey(connectionId));
    }
  }

  static clearAll(): void {
    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(CACHE_KEY_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    }
  }
}

