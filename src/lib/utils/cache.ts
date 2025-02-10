import { AccountInfo } from '../types/api'

interface CacheItem<T> {
  data: T
  timestamp: number
}

interface CacheConfig {
  ttl: number // Time to live in milliseconds
}

export class ClientCache {
  private static instance: ClientCache
  private cache: Map<string, CacheItem<any>>
  private config: CacheConfig

  private constructor() {
    this.cache = new Map()
    this.config = {
      ttl: 24 * 60 * 60 * 1000 // 24 hours default TTL
    }
  }

  static getInstance(): ClientCache {
    if (!ClientCache.instance) {
      ClientCache.instance = new ClientCache()
    }
    return ClientCache.instance
  }

  // Add method to create a date range key
  private createDateRangeKey(key: string, from: string, to: string): string {
    return `${key}_${from}_${to}`
  }

  // Add method to get data for a specific date range
  getDateRangeData<T>(baseKey: string, from: string, to: string): T | null {
    const key = this.createDateRangeKey(baseKey, from, to)
    return this.get<T>(key)
  }

  // Add method to set data for a specific date range
  setDateRangeData<T>(baseKey: string, from: string, to: string, data: T, ttl?: number): void {
    const key = this.createDateRangeKey(baseKey, from, to)
    this.set(key, data, ttl)
  }

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null

    const isExpired = Date.now() - item.timestamp > this.config.ttl
    if (isExpired) {
      this.cache.delete(key)
      return null
    }

    return item.data as T
  }

  clear(): void {
    this.cache.clear()
  }

  remove(key: string): void {
    this.cache.delete(key)
  }

  setTTL(ttl: number): void {
    this.config.ttl = ttl
  }
}

export const cache = ClientCache.getInstance() 