import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ─── Original 6 pillars ───────────────────────────────────────────────────────

function calcHorizontalPivot(weeklyPrices: { high: number; low: number; close: number }[]): number {
  if (weeklyPrices.length < 4) return 0
  let points = 0
  const maxHigh = Math.max(...weeklyPrices.map(w => w.high))
  const pivotZone = maxHigh * 0.95
  const nearResistance = weeklyPrices.filter(w => w.high >= pivotZone).length
  if (nearResistance >= 8) points += 40
  else if (nearResistance >= 5) points += 25
  else if (nearResistance >= 3) points += 15
  const touchZone = maxHigh * 0.98
  const touches = weeklyPrices.filter(w => w.high >= touchZone).length
  if (touches >= 3) points += 30
  else if (touches >= 2) points += 20
  else if (touches >= 1) points += 10
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
  let declining = 0
  for (let i = weeklyPrices.length - 1; i >= Math.max(0, weeklyPrices.length - 6); i--) {
    if (i > 0 && weeklyPrices[i].volume < weeklyPrices[i - 1].volume) declining++
    else break
  }
  if (declining >= 3) points += 30
  else if (declining >= 2) points += 20
  const last2 = weeklyPrices.slice(-2)
  const last2BelowAvg = last2.filter(w => w.volume < avgVolume * 0.6).length
  if (last2BelowAvg >= 2) points += 40
  else if (last2BelowAvg >= 1) points += 25
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
  if (lastDay.volume >= avgVolume * 3) points += 40
  else if (lastDay.volume >= avgVolume * 2) points += 30
  else if (lastDay.volume >= avgVolume * 1.5) points += 20
  const recent10 = dailyPrices.slice(-10)
  const breachDays = recent10.filter(d => priorHigh > 0 && d.high > priorHigh && d.volume >= avgVolume * 1.3).length
  if (breachDays >= 2) points += 30
  else if (breachDays >= 1) points += 20
  let upVol = 0, downVol = 0, upCount = 0, downCount = 0
  for (let i = 1; i < dailyPrices.length; i++) {
    if (dailyPrices[i].close > dailyPrices[i - 1].close) { upVol += dailyPrices[i].volume; upCount++ }
    else { downVol += dailyPrices[i].volume; downCount++ }
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
  const chunkSize = Math.max(2, Math.floor(weeklyPrices.length / 3))
  const chunks: { high: number; low: number }[][] = []
  for (let i = 0; i < weeklyPrices.length; i += chunkSize) chunks.push(weeklyPrices.slice(i, i + chunkSize))
  if (chunks.length >= 2) {
    const firstRange = Math.max(...chunks[0].map(w => w.high)) - Math.min(...chunks[0].map(w => w.low))
    const lastRange = Math.max(...chunks[chunks.length - 1].map(w => w.high)) - Math.min(...chunks[chunks.length - 1].map(w => w.low))
    const tightnessRatio = lastRange > 0 ? firstRange / lastRange : 0
    if (tightnessRatio >= 3) points += 40
    else if (tightnessRatio >= 2) points += 25
    else if (tightnessRatio >= 1.5) points += 15
    let contractions = 0
    for (let i = 1; i < chunks.length; i++) {
      const prevRange = Math.max(...chunks[i - 1].map(w => w.high)) - Math.min(...chunks[i - 1].map(w => w.low))
      const currRange = Math.max(...chunks[i].map(w => w.high)) - Math.min(...chunks[i].map(w => w.low))
      if (currRange < prevRange) contractions++
    }
    if (contractions >= 2) points += 30
    else if (contractions >= 1) points += 20
  }
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
  if (currentPrice > stock.ipoOpenPrice * 1.1) points += 40
  else if (currentPrice > stock.ipoOpenPrice) points += 25
  else if (currentPrice > stock.ipoOpenPrice * 0.9) points += 10
  if (currentPrice > stock.ipoDayLow * 1.2) points += 30
  else if (currentPrice > stock.ipoDayLow * 1.1) points += 20
  else if (currentPrice > stock.ipoDayLow) points += 10
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
  const closesAbovePivot = last4.filter(w => w.close > pivotLevel).length
  if (closesAbovePivot >= 3) points += 40
  else if (closesAbovePivot >= 2) points += 25
  else if (closesAbovePivot >= 1) points += 10
  const keyLevel = pivotLevel * 0.92
  const closesAboveKey = last4.filter(w => w.close > keyLevel).length
  if (closesAboveKey >= 3) points += 30
  else if (closesAboveKey >= 2) points += 20
  let upVol = 0, downVol = 0, upCount = 0, downCount = 0
  for (let i = 1; i < weeklyPrices.length; i++) {
    if (weeklyPrices[i].close > weeklyPrices[i - 1].close) { upVol += weeklyPrices[i].volume; upCount++ }
    else { downVol += weeklyPrices[i].volume; downCount++ }
  }
  const avgUpVol = upCount > 0 ? upVol / upCount : 0
  const avgDownVol = downCount > 0 ? downVol / downCount : 1
  if (avgUpVol >= avgDownVol * 1.5) points += 30
  else if (avgUpVol >= avgDownVol * 1.2) points += 20
  else if (avgUpVol > avgDownVol) points += 10
  return Math.min(points, 100)
}

// ─── NEW: Pre-breakout signals ────────────────────────────────────────────────

/**
 * Pocket Pivot: an up-day whose volume exceeds the highest volume of any
 * down-day in the prior 10 sessions — while price is still inside the base.
 * Score = 0–100 based on how many pocket pivots appear in recent 20 sessions.
 */
function calcPocketPivot(dailyPrices: { close: number; volume: number }[]): number {
  if (dailyPrices.length < 12) return 0
  const recent = dailyPrices.slice(-20)
  let pivotCount = 0
  for (let i = 1; i < recent.length; i++) {
    const isUpDay = recent[i].close > recent[i - 1].close
    if (!isUpDay) continue
    const prior10 = recent.slice(Math.max(0, i - 10), i)
    const downDayVols = prior10.filter((_, j) => j > 0 && prior10[j].close <= prior10[j - 1].close).map(d => d.volume)
    if (downDayVols.length === 0) continue
    const maxDownVol = Math.max(...downDayVols)
    if (recent[i].volume > maxDownVol) pivotCount++
  }
  // 0 pivots = 0, 1 = 35, 2 = 60, 3 = 80, 4+ = 100
  if (pivotCount >= 4) return 100
  if (pivotCount === 3) return 80
  if (pivotCount === 2) return 60
  if (pivotCount === 1) return 35
  return 0
}

/**
 * RS vs Nifty 50: uses the rsScore already computed by market-data/history route.
 * If rsScore not yet computed (seed data), estimate from price action.
 */
function calcRS(stockCloses: number[], storedRsScore: number | null): number {
  if (storedRsScore !== null) return storedRsScore
  // Fallback estimate from price momentum alone
  if (stockCloses.length < 20) return 50
  const n = Math.min(63, stockCloses.length - 1)
  const ret = (stockCloses[stockCloses.length - 1] - stockCloses[stockCloses.length - 1 - n]) / stockCloses[stockCloses.length - 1 - n]
  return Math.min(100, Math.max(0, Math.round(50 + ret * 150)))
}

/**
 * Proximity to Pivot: how close the current price is to the base's pivot point.
 * Within 3% = highest score (actionable zone). Extended >10% = low score.
 * Negative proximity (below pivot) scores lower.
 */
function calcProximityToPivot(currentPrice: number, pivotLevel: number): { score: number; pct: number } {
  if (!pivotLevel || pivotLevel <= 0) return { score: 0, pct: 0 }
  const pct = ((currentPrice - pivotLevel) / pivotLevel) * 100
  // Within buy zone (0% to +3%): 85–100
  if (pct >= 0 && pct <= 3) return { score: Math.round(100 - pct * 5), pct }
  // Approaching pivot (-5% to 0%): 55–85
  if (pct >= -5 && pct < 0) return { score: Math.round(85 + pct * 6), pct }
  // Extended above (+3% to +10%): 40–85
  if (pct > 3 && pct <= 10) return { score: Math.round(85 - (pct - 3) * 6.4), pct }
  // Far below pivot (-5% to -15%): 20–55
  if (pct >= -15 && pct < -5) return { score: Math.round(55 + (pct + 5) * 3.5), pct }
  // Very extended above or very far below: 0–20
  return { score: Math.max(0, Math.round(20 - Math.abs(pct) * 0.5)), pct }
}

// ─── Main scan handler ────────────────────────────────────────────────────────

export async function POST() {
  try {
    const stocks = await db.ipoStock.findMany({
      include: { dailyPrices: { orderBy: { date: 'asc' } }, weeklyPrices: { orderBy: { date: 'asc' } } },
    })
    if (stocks.length === 0) {
      return NextResponse.json({ error: 'No stocks found. Seed the database first.' }, { status: 400 })
    }

    let scanned = 0
    for (const stock of stocks as any[]) {
      const daily = stock.dailyPrices as { date: string; open: number; high: number; low: number; close: number; volume: number }[]
      const weekly = stock.weeklyPrices as { date: string; open: number; high: number; low: number; close: number; volume: number }[]

      if (daily.length < 5 || weekly.length < 2) { scanned++; continue }

      // ── Original 6 pillars ──────────────────────────────────────────────
      const horizontalPivotScore  = calcHorizontalPivot(weekly)
      const volumeDryUpScore      = calcVolumeDryUp(weekly)
      const breakoutVolumeScore   = calcBreakoutVolume(daily, weekly)
      const vcpScore              = calcVCPPattern(weekly)
      const priceVsIpoLowScore    = calcPriceVsIpoLow(daily, stock)
      const pivotLevel            = Math.max(...weekly.map(w => w.high))
      const weeklyConvictionScore = calcWeeklyConviction(weekly, pivotLevel)

      const core6Total = horizontalPivotScore + volumeDryUpScore + breakoutVolumeScore + vcpScore + priceVsIpoLowScore + weeklyConvictionScore
      const totalScore = Math.round(core6Total / 6)

      // ── New pre-breakout signals ─────────────────────────────────────────
      const pocketPivotScore = calcPocketPivot(daily)
      const rsScore = calcRS(daily.map(d => d.close), stock.rsScore ?? null)
      const { score: proximityScore, pct: proximityToPivot } = calcProximityToPivot(
        daily[daily.length - 1].close,
        pivotLevel
      )

      // ── Base status: now weighs pocket pivot + RS as early signals ───────
      let baseStatus = 'FORMING'
      const isNearPivot = proximityToPivot >= -5 && proximityToPivot <= 5
      const hasAccumulation = pocketPivotScore >= 35
      const hasRS = rsScore >= 55

      if (totalScore >= 60 && breakoutVolumeScore >= 45) baseStatus = 'BREAKOUT'
      else if (totalScore >= 50 && weeklyConvictionScore >= 35) baseStatus = 'ADVANCING'
      else if (totalScore < 30) baseStatus = 'FAILED'
      // Pre-breakout tag: forming base but showing early signals
      else if (totalScore >= 40 && isNearPivot && (hasAccumulation || hasRS)) baseStatus = 'COILING'

      // ── Recommendation: blended signal ───────────────────────────────────
      let recommendation = 'WATCH'
      if (totalScore >= 65) recommendation = 'STRONG_BUY'
      else if (totalScore >= 55 && (baseStatus === 'BREAKOUT' || baseStatus === 'ADVANCING')) recommendation = 'BUY'
      // Early alert: good setup forming with pocket pivots near pivot
      else if (totalScore >= 45 && baseStatus === 'COILING' && pocketPivotScore >= 60 && rsScore >= 60) recommendation = 'BUY'
      else if (totalScore < 30) recommendation = 'AVOID'

      const baseWeeks = Math.min(weekly.length, 24)
      const last8Weekly = weekly.slice(-8)
      const supportLevel = last8Weekly.length > 0 ? Math.min(...last8Weekly.map(w => w.low)) : null

      // Detect breakout date
      let breakoutDate: string | null = null
      if (baseStatus === 'BREAKOUT' || baseStatus === 'ADVANCING') {
        const priorHigh = weekly.length > 1 ? Math.max(...weekly.slice(0, -1).map(w => w.high)) : 0
        const avgVol = daily.reduce((s, d) => s + d.volume, 0) / daily.length
        for (let i = daily.length - 1; i >= 0; i--) {
          if (daily[i].high > priorHigh && daily[i].volume > avgVol * 1.5) { breakoutDate = daily[i].date; break }
        }
      }

      await db.ipoStock.update({
        where: { id: stock.id },
        data: {
          horizontalPivotScore, volumeDryUpScore, breakoutVolumeScore,
          vcpScore, priceVsIpoLowScore, weeklyConvictionScore, totalScore,
          baseStatus, baseWeeks, pivotLevel,
          supportLevel, breakoutDate, recommendation,
          pocketPivotScore, rsScore,
          proximityToPivot: Math.round(proximityToPivot * 100) / 100,
          currentPrice: daily[daily.length - 1].close,
        },
      })
      scanned++
    }

    return NextResponse.json({ message: `Scan complete. ${scanned} stocks evaluated with 9 signals.`, scanned })
  } catch (error) {
    console.error('Scan error:', error)
    return NextResponse.json({ error: 'Failed to run scan' }, { status: 500 })
  }
}
