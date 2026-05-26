import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

const YF_BASE = 'https://query1.finance.yahoo.com'

async function yfFetch(url: string, timeoutMs = 9000): Promise<any | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Accept: 'application/json' },
    })
    clearTimeout(t)
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

function yahooSuffixes(exchange: string) {
  return exchange === 'BSE' ? ['.BO', '.NS'] : ['.NS', '.BO']
}

// ─── Fetch current price + market cap ────────────────────────────────────────
async function fetchQuote(symbol: string, exchange: string): Promise<{ price: number; marketCap: string } | null> {
  for (const sfx of yahooSuffixes(exchange)) {
    const data = await yfFetch(`${YF_BASE}/v8/finance/chart/${encodeURIComponent(symbol + sfx)}?interval=1d&range=1d`)
    const meta = data?.chart?.result?.[0]?.meta
    if (!meta) continue
    const price = meta.regularMarketPrice || meta.previousClose
    if (!price || price <= 0) continue
    const mc = meta.marketCap
    const marketCap = mc ? (mc >= 1e12 ? `${(mc / 1e7).toFixed(0)} Cr` : mc >= 1e9 ? `${(mc / 1e7).toFixed(0)} Cr` : mc >= 1e7 ? `${(mc / 1e7).toFixed(0)} Cr` : `${mc}`) : ''
    return { price: Math.round(price * 100) / 100, marketCap }
  }
  return null
}

// ─── Fetch 26 weeks of daily OHLCV history ───────────────────────────────────
async function fetchHistory(symbol: string, exchange: string): Promise<{ daily: any[]; weekly: any[] } | null> {
  for (const sfx of yahooSuffixes(exchange)) {
    const data = await yfFetch(`${YF_BASE}/v8/finance/chart/${encodeURIComponent(symbol + sfx)}?interval=1d&range=6mo`)
    const result = data?.chart?.result?.[0]
    if (!result) continue
    const ts: number[] = result.timestamp || []
    const q = result.indicators?.quote?.[0]
    if (!ts.length || !q) continue

    const daily: any[] = []
    for (let i = 0; i < ts.length; i++) {
      const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i]
      if (!o || !h || !l || !c) continue
      const d = new Date(ts[i] * 1000)
      if (d.getDay() === 0 || d.getDay() === 6) continue
      daily.push({
        date: d.toISOString().split('T')[0],
        open: +o.toFixed(2), high: +h.toFixed(2), low: +l.toFixed(2), close: +c.toFixed(2),
        volume: Math.round(v || 0),
      })
    }
    if (daily.length < 10) continue

    // Aggregate weekly
    const weeks = new Map<string, any>()
    for (const dp of daily) {
      const d = new Date(dp.date)
      const off = d.getDay() === 0 ? -6 : 1 - d.getDay()
      const mon = new Date(d); mon.setDate(d.getDate() + off)
      const wk = mon.toISOString().split('T')[0]
      if (!weeks.has(wk)) weeks.set(wk, { date: wk, ...dp })
      else {
        const w = weeks.get(wk)!
        w.high = Math.max(w.high, dp.high); w.low = Math.min(w.low, dp.low)
        w.close = dp.close; w.volume += dp.volume
      }
    }
    return { daily, weekly: Array.from(weeks.values()) }
  }
  return null
}

// ─── Yahoo Finance stock search ───────────────────────────────────────────────
async function searchYahoo(query: string) {
  const data = await yfFetch(`${YF_BASE}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`)
  return (data?.quotes || [])
    .filter((q: any) => q.symbol && (q.symbol.endsWith('.NS') || q.symbol.endsWith('.BO')))
    .map((q: any) => ({
      symbol: q.symbol.replace(/\.(NS|BO)$/, ''),
      yahooSymbol: q.symbol,
      name: q.shortname || q.longname || q.symbol,
      exchange: q.symbol.endsWith('.NS') ? 'NSE' : 'BSE',
      sector: q.sector || '',
    }))
}

// ─── Nifty 50 benchmark for RS calculation ────────────────────────────────────
async function fetchNifty50(): Promise<number[] | null> {
  const data = await yfFetch(`${YF_BASE}/v8/finance/chart/%5ENSEI?interval=1d&range=6mo`)
  const result = data?.chart?.result?.[0]
  if (!result) return null
  const closes = result.indicators?.quote?.[0]?.close || []
  return closes.filter(Boolean)
}

