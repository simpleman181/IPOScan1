import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart'
const YAHOO_SEARCH_URL = 'https://query1.finance.yahoo.com/v1/finance/search'

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response | null> {
  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    })
    clearTimeout(id)
    return res
  } catch {
    return null
  }
}

async function fetchYahooPrice(symbol: string, exchange: string): Promise<number | null> {
  // Try NSE first (.NS), then BSE (.BO)
  const suffixes = exchange === 'BSE' ? ['.BO', '.NS'] : ['.NS', '.BO']
  for (const suffix of suffixes) {
    const yahooSymbol = `${symbol}${suffix}`
    const url = `${YAHOO_QUOTE_URL}/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`
    const res = await fetchWithTimeout(url)
    if (!res || !res.ok) continue
    try {
      const data = await res.json()
      const quote = data?.chart?.result?.[0]
      if (!quote) continue
      const closes = quote.indicators?.quote?.[0]?.close
      const meta = quote.meta
      // Use regularMarketPrice or last close
      const price = meta?.regularMarketPrice || (closes && closes.filter(Boolean).slice(-1)[0])
      if (price && price > 0) return price
    } catch { /* continue */ }
  }
  return null
}

async function searchYahooStocks(query: string) {
  const url = `${YAHOO_SEARCH_URL}?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`
  const res = await fetchWithTimeout(url)
  if (res && res.ok) {
    try {
      const data = await res.json()
      return (data.quotes || [])
        .filter((q: any) => q.symbol && (q.symbol.endsWith('.NS') || q.symbol.endsWith('.BO')))
        .map((q: any) => ({
          symbol: q.symbol.replace(/\.(NS|BO)$/, ''),
          yahooSymbol: q.symbol,
          name: q.shortname || q.longname || q.symbol,
          exchange: q.symbol.endsWith('.NS') ? 'NSE' : 'BSE',
          sector: q.sector || '',
        }))
    } catch { /* ignore */ }
  }
  return []
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { mode, query, stockId } = body

    if (mode === 'search') {
      if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 })
      const results = await searchYahooStocks(query)
      return NextResponse.json({ results })
    }

    if (mode === 'prices' || mode === 'full') {
      const stocks = await db.ipoStock.findMany({
        select: { id: true, symbol: true, exchange: true, currentPrice: true, dataSource: true, lastUpdated: true },
      })

      if (stocks.length === 0) {
        return NextResponse.json({ message: 'No stocks to update', updated: 0, total: 0 })
      }

      let updated = 0
      let failed = 0

      // Fetch prices in parallel batches of 5 to avoid rate limiting
      const BATCH = 5
      for (let i = 0; i < stocks.length; i += BATCH) {
        const batch = stocks.slice(i, i + BATCH)
        await Promise.all(batch.map(async (stock: any) => {
          const price = await fetchYahooPrice(stock.symbol, stock.exchange)
          if (price) {
            await db.ipoStock.update({
              where: { id: stock.id },
              data: {
                currentPrice: Math.round(price * 100) / 100,
                lastUpdated: new Date().toISOString(),
                dataSource: 'live',
              },
            })
            updated++
          } else {
            failed++
          }
        }))
        // Small delay between batches
        if (i + BATCH < stocks.length) await new Promise(r => setTimeout(r, 200))
      }

      return NextResponse.json({
        message: `Live prices refreshed. ${updated}/${stocks.length} stocks updated.${failed > 0 ? ` (${failed} failed - using last known prices)` : ''}`,
        updated,
        failed,
        total: stocks.length,
        timestamp: new Date().toISOString(),
      })
    }

    if (mode === 'single') {
      if (!stockId) return NextResponse.json({ error: 'stockId required' }, { status: 400 })
      const stock = await db.ipoStock.findUnique({ where: { id: stockId } })
      if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })
      const price = await fetchYahooPrice(stock.symbol, stock.exchange)
      if (price) {
        const updated = await db.ipoStock.update({
          where: { id: stockId },
          data: { currentPrice: price, lastUpdated: new Date().toISOString(), dataSource: 'live' },
        })
        return NextResponse.json({ message: 'Price updated', price: updated.currentPrice, source: 'live' })
      }
      return NextResponse.json({ message: 'Could not fetch live price', price: stock.currentPrice, source: stock.dataSource })
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  } catch (error) {
    console.error('Market data error:', error)
    return NextResponse.json({ error: 'Failed to process market data request' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const stocks = await db.ipoStock.findMany({
      select: { id: true, symbol: true, name: true, currentPrice: true, exchange: true, lastUpdated: true, dataSource: true },
    })
    const lastUpdated = (stocks as any[]).reduce((latest: string, s: any) => {
      return s.lastUpdated && s.lastUpdated !== 'never' && s.lastUpdated > latest ? s.lastUpdated : latest
    }, '')
    return NextResponse.json({ stocks, count: stocks.length, lastUpdated })
  } catch (error) {
    console.error('Market data GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch market data status' }, { status: 500 })
  }
}
