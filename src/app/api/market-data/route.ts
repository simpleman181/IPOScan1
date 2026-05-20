import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

const YAHOO_SEARCH_URL = 'https://query1.finance.yahoo.com/v1/finance/search'

async function fetchWithTimeout(url: string, timeoutMs: number = 10000) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    })
    clearTimeout(timeoutId)
    return response
  } catch { return null }
}

async function searchYahooStocks(query: string) {
  const url = `${YAHOO_SEARCH_URL}?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`
  const response = await fetchWithTimeout(url, 8000)
  if (response && response.ok) {
    try {
      const data = await response.json()
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
      // The price-fetcher service (port 3002) handles live data refresh and updates the DB directly.
      // It auto-refreshes every 5 minutes and on startup.
      // This endpoint just reads current DB state and reports status.
      const stocks = await db.ipoStock.findMany({ select: { id: true, lastUpdated: true, dataSource: true } })
      const liveCount = stocks.filter(s => s.dataSource !== 'seed' && s.lastUpdated && s.lastUpdated !== 'never').length

      return NextResponse.json({
        message: liveCount > 0
          ? `Live prices refreshed. ${liveCount}/${stocks.length} stocks have live data.`
          : 'Price refresh is running in the background. Please wait ~2 minutes and refresh the page.',
        updated: liveCount,
        total: stocks.length,
        timestamp: new Date().toISOString(),
      })
    }

    if (mode === 'single') {
      if (!stockId) return NextResponse.json({ error: 'stockId required' }, { status: 400 })
      const stock = await db.ipoStock.findUnique({ where: { id: stockId } })
      if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })
      return NextResponse.json({ message: 'Stock data from DB', price: stock.currentPrice, source: stock.dataSource })
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
    const lastUpdated = stocks.reduce((latest: string, s) => {
      return s.lastUpdated && s.lastUpdated !== 'never' && s.lastUpdated > latest ? s.lastUpdated : latest
    }, '')
    return NextResponse.json({ stocks, count: stocks.length, lastUpdated })
  } catch (error) {
    console.error('Market data GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch market data status' }, { status: 500 })
  }
}
