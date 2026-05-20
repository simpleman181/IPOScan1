import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

const STOCKS = [
  // Success Stories (10)
  { symbol: 'MTAR', name: 'MTAR Technologies', sector: 'Defense', ipoPrice: 575, currentPrice: 895, ipoOpenPrice: 600, ipoDayLow: 570, ipoDayHigh: 640, exchange: 'NSE', marketCap: '2,750 Cr', pattern: 'success' as const },
  { symbol: 'HARIOMPIPE', name: 'Hariom Pipe Industries', sector: 'Steel', ipoPrice: 153, currentPrice: 310, ipoOpenPrice: 162, ipoDayLow: 150, ipoDayHigh: 178, exchange: 'NSE', marketCap: '850 Cr', pattern: 'success' as const },
  { symbol: 'CRAFTSMAN', name: 'Craftsman Automation', sector: 'Engineering', ipoPrice: 1490, currentPrice: 2350, ipoOpenPrice: 1560, ipoDayLow: 1480, ipoDayHigh: 1650, exchange: 'NSE', marketCap: '5,200 Cr', pattern: 'success' as const },
  { symbol: 'LIKHITHA', name: 'Likhitha Infrastructure', sector: 'Infra', ipoPrice: 120, currentPrice: 245, ipoOpenPrice: 130, ipoDayLow: 118, ipoDayHigh: 148, exchange: 'NSE', marketCap: '420 Cr', pattern: 'success' as const },
  { symbol: 'ETHOS', name: 'Ethos Ltd', sector: 'Luxury Retail', ipoPrice: 878, currentPrice: 1380, ipoOpenPrice: 920, ipoDayLow: 870, ipoDayHigh: 980, exchange: 'NSE', marketCap: '3,100 Cr', pattern: 'success' as const },
  { symbol: 'METROBRAND', name: 'Metro Brands Ltd', sector: 'Footwear', ipoPrice: 490, currentPrice: 720, ipoOpenPrice: 502, ipoDayLow: 485, ipoDayHigh: 540, exchange: 'NSE', marketCap: '9,800 Cr', pattern: 'success' as const },
  { symbol: 'VENUSPIPES', name: 'Venus Pipes & Tubes', sector: 'Steel', ipoPrice: 326, currentPrice: 520, ipoOpenPrice: 340, ipoDayLow: 322, ipoDayHigh: 370, exchange: 'NSE', marketCap: '1,200 Cr', pattern: 'success' as const },
  { symbol: 'HAPPSTMNDS', name: 'Happiest Minds Tech', sector: 'IT Services', ipoPrice: 166, currentPrice: 310, ipoOpenPrice: 175, ipoDayLow: 163, ipoDayHigh: 198, exchange: 'NSE', marketCap: '4,500 Cr', pattern: 'success' as const },
  { symbol: 'STOVEKRAFT', name: 'Stove Kraft Ltd', sector: 'Consumer', ipoPrice: 385, currentPrice: 580, ipoOpenPrice: 395, ipoDayLow: 380, ipoDayHigh: 430, exchange: 'NSE', marketCap: '1,800 Cr', pattern: 'success' as const },
  { symbol: 'RAINBOW', name: 'Rainbow Childrens Medicare', sector: 'Healthcare', ipoPrice: 542, currentPrice: 780, ipoOpenPrice: 560, ipoDayLow: 538, ipoDayHigh: 610, exchange: 'NSE', marketCap: '6,200 Cr', pattern: 'success' as const },

  // Warning Signs / Failed (5)
  { symbol: 'ZOMATO', name: 'Zomato Ltd', sector: 'Internet', ipoPrice: 76, currentPrice: 58, ipoOpenPrice: 115, ipoDayLow: 72, ipoDayHigh: 138, exchange: 'NSE', marketCap: '55,000 Cr', pattern: 'failed' as const },
  { symbol: 'NAZARA', name: 'Nazara Technologies', sector: 'Gaming', ipoPrice: 1101, currentPrice: 680, ipoOpenPrice: 1140, ipoDayLow: 1090, ipoDayHigh: 1250, exchange: 'NSE', marketCap: '4,100 Cr', pattern: 'failed' as const },
  { symbol: 'NURECA', name: 'Nureca Ltd', sector: 'Healthcare', ipoPrice: 400, currentPrice: 290, ipoOpenPrice: 460, ipoDayLow: 390, ipoDayHigh: 510, exchange: 'NSE', marketCap: '280 Cr', pattern: 'failed' as const },
  { symbol: 'ADANIWILMAR', name: 'Adani Wilmar Ltd', sector: 'FMCG', ipoPrice: 230, currentPrice: 310, ipoOpenPrice: 267, ipoDayLow: 225, ipoDayHigh: 310, exchange: 'NSE', marketCap: '40,000 Cr', pattern: 'failed' as const },
  { symbol: 'CARTRADE', name: 'CarTrade Tech Ltd', sector: 'Auto Classifieds', ipoPrice: 1618, currentPrice: 980, ipoOpenPrice: 1600, ipoDayLow: 1580, ipoDayHigh: 1680, exchange: 'NSE', marketCap: '4,600 Cr', pattern: 'failed' as const },

  // Forming / Neutral (5)
  { symbol: 'LATENTVIEW', name: 'Latent View Analytics', sector: 'Analytics', ipoPrice: 197, currentPrice: 340, ipoOpenPrice: 240, ipoDayLow: 195, ipoDayHigh: 268, exchange: 'NSE', marketCap: '6,800 Cr', pattern: 'forming' as const },
  { symbol: 'PARAS', name: 'Paras Defence & Space', sector: 'Defense', ipoPrice: 175, currentPrice: 380, ipoOpenPrice: 220, ipoDayLow: 173, ipoDayHigh: 250, exchange: 'NSE', marketCap: '1,500 Cr', pattern: 'forming' as const },
  { symbol: 'NYKAA', name: 'FSN Ecommerce (Nykaa)', sector: 'Beauty', ipoPrice: 1125, currentPrice: 175, ipoOpenPrice: 2035, ipoDayLow: 1118, ipoDayHigh: 2230, exchange: 'NSE', marketCap: '42,000 Cr', pattern: 'forming' as const },
  { symbol: 'PHARMEASY', name: 'API Holdings (PharmEasy)', sector: 'E-pharmacy', ipoPrice: 560, currentPrice: 380, ipoOpenPrice: 560, ipoDayLow: 550, ipoDayHigh: 590, exchange: 'NSE', marketCap: '8,200 Cr', pattern: 'forming' as const },
  { symbol: 'DELHIVERY', name: 'Delhivery Ltd', sector: 'Logistics', ipoPrice: 487, currentPrice: 420, ipoOpenPrice: 493, ipoDayLow: 480, ipoDayHigh: 525, exchange: 'NSE', marketCap: '30,000 Cr', pattern: 'forming' as const },
]

