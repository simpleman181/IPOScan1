import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

function calcHorizontalPivot(weeklyPrices: { high: number; low: number; close: number }[]): number {
  if (weeklyPrices.length < 4) return 0
  let points = 0
  const maxHigh = Math.max(...weeklyPrices.map(w => w.high))
  const pivotZone = maxHigh * 0.95

  // +40: 8+ weeks near resistance (95% of max high)
  const nearResistance = weeklyPrices.filter(w => w.high >= pivotZone).length
  if (nearResistance >= 8) points += 40
  else if (nearResistance >= 5) points += 25
  else if (nearResistance >= 3) points += 15

  // +30: Touched 3+ times at 98% of max
  const touchZone = maxHigh * 0.98
  const touches = weeklyPrices.filter(w => w.high >= touchZone).length
  if (touches >= 3) points += 30
  else if (touches >= 2) points += 20
  else if (touches >= 1) points += 10

  // +30: Price within 5% of pivot
  const lastClose = weeklyPrices[weeklyPrices.length - 1].close
  if (lastClose >= maxHigh * 0.95) points += 30
  else if (lastClose >= maxHigh * 0.90) points += 20
  else if (lastClose >= maxHigh * 0.85) points += 10

  return Math.min(points, 100)
}

function calcVolumeDryUp(weeklyPrices: { volume: number }[]): number {
  if (weeklyPrices.length < 6) return 0
  let points = 0
  const avgVolume = weeklyPrices.reduce((s, w) => s + w.volume, 0) / weeklyPrices.length

  // +30: Volume declining 3 consecutive weeks
  let declining = 0
  for (let i = weeklyPrices.length - 1; i >= Math.max(0, weeklyPrices.length - 6); i--) {
    if (i > 0 && weeklyPrices[i].volume < weeklyPrices[i - 1].volume) declining++
    else break
  }
  if (declining >= 3) points += 30
  else if (declining >= 2) points += 20

  // +40: Last 2 weeks below 60% of average
  const last2 = weeklyPrices.slice(-2)
  const last2BelowAvg = last2.filter(w => w.volume < avgVolume * 0.6).length
  if (last2BelowAvg >= 2) points += 40
  else if (last2BelowAvg >= 1) points += 25

  // +30: Recent minimum volume bar visible
  const recent6 = weeklyPrices.slice(-6)
  const minVol = Math.min(...weeklyPrices.map(w => w.volume))
  const recentMin = Math.min(...recent6.map(w => w.volume))
  if (recentMin <= minVol * 1.1) points += 30
  else if (recentMin <= avgVolume * 0.4) points += 20

  return Math.min(points, 100)
}

function calcBreakoutVolume(dailyPrices: { high: number; close: number; volume: number }[], weeklyPrices: { high: number }[]): number {
  if (dailyPrices.length < 10 || weeklyPrices.length < 2) return 0
  let points = 0
  const avgVolume = dailyPrices.reduce((s, d) => s + d.volume, 0) / dailyPrices.length
  const lastDay = dailyPrices[dailyPrices.length - 1]
  const priorHigh = weeklyPrices.length > 1 ? Math.max(...weeklyPrices.slice(0, -1).map(w => w.high)) : 0

  // +40: Latest day volume 2x+ average (relaxed from 3x for synthetic data)
  if (lastDay.volume >= avgVolume * 3) points += 40
  else if (lastDay.volume >= avgVolume * 2) points += 30
  else if (lastDay.volume >= avgVolume * 1.5) points += 20

  // +30: Days breaching prior high with elevated volume
  const recent10 = dailyPrices.slice(-10)
  const breachDays = recent10.filter(d => priorHigh > 0 && d.high > priorHigh && d.volume >= avgVolume * 1.3).length
  if (breachDays >= 2) points += 30
  else if (breachDays >= 1) points += 20

  // +30: Up-day volume 1.5x down-day volume (FIXED: compare with previous day)
  let upVol = 0, downVol = 0, upCount = 0, downCount = 0
  for (let i = 1; i < dailyPrices.length; i++) {
    if (dailyPrices[i].close > dailyPrices[i - 1].close) {
      upVol += dailyPrices[i].volume
      upCount++
    } else {
      downVol += dailyPrices[i].volume
      downCount++
    }
  }
  const avgUpVol = upCount > 0 ? upVol / upCount : 0
  const avgDownVol = downCount > 0 ? downVol / downCount : 1
  if (avgUpVol >= avgDownVol * 1.5) points += 30
  else if (avgUpVol >= avgDownVol * 1.2) points += 20
  else if (avgUpVol >= avgDownVol * 1.0) points += 10

  return Math.min(points, 100)
}

