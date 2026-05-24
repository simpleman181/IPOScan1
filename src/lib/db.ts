/**
 * In-memory database replacing Prisma/SQLite for Vercel serverless compatibility.
 * Module-level state persists within warm function instances.
 * The app seeds itself on first request via /api/seed.
 */

import { randomBytes } from 'crypto'

function cuid(): string {
  return 'c' + randomBytes(16).toString('hex')
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IpoStock {
  id: string
  symbol: string
  name: string
  sector: string
  ipoDate: string
  ipoPrice: number
  ipoOpenPrice: number
  ipoDayLow: number
  ipoDayHigh: number
  currentPrice: number
  listingGainPct: number
  marketCap: string
  exchange: string
  horizontalPivotScore: number
  volumeDryUpScore: number
  breakoutVolumeScore: number
  vcpScore: number
  priceVsIpoLowScore: number
  weeklyConvictionScore: number
  totalScore: number
  baseStatus: string
  baseWeeks: number
  pivotLevel: number | null
  supportLevel: number | null
  breakoutDate: string | null
  recommendation: string
  lastUpdated: string | null
  dataSource: string
}

export interface DailyPrice {
  id: string
  stockId: string
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface WeeklyPrice {
  id: string
  stockId: string
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// ─── In-Memory Store ──────────────────────────────────────────────────────────

const store = {
  stocks: new Map<string, IpoStock>(),
  dailyPrices: new Map<string, DailyPrice>(),
  weeklyPrices: new Map<string, WeeklyPrice>(),
}

// ─── Helper: case-insensitive contains ───────────────────────────────────────

function icontains(str: string, sub: string): boolean {
  return str.toLowerCase().includes(sub.toLowerCase())
}

// ─── Prisma-compatible db object ─────────────────────────────────────────────

export const db = {
  ipoStock: {
    async count(): Promise<number> {
      return store.stocks.size
    },

    async findMany(args?: {
      where?: Partial<IpoStock> & { OR?: any[]; totalScore?: { gte: number } }
      orderBy?: Record<string, 'asc' | 'desc'>
      include?: { dailyPrices?: boolean | object; weeklyPrices?: boolean | object }
      select?: Record<string, boolean>
    }): Promise<any[]> {
      let results = Array.from(store.stocks.values())

      if (args?.where) {
        const w = args.where
        results = results.filter(s => {
          if (w.baseStatus && s.baseStatus !== w.baseStatus) return false
          if (w.recommendation && s.recommendation !== w.recommendation) return false
          if (w.totalScore?.gte !== undefined && s.totalScore < w.totalScore.gte) return false
          if (w.OR) {
            return w.OR.some((cond: any) => {
              if (cond.symbol?.contains) return icontains(s.symbol, cond.symbol.contains)
              if (cond.name?.contains) return icontains(s.name, cond.name.contains)
              return false
            })
          }
          return true
        })
      }

      if (args?.orderBy) {
        const [key, dir] = Object.entries(args.orderBy)[0]
        results.sort((a: any, b: any) => {
          const av = a[key] ?? 0, bv = b[key] ?? 0
          return dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
        })
      }

      if (args?.include?.dailyPrices) {
        return results.map(s => ({
          ...s,
          dailyPrices: Array.from(store.dailyPrices.values())
            .filter(p => p.stockId === s.id)
            .sort((a, b) => a.date.localeCompare(b.date)),
        }))
      }
      if (args?.include) {
        const inc = args.include as any
        if (inc.dailyPrices && inc.weeklyPrices) {
          return results.map(s => ({
            ...s,
            dailyPrices: Array.from(store.dailyPrices.values())
              .filter(p => p.stockId === s.id)
              .sort((a, b) => a.date.localeCompare(b.date)),
            weeklyPrices: Array.from(store.weeklyPrices.values())
              .filter(p => p.stockId === s.id)
              .sort((a, b) => a.date.localeCompare(b.date)),
          }))
        }
      }

      if (args?.select) {
        const keys = Object.keys(args.select).filter(k => args.select![k])
        return results.map(s => Object.fromEntries(keys.map(k => [k, (s as any)[k]])))
      }

      return results
    },

    async findUnique(args: {
      where: { id?: string; symbol?: string }
      include?: { dailyPrices?: boolean | object; weeklyPrices?: boolean | object }
    }): Promise<any | null> {
      let stock: IpoStock | undefined
      if (args.where.id) stock = store.stocks.get(args.where.id)
      else if (args.where.symbol) stock = Array.from(store.stocks.values()).find(s => s.symbol === args.where.symbol)
      if (!stock) return null

      if (args.include) {
        const inc = args.include as any
        const result: any = { ...stock }
        if (inc.dailyPrices) {
          result.dailyPrices = Array.from(store.dailyPrices.values())
            .filter(p => p.stockId === stock!.id)
            .sort((a, b) => a.date.localeCompare(b.date))
        }
        if (inc.weeklyPrices) {
          result.weeklyPrices = Array.from(store.weeklyPrices.values())
            .filter(p => p.stockId === stock!.id)
            .sort((a, b) => a.date.localeCompare(b.date))
        }
        return result
      }
      return stock
    },

    async create(args: { data: Omit<IpoStock, 'id'> & { id?: string; dailyPrices?: { create: any[] }; weeklyPrices?: { create: any[] } }; include?: any }): Promise<IpoStock> {
      const { dailyPrices: dpCreate, weeklyPrices: wpCreate, ...stockData } = args.data as any
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
      }
      store.stocks.set(id, stock)

      if (dpCreate) {
        for (const dp of dpCreate) {
          const pid = cuid()
          store.dailyPrices.set(pid, { ...dp, id: pid, stockId: id })
        }
      }
      if (wpCreate) {
        for (const wp of wpCreate) {
          const pid = cuid()
          store.weeklyPrices.set(pid, { ...wp, id: pid, stockId: id })
        }
      }

      if (args.include) {
        return {
          ...stock,
          dailyPrices: Array.from(store.dailyPrices.values()).filter(p => p.stockId === id).sort((a, b) => a.date.localeCompare(b.date)),
          weeklyPrices: Array.from(store.weeklyPrices.values()).filter(p => p.stockId === id).sort((a, b) => a.date.localeCompare(b.date)),
        } as any
      }
      return stock
    },

    async update(args: { where: { id: string }; data: Partial<IpoStock> }): Promise<IpoStock> {
      const stock = store.stocks.get(args.where.id)
      if (!stock) throw new Error(`Stock ${args.where.id} not found`)
      const updated = { ...stock, ...args.data }
      store.stocks.set(args.where.id, updated)
      return updated
    },

    async delete(args: { where: { id?: string; symbol?: string } }): Promise<IpoStock> {
      let id: string | undefined
      if (args.where.id) {
        id = args.where.id
      } else if (args.where.symbol) {
        const found = Array.from(store.stocks.values()).find(s => s.symbol === args.where.symbol)
        id = found?.id
      }
      if (!id) throw new Error('Stock not found')
      const stock = store.stocks.get(id)!
      store.stocks.delete(id)
      return stock
    },
  },

  dailyPrice: {
    async createMany(args: { data: (Omit<DailyPrice, 'id'>)[] }): Promise<{ count: number }> {
      for (const dp of args.data) {
        const id = cuid()
        store.dailyPrices.set(id, { ...dp, id })
      }
      return { count: args.data.length }
    },

    async deleteMany(args?: { where?: { stock?: { id?: string; symbol?: string } } }): Promise<{ count: number }> {
      if (!args?.where?.stock) {
        const count = store.dailyPrices.size
        store.dailyPrices.clear()
        return { count }
      }
      let stockId: string | undefined
      if (args.where.stock.id) stockId = args.where.stock.id
      else if (args.where.stock.symbol) {
        const found = Array.from(store.stocks.values()).find(s => s.symbol === args!.where!.stock!.symbol)
        stockId = found?.id
      }
      if (!stockId) return { count: 0 }
      let count = 0
      for (const [id, dp] of store.dailyPrices) {
        if (dp.stockId === stockId) { store.dailyPrices.delete(id); count++ }
      }
      return { count }
    },
  },

  weeklyPrice: {
    async createMany(args: { data: (Omit<WeeklyPrice, 'id'>)[] }): Promise<{ count: number }> {
      for (const wp of args.data) {
        const id = cuid()
        store.weeklyPrices.set(id, { ...wp, id })
      }
      return { count: args.data.length }
    },

    async deleteMany(args?: { where?: { stock?: { id?: string; symbol?: string } } }): Promise<{ count: number }> {
      if (!args?.where?.stock) {
        const count = store.weeklyPrices.size
        store.weeklyPrices.clear()
        return { count }
      }
      let stockId: string | undefined
      if (args.where.stock.id) stockId = args.where.stock.id
      else if (args.where.stock.symbol) {
        const found = Array.from(store.stocks.values()).find(s => s.symbol === args!.where!.stock!.symbol)
        stockId = found?.id
      }
      if (!stockId) return { count: 0 }
      let count = 0
      for (const [id, wp] of store.weeklyPrices) {
        if (wp.stockId === stockId) { store.weeklyPrices.delete(id); count++ }
      }
      return { count }
    },
  },
}
