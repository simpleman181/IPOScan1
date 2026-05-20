import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const recommendation = searchParams.get('recommendation')
    const minScore = searchParams.get('minScore')
    const sortBy = searchParams.get('sortBy') || 'totalScore'
    const search = searchParams.get('search')

    const where: any = {}
    if (status && status !== 'ALL') where.baseStatus = status
    if (recommendation && recommendation !== 'ALL') where.recommendation = recommendation
    if (minScore && parseInt(minScore) > 0) where.totalScore = { gte: parseInt(minScore) }
    if (search) {
      where.OR = [
        { symbol: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ]
    }

    const stocks = await db.ipoStock.findMany({
      where,
      orderBy: { [sortBy]: 'desc' },
    })

    // Stats summary
    const total = stocks.length
    const strongBuy = stocks.filter(s => s.recommendation === 'STRONG_BUY').length
    const buy = stocks.filter(s => s.recommendation === 'BUY').length
    const watch = stocks.filter(s => s.recommendation === 'WATCH').length
    const avoid = stocks.filter(s => s.recommendation === 'AVOID').length

    return NextResponse.json({
      stocks,
      stats: { total, strongBuy, buy, watch, avoid },
    })
  } catch (error) {
    console.error('GET ipo-stocks error:', error)
    return NextResponse.json({ error: 'Failed to fetch stocks' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { symbol, name, sector, ipoDate, ipoPrice, ipoOpenPrice, ipoDayLow, ipoDayHigh, marketCap, exchange } = body

    if (!symbol || !name || !sector || !ipoDate || !ipoPrice) {
      return NextResponse.json({ error: 'symbol, name, sector, ipoDate, and ipoPrice are required' }, { status: 400 })
    }

    const existing = await db.ipoStock.findUnique({ where: { symbol } })
    if (existing) {
      return NextResponse.json({ error: 'Stock with this symbol already exists' }, { status: 409 })
    }

    const listingGainPct = ipoOpenPrice ? ((ipoOpenPrice - ipoPrice) / ipoPrice) * 100 : 0

    // Generate synthetic price data
    const totalDays = 126
    const dailyPrices: { date: string; open: number; high: number; low: number; close: number; volume: number }[] = []
    let price = ipoPrice * (1 + Math.random() * 0.05)
    const baseVolume = 500000 + Math.random() * 1000000
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - totalDays)

    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(startDate)
      currentDate.setDate(currentDate.getDate() + i)
      const dow = currentDate.getDay()
      if (dow === 0 || dow === 6) continue

      const dailyReturn = (Math.random() - 0.48) * 0.03
      price = price * (1 + dailyReturn)
      price = Math.max(price, ipoPrice * 0.3)

      const open = price * (1 + (Math.random() - 0.5) * 0.02)
      const close = price
      const high = Math.max(open, close) * (1 + Math.random() * 0.01)
      const low = Math.min(open, close) * (1 - Math.random() * 0.01)
      const volume = baseVolume * (0.7 + Math.random() * 0.6)

      dailyPrices.push({
        date: currentDate.toISOString().split('T')[0],
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume: Math.round(volume),
      })
    }

    // Aggregate weekly
    const weeklyMap = new Map<string, { date: string; open: number; high: number; low: number; close: number; volume: number }>()
    for (const dp of dailyPrices) {
      const d = new Date(dp.date)
      const dayOfWeek = d.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const monday = new Date(d)
      monday.setDate(d.getDate() + mondayOffset)
      const weekKey = monday.toISOString().split('T')[0]
      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, { ...dp })
      } else {
        const w = weeklyMap.get(weekKey)!
        w.high = Math.max(w.high, dp.high)
        w.low = Math.min(w.low, dp.low)
        w.close = dp.close
        w.volume += dp.volume
      }
    }
    const weeklyPrices = Array.from(weeklyMap.values())

    const stock = await db.ipoStock.create({
      data: {
        symbol,
        name,
        sector,
        ipoDate,
        ipoPrice,
        ipoOpenPrice: ipoOpenPrice || ipoPrice,
        ipoDayLow: ipoDayLow || ipoPrice * 0.95,
        ipoDayHigh: ipoDayHigh || ipoPrice * 1.1,
        currentPrice: dailyPrices.length > 0 ? dailyPrices[dailyPrices.length - 1].close : ipoPrice,
        listingGainPct: Math.round(listingGainPct * 100) / 100,
        marketCap: marketCap || '',
        exchange: exchange || 'NSE',
        dailyPrices: { create: dailyPrices },
        weeklyPrices: { create: weeklyPrices },
      },
      include: { dailyPrices: true, weeklyPrices: true },
    })

    return NextResponse.json({ stock })
  } catch (error) {
    console.error('POST ipo-stocks error:', error)
    return NextResponse.json({ error: 'Failed to add stock' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { id, symbol } = body

    if (!id && !symbol) {
      return NextResponse.json({ error: 'id or symbol required' }, { status: 400 })
    }

    const where = id ? { id } : { symbol }
    await db.dailyPrice.deleteMany({ where: { stock: where } })
    await db.weeklyPrice.deleteMany({ where: { stock: where } })
    await db.ipoStock.delete({ where })

    return NextResponse.json({ message: 'Stock deleted' })
  } catch (error) {
    console.error('DELETE ipo-stocks error:', error)
    return NextResponse.json({ error: 'Failed to delete stock' }, { status: 500 })
  }
}