// ─── Handlers ─────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { mode, query, stockId } = body

    // ── Search ──────────────────────────────────────────────────────────────
    if (mode === 'search') {
      if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 })
      const results = await searchYahoo(query)
      return NextResponse.json({ results })
    }

    // ── Refresh current prices only ─────────────────────────────────────────
    if (mode === 'prices' || mode === 'full') {
      const stocks = await db.ipoStock.findMany({ select: { id: true, symbol: true, exchange: true } })
      if (!stocks.length) return NextResponse.json({ message: 'No stocks to update', updated: 0, total: 0 })

      let updated = 0, failed = 0
      const BATCH = 4
      for (let i = 0; i < stocks.length; i += BATCH) {
        await Promise.all(stocks.slice(i, i + BATCH).map(async (s: any) => {
          const q = await fetchQuote(s.symbol, s.exchange)
          if (q) {
            await db.ipoStock.update({
              where: { id: s.id },
              data: { currentPrice: q.price, lastUpdated: new Date().toISOString(), dataSource: 'live', ...(q.marketCap ? { marketCap: q.marketCap } : {}) },
            })
            updated++
          } else { failed++ }
        }))
        if (i + BATCH < stocks.length) await new Promise(r => setTimeout(r, 300))
      }
      return NextResponse.json({ message: `Prices refreshed. ${updated}/${stocks.length} updated.${failed ? ` (${failed} failed)` : ''}`, updated, failed, total: stocks.length, timestamp: new Date().toISOString() })
    }

    // ── Refresh real OHLCV history for all stocks ───────────────────────────
    if (mode === 'history') {
      const stocks = await db.ipoStock.findMany({ select: { id: true, symbol: true, exchange: true, ipoPrice: true, ipoOpenPrice: true, ipoDayLow: true } })
      if (!stocks.length) return NextResponse.json({ message: 'No stocks to update', updated: 0 })

      let updated = 0, failed = 0
      // Fetch Nifty 50 in parallel for RS scoring
      const niftyCloses = await fetchNifty50()

      const BATCH = 3 // smaller batch — history fetch is heavier
      for (let i = 0; i < stocks.length; i += BATCH) {
        await Promise.all(stocks.slice(i, i + BATCH).map(async (s: any) => {
          const hist = await fetchHistory(s.symbol, s.exchange)
          if (!hist || hist.daily.length < 10) { failed++; return }

          // Delete old price data and replace with real data
          await db.dailyPrice.deleteMany({ where: { stock: { id: s.id } } })
          await db.weeklyPrice.deleteMany({ where: { stock: { id: s.id } } })
          await db.dailyPrice.createMany({ data: hist.daily.map((p: any) => ({ ...p, stockId: s.id })) })
          await db.weeklyPrice.createMany({ data: hist.weekly.map((p: any) => ({ ...p, stockId: s.id })) })

          // Also update current price + market cap from the latest bar
          const last = hist.daily[hist.daily.length - 1]
          // Compute RS score vs Nifty if available
          let rsScore: number | null = null
          if (niftyCloses && niftyCloses.length >= 2) {
            const stockCloses = hist.daily.map((d: any) => d.close)
            const n = Math.min(63, stockCloses.length - 1, niftyCloses.length - 1)
            if (n > 0) {
              const stockReturn = (stockCloses[stockCloses.length - 1] - stockCloses[stockCloses.length - 1 - n]) / stockCloses[stockCloses.length - 1 - n]
              const niftyReturn = (niftyCloses[niftyCloses.length - 1] - niftyCloses[niftyCloses.length - 1 - n]) / niftyCloses[niftyCloses.length - 1 - n]
              const relOutperf = stockReturn - niftyReturn
              // Score 0–100: 0% = 0, +20% outperform = 80, +30%+ = 100
              rsScore = Math.min(100, Math.max(0, Math.round(50 + relOutperf * 200)))
            }
          }

          await db.ipoStock.update({
            where: { id: s.id },
            data: {
              currentPrice: last.close,
              lastUpdated: new Date().toISOString(),
              dataSource: 'live',
              ...(rsScore !== null ? { rsScore } : {}),
            },
          })
          updated++
        }))
        if (i + BATCH < stocks.length) await new Promise(r => setTimeout(r, 500))
      }
      return NextResponse.json({ message: `History refreshed. ${updated}/${stocks.length} stocks updated with real OHLCV.${failed ? ` (${failed} failed — using synthetic data)` : ''}`, updated, failed, total: stocks.length, timestamp: new Date().toISOString() })
    }

    // ── Single stock price ───────────────────────────────────────────────────
    if (mode === 'single') {
      if (!stockId) return NextResponse.json({ error: 'stockId required' }, { status: 400 })
      const stock = await db.ipoStock.findUnique({ where: { id: stockId } })
      if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })
      const q = await fetchQuote(stock.symbol, stock.exchange)
      if (q) {
        const updated = await db.ipoStock.update({ where: { id: stockId }, data: { currentPrice: q.price, lastUpdated: new Date().toISOString(), dataSource: 'live', ...(q.marketCap ? { marketCap: q.marketCap } : {}) } })
        return NextResponse.json({ message: 'Price updated', price: updated.currentPrice, source: 'live' })
      }
      return NextResponse.json({ message: 'Could not fetch live price', price: stock.currentPrice, source: stock.dataSource })
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  } catch (error) {
    console.error('Market data error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const stocks = await db.ipoStock.findMany({ select: { id: true, symbol: true, name: true, currentPrice: true, exchange: true, lastUpdated: true, dataSource: true } })
    const lastUpdated = (stocks as any[]).reduce((l: string, s: any) => s.lastUpdated && s.lastUpdated > l ? s.lastUpdated : l, '')
    return NextResponse.json({ stocks, count: stocks.length, lastUpdated })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch market data status' }, { status: 500 })
  }
}