// Seeded PRNG for reproducible data
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return Math.abs(hash)
}

function generateSuccessPrices(ipoPrice: number, currentPrice: number, symbol: string) {
  const rng = seededRandom(hashString(symbol))
  const totalDays = 126
  const dailyPrices: { date: string; open: number; high: number; low: number; close: number; volume: number }[] = []
  const baseVolume = 800000 + rng() * 500000

  // Calculate the pivot level - where the stock is breaking out from
  const pivotLevel = currentPrice * 0.92
  // Calculate where the decline bottom was
  const bottomLevel = ipoPrice * 0.85
  // Price at IPO excitement peak
  const peakPrice = ipoPrice * 1.15

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - totalDays)

  let price = ipoPrice
  let dayIndex = 0

  // Phase 1: IPO Excitement (5% of days) - price shoots up
  const phase1Days = Math.round(totalDays * 0.05)
  for (let i = 0; i < phase1Days && dayIndex < totalDays; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + dayIndex)
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) { dayIndex++; i--; continue }

    const progress = (i + 1) / phase1Days
    price = ipoPrice + (peakPrice - ipoPrice) * progress + (rng() - 0.5) * ipoPrice * 0.02
    const volume = baseVolume * 2.0 * (0.8 + rng() * 0.4)

    const open = price - (rng() - 0.3) * ipoPrice * 0.01
    const close = price
    const high = Math.max(open, close) * (1 + rng() * 0.01)
    const low = Math.min(open, close) * (1 - rng() * 0.01)

    dailyPrices.push({
      date: currentDate.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100, high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100, close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
    })
    dayIndex++
  }

  // Phase 2: Decline (20% of days) - price drops from peak
  const phase2Days = Math.round(totalDays * 0.20)
  const phase2Start = price
  for (let i = 0; i < phase2Days && dayIndex < totalDays; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + dayIndex)
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) { dayIndex++; i--; continue }

    const progress = (i + 1) / phase2Days
    price = phase2Start + (bottomLevel - phase2Start) * progress + (rng() - 0.5) * ipoPrice * 0.02
    const volume = baseVolume * 0.8 * (0.7 + rng() * 0.3)

    const open = price + (rng() - 0.5) * ipoPrice * 0.01
    const close = price
    const high = Math.max(open, close) * (1 + rng() * 0.008)
    const low = Math.min(open, close) * (1 - rng() * 0.008)

    dailyPrices.push({
      date: currentDate.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100, high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100, close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
    })
    dayIndex++
  }

  // Phase 3: Wide Base (25% of days) - price oscillates near bottom with wide range
  const phase3Days = Math.round(totalDays * 0.25)
  const baseCenter = bottomLevel * 1.05
  const baseRange = ipoPrice * 0.08
  for (let i = 0; i < phase3Days && dayIndex < totalDays; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + dayIndex)
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) { dayIndex++; i--; continue }

    // Slowly move up toward pivot
    const progress = (i + 1) / phase3Days
    const targetCenter = baseCenter + (pivotLevel * 0.85 - baseCenter) * progress * 0.5
    price = targetCenter + (rng() - 0.5) * baseRange
    // Touch pivot level periodically
    if (rng() < 0.15) price = pivotLevel * (0.97 + rng() * 0.03)
    const volume = baseVolume * 0.6 * (0.6 + rng() * 0.4)

    const open = price + (rng() - 0.5) * ipoPrice * 0.008
    const close = price
    const high = Math.max(open, close) * (1 + rng() * 0.006)
    const low = Math.min(open, close) * (1 - rng() * 0.006)

    dailyPrices.push({
      date: currentDate.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100, high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100, close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
    })
    dayIndex++
  }

  // Phase 4: Tightening Base (25% of days) - price narrows, volume declines
  const phase4Days = Math.round(totalDays * 0.25)
  const tightBaseCenter = pivotLevel * 0.88
  for (let i = 0; i < phase4Days && dayIndex < totalDays; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + dayIndex)
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) { dayIndex++; i--; continue }

    const progress = (i + 1) / phase4Days
    const rangeShrink = 1 - progress * 0.6 // Range shrinks to 40% of original
    const currentRange = baseRange * 0.4 * rangeShrink
    // Slowly grind up toward pivot
    const targetCenter = tightBaseCenter + (pivotLevel * 0.95 - tightBaseCenter) * progress
    price = targetCenter + (rng() - 0.5) * currentRange
    // Touch pivot occasionally in later part
    if (progress > 0.5 && rng() < 0.1) price = pivotLevel * (0.98 + rng() * 0.02)
    // Declining volume
    const volFactor = 0.5 * (1 - progress * 0.4) // Volume drops from 50% to 30%
    const volume = baseVolume * volFactor * (0.7 + rng() * 0.3)

    const open = price + (rng() - 0.5) * currentRange * 0.3
    const close = price
    const high = Math.max(open, close) * (1 + rng() * 0.003)
    const low = Math.min(open, close) * (1 - rng() * 0.003)

    dailyPrices.push({
      date: currentDate.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100, high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100, close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
    })
    dayIndex++
  }

  // Phase 5: VCP Tight Phase (15% of days) - very tight range, very low volume
  const phase5Days = Math.round(totalDays * 0.15)
  for (let i = 0; i < phase5Days && dayIndex < totalDays; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + dayIndex)
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) { dayIndex++; i--; continue }

    const progress = (i + 1) / phase5Days
    const tinyRange = ipoPrice * 0.008 * (1 - progress * 0.5)
    price = pivotLevel * (0.96 + progress * 0.02) + (rng() - 0.5) * tinyRange
    // Very low volume
    const volume = baseVolume * 0.2 * (0.5 + rng() * 0.3)

    const open = price + (rng() - 0.5) * tinyRange * 0.3
    const close = price
    const high = Math.max(open, close) * (1 + rng() * 0.002)
    const low = Math.min(open, close) * (1 - rng() * 0.002)

    dailyPrices.push({
      date: currentDate.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100, high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100, close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
    })
    dayIndex++
  }

  // Phase 6: Breakout (10% of days) - price surges past pivot on high volume
  const phase6Days = Math.round(totalDays * 0.10)
  for (let i = 0; i < phase6Days && dayIndex < totalDays; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + dayIndex)
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) { dayIndex++; i--; continue }

    const progress = (i + 1) / phase6Days
    const startPrice = pivotLevel * 0.98
    price = startPrice + (currentPrice - startPrice) * progress + (rng() - 0.5) * ipoPrice * 0.01
    // High volume on breakout
    const volume = baseVolume * (2.0 + rng() * 1.5) * (0.8 + progress * 0.5)

    const open = price - (rng()) * ipoPrice * 0.005
    const close = price
    const high = Math.max(open, close) * (1 + rng() * 0.01)
    const low = Math.min(open, close) * (1 - rng() * 0.005)

    dailyPrices.push({
      date: currentDate.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100, high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100, close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
    })
    dayIndex++
  }

  // Fill remaining days if any
  while (dayIndex < totalDays) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + dayIndex)
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) { dayIndex++; continue }

    price = currentPrice + (rng() - 0.5) * ipoPrice * 0.005
    const volume = baseVolume * 1.5

    dailyPrices.push({
      date: currentDate.toISOString().split('T')[0],
      open: Math.round(price * 100) / 100, high: Math.round(price * 1.003 * 100) / 100,
      low: Math.round(price * 0.997 * 100) / 100, close: Math.round(price * 100) / 100,
      volume: Math.round(volume),
    })
    dayIndex++
  }

  // Adjust last 10 prices to converge toward target currentPrice
  const last10 = dailyPrices.slice(-10)
  for (let i = 0; i < last10.length; i++) {
    const ratio = (i + 1) / last10.length
    const targetClose = last10[i].close + (currentPrice - last10[i].close) * ratio
    const adjust = targetClose / last10[i].close
    last10[i].open = Math.round(last10[i].open * adjust * 100) / 100
    last10[i].close = Math.round(targetClose * 100) / 100
    last10[i].high = Math.max(last10[i].open, last10[i].close) * (1 + rng() * 0.005)
    last10[i].low = Math.min(last10[i].open, last10[i].close) * (1 - rng() * 0.005)
    last10[i].high = Math.round(last10[i].high * 100) / 100
    last10[i].low = Math.round(last10[i].low * 100) / 100
  }

  return dailyPrices
}

