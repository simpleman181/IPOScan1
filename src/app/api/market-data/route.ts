import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/chart/'
const YAHOO_SEARCH_URL = 'https://query1.finance.yahoo.com/v1/finance/search'

function toYahooSymbol(symbol: string, exchange: string = 'NSE'): string {
  const mapping: Record<string, string> = {
    'MTAR': 'MTARTECH.NS',
    'ADANIWILMAR': 'AWL.NS',
    'ETHOS': 'ETHOSLTD.NS',
    'PHARMEASY': 'PHARMASY.NS',
    'HAPPSTMNDS': 'HAPPSTMNDS.NS',
    'METROBRAND': 'METROBRAND.NS',
  }
  if (mapping[symbol]) return mapping[symbol]
  return exchange === 'BSE' ? `${symbol}.BO` : `${symbol}.NS`
}

async function fetchWithTimeout(url: string, timeoutMs: number = 8000) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    clearTimeout(timeoutId)
    return response
  } catch {
    return null
  }
}

async function searchYahooStocks(query: string) {
  const url = `${YAHOO_SEARCH_URL}?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`
  const response = await fetchWithTimeout(url, 8000)
  if (!response || !response.ok) return []

  const data = await response.json()
  const results = (data.quotes || [])
    .filter((q: any) => q.symbol && (q.symbol.endsWith('.NS') || q.symbol.endsWith('.BO')))
    .map((q: any) => ({
      symbol: q.symbol.replace(/\.(NS|BO)$/, ''),
      yahooSymbol: q.symbol,
      name: q.shortname || q.longname || q.symbol,
      exchange: q.symbol.endsWith('.NS') ? 'NSE' : 'BSE',
      sector: q.sector || '',
    }))

  // Fallback: try direct symbol validation
  if (results.length === 0) {
    for (const suffix of ['.NS', '.BO']) {
      const chartUrl = `${YAHOO_CHART_URL}${query.toUpperCase()}${suffix}?range=1d&interval=1d`
      const chartResp = await fetchWithTimeout(chartUrl, 8000)
      if (chartResp && chartResp.ok) {
        const chartData = await chartResp.json()
        const result = chartData?.chart?.result?.[0]
        if (result?.meta?.regularMarketPrice) {
          results.push({
            symbol: query.toUpperCase(),
            yahooSymbol: `${query.toUpperCase()}${suffix}`,
            name: result.meta.shortName || query.toUpperCase(),
            exchange: suffix === '.NS' ? 'NSE' : 'BSE',
            sector: '',
          })
          break
        }
      }
    }
  }

  return results
}

async function fetchLatestPrice(yahooSymbol: string) {
  const url = `${YAHOO_CHART_URL}${yahooSymbol}?range=5d&interval=1d`
  const response = await fetchWithTimeout(url, 8000)
  if (!response || !response.ok) return null

  const data = await response.json()
  const result = data?.chart?.result?.[0]
  if (!result?.meta?.regularMarketPrice) return null

  return {
    price: result.meta.regularMarketPrice,
    previousClose: result.meta.chartPreviousClose || result.meta.previousClose,
  }
}

async function fetchFullHistory(yahooSymbol: string) {
  const url = `${YAHOO_CHART_URL}${yahooSymbol}?range=6mo&interval=1d`
  const response = await fetchWithTimeout(url, 15000)
  if (!response || !response.ok) return null

  const data = await response.json()
  const result = data?.chart?.result?.[0]
  if (!result?.timestamp || !result?.indicators) return null

  const timestamps = result.timestamp as number[]
  const quotes = result.indicators.quote[0]
  const dailyPrices: { date: string; open: number; high: number; low: number; close: number; volume: number }[] = []

  for (let i = 0; i < timestamps.length; i++) {
    if (quotes.open[i] == null || quotes.close[i] == null) continue
    const d = new Date(timestamps[i] * 1000)
    dailyPrices.push({
      date: d.toISOString().split('T')[0],
      open: Math.round(quotes.open[i] * 100) / 100,
      high: Math.round(quotes.high[i] * 100) / 100,
      low: Math.round(quotes.low[i] * 100) / 100,
      close: Math.round(quotes.close[i] * 100) / 100,
      volume: Math.round(quotes.volume[i] || 0),
    })
  }

  return { dailyPrices, meta: result.meta }
}