function calcVCPPattern(weeklyPrices: { high: number; low: number }[]): number {
  if (weeklyPrices.length < 8) return 0
  let points = 0

  // Split into chunks
  const chunkSize = Math.max(2, Math.floor(weeklyPrices.length / 3))
  const chunks: { high: number; low: number }[][] = []
  for (let i = 0; i < weeklyPrices.length; i += chunkSize) {
    chunks.push(weeklyPrices.slice(i, i + chunkSize))
  }

  if (chunks.length >= 2) {
    const firstRange = Math.max(...chunks[0].map(w => w.high)) - Math.min(...chunks[0].map(w => w.low))
    const lastRange = Math.max(...chunks[chunks.length - 1].map(w => w.high)) - Math.min(...chunks[chunks.length - 1].map(w => w.low))

    // +40: Range tightness ratio >= 3x
    const tightnessRatio = lastRange > 0 ? firstRange / lastRange : 0
    if (tightnessRatio >= 3) points += 40
    else if (tightnessRatio >= 2) points += 25
    else if (tightnessRatio >= 1.5) points += 15

    // +30: 2+ contractions in successive chunks
    let contractions = 0
    for (let i = 1; i < chunks.length; i++) {
      const prevRange = Math.max(...chunks[i - 1].map(w => w.high)) - Math.min(...chunks[i - 1].map(w => w.low))
      const currRange = Math.max(...chunks[i].map(w => w.high)) - Math.min(...chunks[i].map(w => w.low))
      if (currRange < prevRange) contractions++
    }
    if (contractions >= 2) points += 30
    else if (contractions >= 1) points += 20
  }

  // +30: Current range < 5% of price
  const last4 = weeklyPrices.slice(-4)
  const currentRange = Math.max(...last4.map(w => w.high)) - Math.min(...last4.map(w => w.low))
  const avgPrice = last4.reduce((s, w) => s + (w.high + w.low) / 2, 0) / last4.length
  if (avgPrice > 0 && currentRange / avgPrice < 0.05) points += 30
  else if (avgPrice > 0 && currentRange / avgPrice < 0.08) points += 20
  else if (avgPrice > 0 && currentRange / avgPrice < 0.12) points += 10

  return Math.min(points, 100)
}

function calcPriceVsIpoLow(dailyPrices: { close: number; low: number }[], stock: { ipoOpenPrice: number; ipoDayLow: number; ipoPrice: number }): number {
  if (dailyPrices.length < 5) return 0
  let points = 0
  const currentPrice = dailyPrices[dailyPrices.length - 1].close

  // +40: Price above IPO open * 1.1
  if (currentPrice > stock.ipoOpenPrice * 1.1) points += 40
  else if (currentPrice > stock.ipoOpenPrice) points += 25
  else if (currentPrice > stock.ipoOpenPrice * 0.9) points += 10

  // +30: Price above IPO day low * 1.2
  if (currentPrice > stock.ipoDayLow * 1.2) points += 30
  else if (currentPrice > stock.ipoDayLow * 1.1) points += 20
  else if (currentPrice > stock.ipoDayLow) points += 10

  // +30: Higher lows forming in recent 30 days
  const recent30 = dailyPrices.slice(-30)
  if (recent30.length >= 10) {
    const firstHalf = recent30.slice(0, Math.floor(recent30.length / 2))
    const secondHalf = recent30.slice(Math.floor(recent30.length / 2))
    const firstMinLow = Math.min(...firstHalf.map(d => d.low))
    const secondMinLow = Math.min(...secondHalf.map(d => d.low))
    if (secondMinLow > firstMinLow) points += 30
    else if (secondMinLow > firstMinLow * 0.98) points += 15
  }

  return Math.min(points, 100)
}

function calcWeeklyConviction(weeklyPrices: { close: number; high: number; volume: number }[], pivotLevel: number): number {
  if (weeklyPrices.length < 4 || pivotLevel <= 0) return 0
  let points = 0

  const last4 = weeklyPrices.slice(-4)

  // +40: 3+ of last 4 weekly closes above pivot
  const closesAbovePivot = last4.filter(w => w.close > pivotLevel).length
  if (closesAbovePivot >= 3) points += 40
  else if (closesAbovePivot >= 2) points += 25
  else if (closesAbovePivot >= 1) points += 10

  // +30: 3+ weekly closes above key level (92% of pivot)
  const keyLevel = pivotLevel * 0.92
  const closesAboveKey = last4.filter(w => w.close > keyLevel).length
  if (closesAboveKey >= 3) points += 30
  else if (closesAboveKey >= 2) points += 20

  // +30: Up-week volume 1.5x down-week volume
  let upVol = 0, downVol = 0, upCount = 0, downCount = 0
  for (let i = 1; i < weeklyPrices.length; i++) {
    if (weeklyPrices[i].close > weeklyPrices[i - 1].close) {
      upVol += weeklyPrices[i].volume
      upCount++
    } else {
      downVol += weeklyPrices[i].volume
      downCount++
    }
  }
  const avgUpVol = upCount > 0 ? upVol / upCount : 0
  const avgDownVol = downCount > 0 ? downVol / downCount : 1
  if (avgUpVol >= avgDownVol * 1.5) points += 30
  else if (avgUpVol >= avgDownVol * 1.2) points += 20
  else if (avgUpVol > avgDownVol) points += 10

  return Math.min(points, 100)
}