function generateFailedPrices(ipoPrice: number, currentPrice: number, symbol: string) {
  const rng = seededRandom(hashString(symbol))
  const totalDays = 126
  const dailyPrices: { date: string; open: number; high: number; low: number; close: number; volume: number }[] = []
  const baseVolume = 800000 + rng() * 500000

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - totalDays)

  let price = ipoPrice
  let dayIndex = 0
  const peakPrice = ipoPrice * 1.2
  const lowPrice = currentPrice * 0.9

  // Phase 1: Initial rally (10%)
  const phase1Days = Math.round(totalDays * 0.10)
  for (let i = 0; i < phase1Days && dayIndex < totalDays; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + dayIndex)
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) { dayIndex++; i--; continue }

    const progress = (i + 1) / phase1Days
    price = ipoPrice + (peakPrice - ipoPrice) * progress + (rng() - 0.5) * ipoPrice * 0.02
    const volume = baseVolume * 1.5 * (0.8 + rng() * 0.4)

    const open = price + (rng() - 0.5) * ipoPrice * 0.01
    const close = price
    const high = Math.max(open, close) * (1 + rng() * 0.01)
    const low = Math.min(open, close) * (1 - rng() * 0.008)

    dailyPrices.push({
      date: currentDate.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100, high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100, close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
    })
    dayIndex++
  }

  // Phase 2: Decline (25%)
  const phase2Start = price
  const phase2Days = Math.round(totalDays * 0.25)
  for (let i = 0; i < phase2Days && dayIndex < totalDays; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + dayIndex)
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) { dayIndex++; i--; continue }

    const progress = (i + 1) / phase2Days
    price = phase2Start + (ipoPrice * 0.9 - phase2Start) * progress + (rng() - 0.5) * ipoPrice * 0.02
    const volume = baseVolume * 0.9 * (0.6 + rng() * 0.4)

    const open = price + (rng() - 0.5) * ipoPrice * 0.01
    const close = price
    const high = Math.max(open, close) * (1 + rng() * 0.008)
    const low = Math.min(open, close) * (1 - rng() * 0.008)

    dailyPrices.push({
      date: currentDate.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100, high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100, close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
    })
    dayIndex++
  }

  // Phase 3: Failed Rally (25%) - tries to go up but fails
  const rallyStart = price
  const phase3Days = Math.round(totalDays * 0.25)
  for (let i = 0; i < phase3Days && dayIndex < totalDays; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + dayIndex)
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) { dayIndex++; i--; continue }

    const progress = (i + 1) / phase3Days
    // Rally up then fade
    const rallyPct = progress < 0.4 ? progress / 0.4 : 1 - (progress - 0.4) / 0.6
    price = rallyStart + (peakPrice * 0.9 - rallyStart) * rallyPct * 0.6 + (rng() - 0.5) * ipoPrice * 0.02
    const volume = baseVolume * (0.7 + rng() * 0.3)

    const open = price + (rng() - 0.5) * ipoPrice * 0.008
    const close = price
    const high = Math.max(open, close) * (1 + rng() * 0.006)
    const low = Math.min(open, close) * (1 - rng() * 0.006)

    dailyPrices.push({
      date: currentDate.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100, high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100, close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
    })
    dayIndex++
  }

  // Phase 4: Distribution (25%) - choppy with high volume on down days
  const phase4Days = Math.round(totalDays * 0.25)
  for (let i = 0; i < phase4Days && dayIndex < totalDays; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + dayIndex)
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) { dayIndex++; i--; continue }

    const progress = (i + 1) / phase4Days
    price = ipoPrice * 0.9 - (ipoPrice * 0.9 - currentPrice * 1.1) * progress + (rng() - 0.5) * ipoPrice * 0.02
    // Higher volume on down days
    const isDownDay = rng() < 0.6
    const volume = baseVolume * (isDownDay ? 1.2 : 0.7) * (0.6 + rng() * 0.4)

    const open = price + (rng() - 0.3) * ipoPrice * 0.01
    const close = isDownDay ? open * (0.98 + rng() * 0.02) : open * (1 + rng() * 0.02)
    price = close
    const high = Math.max(open, close) * (1 + rng() * 0.008)
    const low = Math.min(open, close) * (1 - rng() * 0.008)

    dailyPrices.push({
      date: currentDate.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100, high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100, close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
    })
    dayIndex++
  }

  // Phase 5: Breakdown (15%) - final decline
  const phase5Days = Math.round(totalDays * 0.15)
  const breakdownStart = price
  for (let i = 0; i < phase5Days && dayIndex < totalDays; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + dayIndex)
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) { dayIndex++; i--; continue }

    const progress = (i + 1) / phase5Days
    price = breakdownStart + (currentPrice - breakdownStart) * progress + (rng() - 0.5) * ipoPrice * 0.01
    const volume = baseVolume * 1.3 * (0.7 + rng() * 0.4)

    const open = price + (rng() - 0.3) * ipoPrice * 0.008
    const close = price
    const high = Math.max(open, close) * (1 + rng() * 0.006)
    const low = Math.min(open, close) * (1 - rng() * 0.006)

    dailyPrices.push({
      date: currentDate.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100, high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100, close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
    })
    dayIndex++
  }

  // Adjust last 10
  const last10 = dailyPrices.slice(-10)
  for (let i = 0; i < last10.length; i++) {
    const ratio = (i + 1) / last10.length
    const targetClose = last10[i].close + (currentPrice - last10[i].close) * ratio
    const adjust = targetClose / last10[i].close
    last10[i].open = Math.round(last10[i].open * adjust * 100) / 100
    last10[i].close = Math.round(targetClose * 100) / 100
    last10[i].high = Math.max(last10[i].open, last10[i].close) * 1.002
    last10[i].low = Math.min(last10[i].open, last10[i].close) * 0.998
    last10[i].high = Math.round(last10[i].high * 100) / 100
    last10[i].low = Math.round(last10[i].low * 100) / 100
  }

  return dailyPrices
}