function aggregateWeeklyPrices(dailyPrices: { date: string; open: number; high: number; low: number; close: number; volume: number }[]) {
  const weeks: Map<string, { date: string; open: number; high: number; low: number; close: number; volume: number }> = new Map()
  for (const dp of dailyPrices) {
    const d = new Date(dp.date)
    const dayOfWeek = d.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(d)
    monday.setDate(d.getDate() + mondayOffset)
    const weekKey = monday.toISOString().split('T')[0]

    if (!weeks.has(weekKey)) {
      weeks.set(weekKey, { date: weekKey, open: dp.open, high: dp.high, low: dp.low, close: dp.close, volume: dp.volume })
    } else {
      const w = weeks.get(weekKey)!
      w.high = Math.max(w.high, dp.high)
      w.low = Math.min(w.low, dp.low)
      w.close = dp.close
      w.volume += dp.volume
    }
  }
  return Array.from(weeks.values())
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { mode, query, stockId, fullHistory, customSymbol } = body

    if (mode === 'search') {
      if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 })
      const results = await searchYahooStocks(query)
      return NextResponse.json({ results })
    }

    if (mode === 'prices') {
      // Refresh latest price for ALL stocks
      const stocks = await db.ipoStock.findMany()
      let updated = 0
      for (const stock of stocks) {
        const yahooSymbol = toYahooSymbol(stock.symbol, stock.exchange)
        const data = await fetchLatestPrice(yahooSymbol)
        if (data) {
          await db.ipoStock.update({
            where: { id: stock.id },
            data: { currentPrice: data.price },
          })
          // Update last daily price bar
          const lastDaily = await db.dailyPrice.findFirst({
            where: { stockId: stock.id },
            orderBy: { date: 'desc' },
          })
          if (lastDaily) {
            await db.dailyPrice.update({
              where: { id: lastDaily.id },
              data: { close: data.price, high: Math.max(lastDaily.high, data.price) },
            })
          }
          updated++
        }
        await new Promise(r => setTimeout(r, 200))
      }
      return NextResponse.json({ message: `Updated prices for ${updated}/${stocks.length} stocks`, updated })
    }

    if (mode === 'full') {
      // Replace ALL price data with 6-month historical
      const stocks = await db.ipoStock.findMany()
      let updated = 0
      for (const stock of stocks) {
        const yahooSymbol = toYahooSymbol(stock.symbol, stock.exchange)
        const data = await fetchFullHistory(yahooSymbol)
        if (data && data.dailyPrices.length > 0) {
          // Delete old prices
          await db.dailyPrice.deleteMany({ where: { stockId: stock.id } })
          await db.weeklyPrice.deleteMany({ where: { stockId: stock.id } })

          // Create new prices
          await db.dailyPrice.createMany({ data: data.dailyPrices.map(p => ({ ...p, stockId: stock.id })) })

          const weeklyPrices = aggregateWeeklyPrices(data.dailyPrices)
          await db.weeklyPrice.createMany({ data: weeklyPrices.map(p => ({ ...p, stockId: stock.id })) })

          // Update current price
          const lastPrice = data.dailyPrices[data.dailyPrices.length - 1].close
          await db.ipoStock.update({
            where: { id: stock.id },
            data: { currentPrice: lastPrice },
          })
          updated++
        } else {
          // Fallback: just try latest price
          const priceData = await fetchLatestPrice(yahooSymbol)
          if (priceData) {
            await db.ipoStock.update({
              where: { id: stock.id },
              data: { currentPrice: priceData.price },
            })
          }
        }
        await new Promise(r => setTimeout(r, 300))
      }
      return NextResponse.json({ message: `Full refresh complete for ${updated}/${stocks.length} stocks`, updated })
    }

    if (mode === 'single') {
      if (!stockId) return NextResponse.json({ error: 'stockId required' }, { status: 400 })
      const stock = await db.ipoStock.findUnique({ where: { id: stockId } })
      if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

      const yahooSymbol = customSymbol || toYahooSymbol(stock.symbol, stock.exchange)

      if (fullHistory) {
        const data = await fetchFullHistory(yahooSymbol)
        if (data && data.dailyPrices.length > 0) {
          await db.dailyPrice.deleteMany({ where: { stockId: stock.id } })
          await db.weeklyPrice.deleteMany({ where: { stockId: stock.id } })
          await db.dailyPrice.createMany({ data: data.dailyPrices.map(p => ({ ...p, stockId: stock.id })) })
          const weeklyPrices = aggregateWeeklyPrices(data.dailyPrices)
          await db.weeklyPrice.createMany({ data: weeklyPrices.map(p => ({ ...p, stockId: stock.id })) })
          const lastPrice = data.dailyPrices[data.dailyPrices.length - 1].close
          await db.ipoStock.update({ where: { id: stock.id }, data: { currentPrice: lastPrice } })
          return NextResponse.json({ message: 'Full history updated', priceCount: data.dailyPrices.length })
        }
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
      } else {
        const data = await fetchLatestPrice(yahooSymbol)
        if (data) {
          await db.ipoStock.update({ where: { id: stock.id }, data: { currentPrice: data.price } })
          return NextResponse.json({ message: 'Price updated', price: data.price })
        }
        return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 })
      }
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
      select: { id: true, symbol: true, name: true, currentPrice: true, exchange: true },
    })
    return NextResponse.json({ stocks, count: stocks.length })
  } catch (error) {
    console.error('Market data GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch market data status' }, { status: 500 })
  }
}
