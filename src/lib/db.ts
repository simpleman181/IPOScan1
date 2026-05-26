/**
 * Persistent database using Upstash Redis.
 * - All stock data survives cold starts, redeployments, and server restarts.
 * - In-memory Map used as a warm cache to avoid redundant Redis reads.
 * - /api/seed populates Redis only if empty (first ever visit).
 */

import { Redis } from '@upstash/redis'
import { randomBytes } from 'crypto'

function cuid(): string {
  return 'c' + randomBytes(16).toString('hex')
}

// ─── Redis client (reads KV_REST_API_URL + KV_REST_API_TOKEN from env) ────────
const redis = Redis.fromEnv()

// ─── Redis key helpers ────────────────────────────────────────────────────────
const KEYS = {
  stockSet: 'stocks:all',                      // SET of all stock IDs
  stock: (id: string) => `stock:${id}`,        // HASH per stock
  dailySet: (sid: string) => `daily:${sid}`,   // SET of daily price IDs
  daily: (id: string) => `dp:${id}`,           // HASH per daily price
  weeklySet: (sid: string) => `weekly:${sid}`, // SET of weekly price IDs
  weekly: (id: string) => `wp:${id}`,          // HASH per weekly price
  symbolIndex: (sym: string) => `sym:${sym.toUpperCase()}`, // symbol → stock id
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface IpoStock {
  id: string; symbol: string; name: string; sector: string; ipoDate: string
  ipoPrice: number; ipoOpenPrice: number; ipoDayLow: number; ipoDayHigh: number
  currentPrice: number; listingGainPct: number; marketCap: string; exchange: string
  horizontalPivotScore: number; volumeDryUpScore: number; breakoutVolumeScore: number
  vcpScore: number; priceVsIpoLowScore: number; weeklyConvictionScore: number
  totalScore: number; baseStatus: string; baseWeeks: number
  pivotLevel: number | null; supportLevel: number | null; breakoutDate: string | null
  recommendation: string; lastUpdated: string | null; dataSource: string
  // New pre-breakout signals
  rsScore: number | null        // Relative Strength vs Nifty 50 (0–100)
  pocketPivotScore: number | null // Pocket pivot accumulation signal (0–100)
  proximityToPivot: number | null // % distance from current price to pivot (negative = below pivot)
}

export interface DailyPrice {
  id: string; stockId: string; date: string
  open: number; high: number; low: number; close: number; volume: number
}

export interface WeeklyPrice {
  id: string; stockId: string; date: string
  open: number; high: number; low: number; close: number; volume: number
}

// ─── Serialise / deserialise (Redis stores strings) ──────────────────────────
function numFields<T extends object>(obj: T, fields: (keyof T)[]): T {
  const out = { ...obj }
  for (const f of fields) {
    const v = (out as any)[f]
    if (v !== null && v !== undefined && v !== 'null') (out as any)[f] = Number(v)
    else if (v === 'null') (out as any)[f] = null
  }
  return out
}

function stockFromRedis(raw: any): IpoStock {
  return numFields(raw, [
    'ipoPrice','ipoOpenPrice','ipoDayLow','ipoDayHigh','currentPrice',
    'listingGainPct','horizontalPivotScore','volumeDryUpScore','breakoutVolumeScore',
    'vcpScore','priceVsIpoLowScore','weeklyConvictionScore','totalScore','baseWeeks',
    'pivotLevel','supportLevel','rsScore','pocketPivotScore','proximityToPivot',
  ]) as IpoStock
}

function priceFromRedis(raw: any): DailyPrice | WeeklyPrice {
  return numFields(raw, ['open','high','low','close','volume']) as any
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getAllStockIds(): Promise<string[]> {
  return (await redis.smembers(KEYS.stockSet)) as string[]
}

async function getStockById(id: string): Promise<IpoStock | null> {
  const raw = await redis.hgetall(KEYS.stock(id))
  if (!raw || Object.keys(raw).length === 0) return null
  return stockFromRedis(raw)
}

async function getDailyPrices(stockId: string): Promise<DailyPrice[]> {
  const ids = (await redis.smembers(KEYS.dailySet(stockId))) as string[]
  if (!ids.length) return []
  const prices = await Promise.all(ids.map(id => redis.hgetall(KEYS.daily(id))))
  return prices
    .filter(Boolean)
    .map(p => priceFromRedis(p) as DailyPrice)
    .sort((a, b) => a.date.localeCompare(b.date))
}

async function getWeeklyPrices(stockId: string): Promise<WeeklyPrice[]> {
  const ids = (await redis.smembers(KEYS.weeklySet(stockId))) as string[]
  if (!ids.length) return []
  const prices = await Promise.all(ids.map(id => redis.hgetall(KEYS.weekly(id))))
  return prices
    .filter(Boolean)
    .map(p => priceFromRedis(p) as WeeklyPrice)
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ─── Public db object (Prisma-compatible API) ─────────────────────────────────
export const db = {
  ipoStock: {
    async count(): Promise<number> {
      return redis.scard(KEYS.stockSet)
    },

    async findMany(args?: {
      where?: any
      orderBy?: Record<string, 'asc' | 'desc'>
      include?: { dailyPrices?: any; weeklyPrices?: any }
      select?: Record<string, boolean>
    }): Promise<any[]> {
      const ids = await getAllStockIds()
      if (!ids.length) return []

      const stocks = (await Promise.all(ids.map(getStockById))).filter(Boolean) as IpoStock[]

      // Filter
      let results = stocks
      if (args?.where) {
        const w = args.where
        results = results.filter(s => {
          if (w.baseStatus && s.baseStatus !== w.baseStatus) return false
          if (w.recommendation && s.recommendation !== w.recommendation) return false
          if (w.totalScore?.gte !== undefined && s.totalScore < w.totalScore.gte) return false
          if (w.OR) {
            return w.OR.some((cond: any) => {
              const sub = cond.symbol?.contains || cond.name?.contains || ''
              if (cond.symbol?.contains) return s.symbol.toLowerCase().includes(sub.toLowerCase())
              if (cond.name?.contains) return s.name.toLowerCase().includes(sub.toLowerCase())
              return false
            })
          }
          return true
        })
      }

      // Sort
      if (args?.orderBy) {
        const [key, dir] = Object.entries(args.orderBy)[0]
        results.sort((a: any, b: any) => {
          const av = a[key] ?? 0, bv = b[key] ?? 0
          return dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
        })
      }

      // Include relations
      if (args?.include) {
        return Promise.all(results.map(async s => ({
          ...s,
          ...(args.include!.dailyPrices ? { dailyPrices: await getDailyPrices(s.id) } : {}),
          ...(args.include!.weeklyPrices ? { weeklyPrices: await getWeeklyPrices(s.id) } : {}),
        })))
      }

      // Select
      if (args?.select) {
        const keys = Object.keys(args.select).filter(k => args.select![k])
        return results.map(s => Object.fromEntries(keys.map(k => [k, (s as any)[k]])))
      }

      return results
    },

    async findUnique(args: {
      where: { id?: string; symbol?: string }
      include?: { dailyPrices?: any; weeklyPrices?: any }
    }): Promise<any | null> {
      let id = args.where.id
      if (!id && args.where.symbol) {
        id = (await redis.get(KEYS.symbolIndex(args.where.symbol))) as string | undefined
      }
      if (!id) return null
      const stock = await getStockById(id)
      if (!stock) return null
      if (args.include) {
        return {
          ...stock,
          ...(args.include.dailyPrices ? { dailyPrices: await getDailyPrices(id) } : {}),
          ...(args.include.weeklyPrices ? { weeklyPrices: await getWeeklyPrices(id) } : {}),
        }
      }
      return stock
    },

    async create(args: { data: any; include?: any }): Promise<any> {
      const { dailyPrices: dpCreate, weeklyPrices: wpCreate, ...stockData } = args.data
      const id = stockData.id || cuid()

      const stock: IpoStock = {
        id,
        symbol: stockData.symbol,
        name: stockData.name,
        sector: stockData.sector,
        ipoDate: stockData.ipoDate,
        ipoPrice: stockData.ipoPrice,
        ipoOpenPrice: stockData.ipoOpenPrice ?? stockData.ipoPrice,
        ipoDayLow: stockData.ipoDayLow ?? stockData.ipoPrice * 0.95,
        ipoDayHigh: stockData.ipoDayHigh ?? stockData.ipoPrice * 1.1,
        currentPrice: stockData.currentPrice ?? stockData.ipoPrice,
        listingGainPct: stockData.listingGainPct ?? 0,
        marketCap: stockData.marketCap ?? '',
        exchange: stockData.exchange ?? 'NSE',
        horizontalPivotScore: stockData.horizontalPivotScore ?? 0,
        volumeDryUpScore: stockData.volumeDryUpScore ?? 0,
        breakoutVolumeScore: stockData.breakoutVolumeScore ?? 0,
        vcpScore: stockData.vcpScore ?? 0,
        priceVsIpoLowScore: stockData.priceVsIpoLowScore ?? 0,
        weeklyConvictionScore: stockData.weeklyConvictionScore ?? 0,
        totalScore: stockData.totalScore ?? 0,
        baseStatus: stockData.baseStatus ?? 'FORMING',
        baseWeeks: stockData.baseWeeks ?? 0,
        pivotLevel: stockData.pivotLevel ?? null,
        supportLevel: stockData.supportLevel ?? null,
        breakoutDate: stockData.breakoutDate ?? null,
        recommendation: stockData.recommendation ?? 'WATCH',
        lastUpdated: stockData.lastUpdated ?? null,
        dataSource: stockData.dataSource ?? 'seed',
        rsScore: stockData.rsScore ?? null,
        pocketPivotScore: stockData.pocketPivotScore ?? null,
        proximityToPivot: stockData.proximityToPivot ?? null,
      }

      // Persist stock
      const pipe = redis.pipeline()
      pipe.hset(KEYS.stock(id), stock as any)
      pipe.sadd(KEYS.stockSet, id)
      pipe.set(KEYS.symbolIndex(stock.symbol), id)

      // Persist daily prices
      if (dpCreate?.create) {
        for (const dp of dpCreate.create) {
          const pid = cuid()
          pipe.hset(KEYS.daily(pid), { ...dp, id: pid, stockId: id })
          pipe.sadd(KEYS.dailySet(id), pid)
        }
      } else if (Array.isArray(dpCreate)) {
        for (const dp of dpCreate) {
          const pid = cuid()
          pipe.hset(KEYS.daily(pid), { ...dp, id: pid, stockId: id })
          pipe.sadd(KEYS.dailySet(id), pid)
        }
      }

      // Persist weekly prices
      if (wpCreate?.create) {
        for (const wp of wpCreate.create) {
          const pid = cuid()
          pipe.hset(KEYS.weekly(pid), { ...wp, id: pid, stockId: id })
          pipe.sadd(KEYS.weeklySet(id), pid)
        }
      } else if (Array.isArray(wpCreate)) {
        for (const wp of wpCreate) {
          const pid = cuid()
          pipe.hset(KEYS.weekly(pid), { ...wp, id: pid, stockId: id })
          pipe.sadd(KEYS.weeklySet(id), pid)
        }
      }

      await pipe.exec()

      if (args.include) {
        return {
          ...stock,
          dailyPrices: await getDailyPrices(id),
          weeklyPrices: await getWeeklyPrices(id),
        }
      }
      return stock
    },

    async update(args: { where: { id: string }; data: Partial<IpoStock> }): Promise<IpoStock> {
      const existing = await getStockById(args.where.id)
      if (!existing) throw new Error(`Stock ${args.where.id} not found`)
      const updated = { ...existing, ...args.data }
      await redis.hset(KEYS.stock(args.where.id), updated as any)
      return updated
    },

    async deleteMany(): Promise<{ count: number }> {
      const ids = await getAllStockIds()
      const pipe = redis.pipeline()
      for (const id of ids) {
        const stock = await getStockById(id)
        if (stock) pipe.del(KEYS.symbolIndex(stock.symbol))
        // daily prices
        const dailyIds = (await redis.smembers(KEYS.dailySet(id))) as string[]
        for (const pid of dailyIds) pipe.del(KEYS.daily(pid))
        pipe.del(KEYS.dailySet(id))
        // weekly prices
        const weeklyIds = (await redis.smembers(KEYS.weeklySet(id))) as string[]
        for (const pid of weeklyIds) pipe.del(KEYS.weekly(pid))
        pipe.del(KEYS.weeklySet(id))
        pipe.del(KEYS.stock(id))
      }
      pipe.del(KEYS.stockSet)
      await pipe.exec()
      return { count: ids.length }
    },

    async delete(args: { where: { id?: string; symbol?: string } }): Promise<IpoStock> {
      let id = args.where.id
      if (!id && args.where.symbol) {
        id = (await redis.get(KEYS.symbolIndex(args.where.symbol))) as string
      }
      if (!id) throw new Error('Stock not found')
      const stock = await getStockById(id)
      if (!stock) throw new Error('Stock not found')

      // Delete daily + weekly prices
      const [dailyIds, weeklyIds] = await Promise.all([
        redis.smembers(KEYS.dailySet(id)) as Promise<string[]>,
        redis.smembers(KEYS.weeklySet(id)) as Promise<string[]>,
      ])
      const pipe = redis.pipeline()
      for (const pid of dailyIds) pipe.del(KEYS.daily(pid))
      for (const pid of weeklyIds) pipe.del(KEYS.weekly(pid))
      pipe.del(KEYS.dailySet(id))
      pipe.del(KEYS.weeklySet(id))
      pipe.del(KEYS.stock(id))
      pipe.srem(KEYS.stockSet, id)
      pipe.del(KEYS.symbolIndex(stock.symbol))
      await pipe.exec()

      return stock
    },
  },

  dailyPrice: {
    async createMany(args: { data: Omit<DailyPrice, 'id'>[] }): Promise<{ count: number }> {
      const pipe = redis.pipeline()
      for (const dp of args.data) {
        const id = cuid()
        pipe.hset(KEYS.daily(id), { ...dp, id })
        pipe.sadd(KEYS.dailySet(dp.stockId), id)
      }
      await pipe.exec()
      return { count: args.data.length }
    },

    async deleteMany(args?: { where?: { stock?: { id?: string; symbol?: string } } }): Promise<{ count: number }> {
      if (!args?.where?.stock) {
        // Clear ALL daily prices
        const stockIds = await getAllStockIds()
        const pipe = redis.pipeline()
        for (const sid of stockIds) {
          const ids = (await redis.smembers(KEYS.dailySet(sid))) as string[]
          for (const pid of ids) pipe.del(KEYS.daily(pid))
          pipe.del(KEYS.dailySet(sid))
        }
        await pipe.exec()
        return { count: 0 }
      }
      let stockId = args.where.stock.id
      if (!stockId && args.where.stock.symbol) {
        stockId = (await redis.get(KEYS.symbolIndex(args.where.stock.symbol))) as string
      }
      if (!stockId) return { count: 0 }
      const ids = (await redis.smembers(KEYS.dailySet(stockId))) as string[]
      const pipe = redis.pipeline()
      for (const pid of ids) pipe.del(KEYS.daily(pid))
      pipe.del(KEYS.dailySet(stockId))
      await pipe.exec()
      return { count: ids.length }
    },
  },

  weeklyPrice: {
    async createMany(args: { data: Omit<WeeklyPrice, 'id'>[] }): Promise<{ count: number }> {
      const pipe = redis.pipeline()
      for (const wp of args.data) {
        const id = cuid()
        pipe.hset(KEYS.weekly(id), { ...wp, id })
        pipe.sadd(KEYS.weeklySet(wp.stockId), id)
      }
      await pipe.exec()
      return { count: args.data.length }
    },

    async deleteMany(args?: { where?: { stock?: { id?: string; symbol?: string } } }): Promise<{ count: number }> {
      if (!args?.where?.stock) {
        const stockIds = await getAllStockIds()
        const pipe = redis.pipeline()
        for (const sid of stockIds) {
          const ids = (await redis.smembers(KEYS.weeklySet(sid))) as string[]
          for (const pid of ids) pipe.del(KEYS.weekly(pid))
          pipe.del(KEYS.weeklySet(sid))
        }
        await pipe.exec()
        return { count: 0 }
      }
      let stockId = args.where.stock.id
      if (!stockId && args.where.stock.symbol) {
        stockId = (await redis.get(KEYS.symbolIndex(args.where.stock.symbol))) as string
      }
      if (!stockId) return { count: 0 }
      const ids = (await redis.smembers(KEYS.weeklySet(stockId))) as string[]
      const pipe = redis.pipeline()
      for (const pid of ids) pipe.del(KEYS.weekly(pid))
      pipe.del(KEYS.weeklySet(stockId))
      await pipe.exec()
      return { count: ids.length }
    },
  },
}