function generateFormingPrices(ipoPrice: number, currentPrice: number, symbol: string) {
  const rng = seededRandom(hashString(symbol))
  const totalDays = 126
  const dailyPrices: { date: string; open: number; high: number; low: number; close: number; volume: number }[] = []
  const baseVolume = 800000 + rng() * 500000

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - totalDays)

  let price = ipoPrice
  let dayIndex = 0
  const peakPrice = ipoPrice * (currentPrice > ipoPrice ? 1.3 : 1.15)
  const bottomPrice = currentPrice < ipoPrice ? currentPrice * 0.95 : ipoPrice * 0.8

  // Phase 1: Initial rally (10%)
  const phase1Days = Math.round(totalDays * 0.10)
  for (let i = 0; i < phase1Days && dayIndex < totalDays; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + dayIndex)
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) { dayIndex++; i--; continue }

    const progress = (i + 1) / phase1Days
    price = ipoPrice + (peakPrice - ipoPrice) * progress + (rng() - 0.5) * ipoPrice * 0.02
    const volume = baseVolume * 1.3 * (0.7 + rng() * 0.3)

    const open = price + (rng() - 0.5) * ipoPrice * 0.01
    const close = price
    const high = Math.max(open, close) * (1 + rng() * 0.008)
    const low = Math.min(open, close) * (1 - rng() * 0.008)

    dailyPrices.push({
      date: currentDate.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100, high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100, close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
    })
    dayIndex++
  }

  // Phase 2: Decline (30%)
  const phase2Start = price
  const phase2Days = Math.round(totalDays * 0.30)
  for (let i = 0; i < phase2Days && dayIndex < totalDays; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + dayIndex)
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) { dayIndex++; i--; continue }

    const progress = (i + 1) / phase2Days
    price = phase2Start + (bottomPrice - phase2Start) * progress + (rng() - 0.5) * ipoPrice * 0.02
    const volume = baseVolume * 0.7 * (0.6 + rng() * 0.4)

    const open = price + (rng() - 0.5) * ipoPrice * 0.008
    const close = price
    const high = Math.max(open, close) * (1 + rng() * 0.006)
    const low = Math.min(open, close) * (1 - rng() * 0.006)

    dailyPrices.push({
      date: currentDate.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100, high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100, close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
    })
    dayIndex++
  }

  // Phase 3: Early Consolidation (35%) - moderate range, moderate volume
  const consolCenter = bottomPrice * 1.05
  const consolRange = ipoPrice * 0.04
  const phase3Days = Math.round(totalDays * 0.35)
  for (let i = 0; i < phase3Days && dayIndex < totalDays; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + dayIndex)
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) { dayIndex++; i--; continue }

    const progress = (i + 1) / phase3Days
    // Slowly grind up
    const targetCenter = consolCenter + (currentPrice * 0.9 - consolCenter) * progress * 0.3
    price = targetCenter + (rng() - 0.5) * consolRange
    const volume = baseVolume * 0.5 * (0.6 + rng() * 0.4)

    const open = price + (rng() - 0.5) * consolRange * 0.3
    const close = price
    const high = Math.max(open, close) * (1 + rng() * 0.005)
    const low = Math.min(open, close) * (1 - rng() * 0.005)

    dailyPrices.push({
      date: currentDate.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100, high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100, close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
    })
    dayIndex++
  }

  // Phase 4: Late Consolidation (25%) - continuing to form base
  const lateCenter = currentPrice * 0.92
  const lateRange = ipoPrice * 0.03
  const phase4Days = Math.round(totalDays * 0.25)
  for (let i = 0; i < phase4Days && dayIndex < totalDays; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + dayIndex)
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) { dayIndex++; i--; continue }

    const progress = (i + 1) / phase4Days
    const targetCenter = lateCenter + (currentPrice - lateCenter) * progress * 0.5
    price = targetCenter + (rng() - 0.5) * lateRange
    const volume = baseVolume * 0.4 * (0.5 + rng() * 0.3)

    const open = price + (rng() - 0.5) * lateRange * 0.3
    const close = price
    const high = Math.max(open, close) * (1 + rng() * 0.004)
    const low = Math.min(open, close) * (1 - rng() * 0.004)

    dailyPrices.push({
      date: currentDate.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100, high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100, close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
    })
    dayIndex++
  }

  // Adjust last 10
  const last10 = dailyPrices.slice(-10)
  for (let i = 0; i < last10.length; i++) {
    const ratio = (i + 1) / last10.length
    const targetClose = last10[i].close + (currentPrice - last10[i].close) * ratio
    const adjust = targetClose / last10[i].close
    last10[i].open = Math.round(last10[i].open * adjust * 100) / 100
    last10[i].close = Math.round(targetClose * 100) / 100
    last10[i].high = Math.max(last10[i].open, last10[i].close) * 1.002
    last10[i].low = Math.min(last10[i].open, last10[i].close) * 0.998
    last10[i].high = Math.round(last10[i].high * 100) / 100
    last10[i].low = Math.round(last10[i].low * 100) / 100
  }

  return dailyPrices
}