export async function POST() {
  try {
    const stocks = await db.ipoStock.findMany({
      include: { dailyPrices: { orderBy: { date: 'asc' } }, weeklyPrices: { orderBy: { date: 'asc' } } },
    })

    if (stocks.length === 0) {
      return NextResponse.json({ error: 'No stocks found. Seed the database first.' }, { status: 400 })
    }

    let scanned = 0
    for (const stock of stocks) {
      const dailyPrices = stock.dailyPrices
      const weeklyPrices = stock.weeklyPrices

      if (dailyPrices.length < 5 || weeklyPrices.length < 2) {
        scanned++
        continue
      }

      const horizontalPivotScore = calcHorizontalPivot(weeklyPrices)
      const volumeDryUpScore = calcVolumeDryUp(weeklyPrices)
      const breakoutVolumeScore = calcBreakoutVolume(dailyPrices, weeklyPrices)
      const vcpScore = calcVCPPattern(weeklyPrices)
      const priceVsIpoLowScore = calcPriceVsIpoLow(dailyPrices, {
        ipoOpenPrice: stock.ipoOpenPrice,
        ipoDayLow: stock.ipoDayLow,
        ipoPrice: stock.ipoPrice,
      })

      const pivotLevel = Math.max(...weeklyPrices.map(w => w.high))
      const weeklyConvictionScore = calcWeeklyConviction(weeklyPrices, pivotLevel)

      const totalScore = Math.round(
        (horizontalPivotScore + volumeDryUpScore + breakoutVolumeScore + vcpScore + priceVsIpoLowScore + weeklyConvictionScore) / 6
      )

      // Determine base status
      let baseStatus = 'FORMING'
      if (totalScore >= 60 && breakoutVolumeScore >= 45) baseStatus = 'BREAKOUT'
      else if (totalScore >= 50 && weeklyConvictionScore >= 35) baseStatus = 'ADVANCING'
      else if (totalScore < 30) baseStatus = 'FAILED'

      // Determine recommendation
      let recommendation = 'WATCH'
      if (totalScore >= 65) recommendation = 'STRONG_BUY'
      else if (totalScore >= 55 && (baseStatus === 'BREAKOUT' || baseStatus === 'ADVANCING')) recommendation = 'BUY'
      else if (totalScore < 30) recommendation = 'AVOID'

      // Compute additional fields
      const baseWeeks = Math.min(weeklyPrices.length, 24)
      const pivotLevelVal = Math.max(...weeklyPrices.map(w => w.high))
      const last8Weekly = weeklyPrices.slice(-8)
      const supportLevelVal = last8Weekly.length > 0 ? Math.min(...last8Weekly.map(w => w.low)) : null

      // Detect breakout date
      let breakoutDate: string | null = null
      if (baseStatus === 'BREAKOUT' || baseStatus === 'ADVANCING') {
        const priorHigh = weeklyPrices.length > 1 ? Math.max(...weeklyPrices.slice(0, -1).map(w => w.high)) : 0
        const avgVol = dailyPrices.reduce((s, d) => s + d.volume, 0) / dailyPrices.length
        for (let i = dailyPrices.length - 1; i >= 0; i--) {
          if (dailyPrices[i].high > priorHigh && dailyPrices[i].volume > avgVol * 1.5) {
            breakoutDate = dailyPrices[i].date
            break
          }
        }
      }

      await db.ipoStock.update({
        where: { id: stock.id },
        data: {
          horizontalPivotScore,
          volumeDryUpScore,
          breakoutVolumeScore,
          vcpScore,
          priceVsIpoLowScore,
          weeklyConvictionScore,
          totalScore,
          baseStatus,
          baseWeeks,
          pivotLevel: pivotLevelVal,
          supportLevel: supportLevelVal,
          breakoutDate,
          recommendation,
          currentPrice: dailyPrices[dailyPrices.length - 1].close,
        },
      })
      scanned++
    }

    return NextResponse.json({
      message: `Scan complete. ${scanned} stocks evaluated.`,
      scanned,
    })
  } catch (error) {
    console.error('Scan error:', error)
    return NextResponse.json({ error: 'Failed to run scan' }, { status: 500 })
  }
}