function aggregateWeekly(dailyPrices: { date: string; open: number; high: number; low: number; close: number; volume: number }[]) {
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

// Pre-set scores based on pattern type for seed data
// The scan algorithm will recalculate when run with real Yahoo Finance data
function getPatternScores(pattern: 'success' | 'failed' | 'forming', rng: () => number) {
  const jitter = () => Math.round((rng() - 0.5) * 10)

  if (pattern === 'success') {
    const horizontalPivotScore = Math.min(100, Math.max(0, 75 + jitter()))
    const volumeDryUpScore = Math.min(100, Math.max(0, 80 + jitter()))
    const breakoutVolumeScore = Math.min(100, Math.max(0, 70 + jitter()))
    const vcpScore = Math.min(100, Math.max(0, 85 + jitter()))
    const priceVsIpoLowScore = Math.min(100, Math.max(0, 90 + jitter()))
    const weeklyConvictionScore = Math.min(100, Math.max(0, 75 + jitter()))
    const totalScore = Math.round((horizontalPivotScore + volumeDryUpScore + breakoutVolumeScore + vcpScore + priceVsIpoLowScore + weeklyConvictionScore) / 6)
    return {
      horizontalPivotScore, volumeDryUpScore, breakoutVolumeScore,
      vcpScore, priceVsIpoLowScore, weeklyConvictionScore, totalScore,
      baseStatus: totalScore >= 60 && breakoutVolumeScore >= 45 ? 'BREAKOUT' : totalScore >= 50 && weeklyConvictionScore >= 35 ? 'ADVANCING' : 'FORMING',
      recommendation: totalScore >= 65 ? 'STRONG_BUY' : totalScore >= 55 ? 'BUY' : 'WATCH',
    }
  } else if (pattern === 'failed') {
    const horizontalPivotScore = Math.min(100, Math.max(0, 15 + jitter()))
    const volumeDryUpScore = Math.min(100, Math.max(0, 25 + jitter()))
    const breakoutVolumeScore = Math.min(100, Math.max(0, 5 + jitter()))
    const vcpScore = Math.min(100, Math.max(0, 20 + jitter()))
    const priceVsIpoLowScore = Math.min(100, Math.max(0, 10 + jitter()))
    const weeklyConvictionScore = Math.min(100, Math.max(0, 15 + jitter()))
    const totalScore = Math.round((horizontalPivotScore + volumeDryUpScore + breakoutVolumeScore + vcpScore + priceVsIpoLowScore + weeklyConvictionScore) / 6)
    return {
      horizontalPivotScore, volumeDryUpScore, breakoutVolumeScore,
      vcpScore, priceVsIpoLowScore, weeklyConvictionScore, totalScore,
      baseStatus: 'FAILED',
      recommendation: 'AVOID',
    }
  } else {
    const horizontalPivotScore = Math.min(100, Math.max(0, 40 + jitter()))
    const volumeDryUpScore = Math.min(100, Math.max(0, 45 + jitter()))
    const breakoutVolumeScore = Math.min(100, Math.max(0, 30 + jitter()))
    const vcpScore = Math.min(100, Math.max(0, 50 + jitter()))
    const priceVsIpoLowScore = Math.min(100, Math.max(0, 35 + jitter()))
    const weeklyConvictionScore = Math.min(100, Math.max(0, 30 + jitter()))
    const totalScore = Math.round((horizontalPivotScore + volumeDryUpScore + breakoutVolumeScore + vcpScore + priceVsIpoLowScore + weeklyConvictionScore) / 6)
    return {
      horizontalPivotScore, volumeDryUpScore, breakoutVolumeScore,
      vcpScore, priceVsIpoLowScore, weeklyConvictionScore, totalScore,
      baseStatus: 'FORMING',
      recommendation: 'WATCH',
    }
  }
}

export async function POST() {
  try {
    const existing = await db.ipoStock.count()
    if (existing > 0) {
      return NextResponse.json({ message: `Database already has ${existing} stocks`, seeded: false })
    }

    for (const stock of STOCKS) {
      const listingGainPct = ((stock.ipoOpenPrice - stock.ipoPrice) / stock.ipoPrice) * 100
      const ipoDate = new Date()
      ipoDate.setMonth(ipoDate.getMonth() - 6)
      const ipoDateStr = ipoDate.toISOString().split('T')[0]

      const rng = seededRandom(hashString(stock.symbol))
      const scores = getPatternScores(stock.pattern, rng)

      // Compute derived fields
      const baseWeeks = stock.pattern === 'success' ? 16 + Math.floor(rng() * 8) : stock.pattern === 'failed' ? 12 + Math.floor(rng() * 6) : 8 + Math.floor(rng() * 8)
      const pivotLevel = stock.currentPrice * (0.90 + rng() * 0.08)
      const supportLevel = stock.currentPrice * (0.75 + rng() * 0.10)
      const breakoutDate = stock.pattern === 'success' ? (() => {
        const d = new Date()
        d.setDate(d.getDate() - Math.floor(rng() * 14 + 1))
        return d.toISOString().split('T')[0]
      })() : null

      const created = await db.ipoStock.create({
        data: {
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          ipoDate: ipoDateStr,
          ipoPrice: stock.ipoPrice,
          ipoOpenPrice: stock.ipoOpenPrice,
          ipoDayLow: stock.ipoDayLow,
          ipoDayHigh: stock.ipoDayHigh,
          currentPrice: stock.currentPrice,
          listingGainPct: Math.round(listingGainPct * 100) / 100,
          marketCap: stock.marketCap,
          exchange: stock.exchange,
          horizontalPivotScore: scores.horizontalPivotScore,
          volumeDryUpScore: scores.volumeDryUpScore,
          breakoutVolumeScore: scores.breakoutVolumeScore,
          vcpScore: scores.vcpScore,
          priceVsIpoLowScore: scores.priceVsIpoLowScore,
          weeklyConvictionScore: scores.weeklyConvictionScore,
          totalScore: scores.totalScore,
          baseStatus: scores.baseStatus,
          baseWeeks,
          pivotLevel: Math.round(pivotLevel * 100) / 100,
          supportLevel: Math.round(supportLevel * 100) / 100,
          breakoutDate,
          recommendation: scores.recommendation,
          lastUpdated: 'never',
          dataSource: 'seed',
        },
      })

      let dailyPrices: { date: string; open: number; high: number; low: number; close: number; volume: number }[]

      if (stock.pattern === 'success') {
        dailyPrices = generateSuccessPrices(stock.ipoPrice, stock.currentPrice, stock.symbol)
      } else if (stock.pattern === 'failed') {
        dailyPrices = generateFailedPrices(stock.ipoPrice, stock.currentPrice, stock.symbol)
      } else {
        dailyPrices = generateFormingPrices(stock.ipoPrice, stock.currentPrice, stock.symbol)
      }

      const weeklyPrices = aggregateWeekly(dailyPrices)

      await db.dailyPrice.createMany({
        data: dailyPrices.map(p => ({ ...p, stockId: created.id })),
      })

      await db.weeklyPrice.createMany({
        data: weeklyPrices.map(p => ({ ...p, stockId: created.id })),
      })
    }

    const totalStocks = await db.ipoStock.count()
    return NextResponse.json({ message: `Seeded ${totalStocks} stocks with price data`, seeded: true })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Failed to seed database' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    await db.dailyPrice.deleteMany()
    await db.weeklyPrice.deleteMany()
    await db.ipoStock.deleteMany()
    return NextResponse.json({ message: 'All data cleared' })
  } catch (error) {
    console.error('Clear error:', error)
    return NextResponse.json({ error: 'Failed to clear data' }, { status: 500 })
  }
}
