'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScoreIndicator, MiniScoreBar } from './score-indicator'
import { PriceChart } from './price-chart'
import { Checklist } from './checklist'
import { TrendingUp, TrendingDown, Shield, AlertTriangle } from 'lucide-react'

interface StockDetailProps {
  stock: any
  open: boolean
  onClose: () => void
}

const statusLabels: Record<string, string> = {
  FORMING: 'Forming Base',
  BREAKOUT: 'Breakout',
  ADVANCING: 'Advancing',
  FAILED: 'Failed',
}

const recLabels: Record<string, string> = {
  STRONG_BUY: 'Strong Buy',
  BUY: 'Buy',
  WATCH: 'Watch',
  AVOID: 'Avoid',
}

const recColors: Record<string, string> = {
  STRONG_BUY: 'text-emerald-400',
  BUY: 'text-emerald-300',
  WATCH: 'text-amber-400',
  AVOID: 'text-red-400',
}

function getRiskLevel(totalScore: number, baseStatus: string): { level: string; color: string; icon: any; description: string } {
  if (totalScore >= 65 && (baseStatus === 'BREAKOUT' || baseStatus === 'ADVANCING')) {
    return { level: 'Low', color: 'text-emerald-400', icon: Shield, description: 'Strong breakout signal with high conviction scores. Risk of failure is low but position sizing is still recommended.' }
  }
  if (totalScore >= 50 && baseStatus !== 'FAILED') {
    return { level: 'Moderate', color: 'text-amber-400', icon: AlertTriangle, description: 'Developing pattern with some positive signals. Wait for additional confirmation or tighten stop-loss.' }
  }
  if (totalScore >= 30) {
    return { level: 'Elevated', color: 'text-orange-400', icon: AlertTriangle, description: 'Pattern is not yet clear or has mixed signals. Consider watching rather than entering.' }
  }
  return { level: 'High', color: 'text-red-400', icon: TrendingDown, description: 'Broken pattern or declining trend. Avoid entering, existing positions should have tight stops.' }
}

export function StockDetail({ stock, open, onClose }: StockDetailProps) {
  if (!stock) return null

  const gainFromIpo = stock.ipoPrice > 0 ? ((stock.currentPrice - stock.ipoPrice) / stock.ipoPrice) * 100 : 0
  const isPositive = gainFromIpo >= 0
  const risk = getRiskLevel(stock.totalScore, stock.baseStatus)
  const RiskIcon = risk.icon

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-950 border-slate-700 text-white">
        <DialogTitle className="sr-only">{stock.name} - IPO Stock Details</DialogTitle>

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-white">{stock.symbol}</h2>
              <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-300">
                {statusLabels[stock.baseStatus] || stock.baseStatus}
              </Badge>
              <Badge variant="outline" className={`text-[10px] ${recColors[stock.recommendation] || ''}`}>
                {recLabels[stock.recommendation] || stock.recommendation}
              </Badge>
            </div>
            <p className="text-sm text-slate-400">{stock.name} • {stock.sector}</p>
          </div>
          <ScoreIndicator score={stock.totalScore} size={80} />
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <InfoCard 
            label="Current Price" 
            value={`₹${stock.currentPrice.toFixed(0)}`} 
            sublabel={stock.dataSource && stock.dataSource !== 'seed' && stock.lastUpdated && stock.lastUpdated !== 'never' 
              ? `Live • ${new Date(stock.lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
              : 'Seed data'} 
            sublabelColor={stock.dataSource && stock.dataSource !== 'seed' ? 'text-emerald-500/70' : 'text-amber-500/70'}
          />
          <InfoCard label="IPO Price" value={`₹${stock.ipoPrice.toFixed(0)}`} />
          <InfoCard
            label="Gain from IPO"
            value={`${isPositive ? '+' : ''}${gainFromIpo.toFixed(1)}%`}
            valueColor={isPositive ? 'text-emerald-400' : 'text-red-400'}
          />
          <InfoCard label="Market Cap" value={stock.marketCap || 'N/A'} />
          <InfoCard label="Exchange" value={stock.exchange} />
          <InfoCard label="IPO Date" value={stock.ipoDate} />
          <InfoCard label="Base Weeks" value={`${stock.baseWeeks}w`} />
          <InfoCard label="Breakout Date" value={stock.breakoutDate || 'N/A'} />
        </div>

        <Separator className="bg-slate-700/50 mb-4" />

        {/* Score Bars */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-white mb-3">Pillar Scores</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            <MiniScoreBar label="H-Pivot" score={stock.horizontalPivotScore} />
            <MiniScoreBar label="Vol Dry-Up" score={stock.volumeDryUpScore} />
            <MiniScoreBar label="Breakout Vol" score={stock.breakoutVolumeScore} />
            <MiniScoreBar label="VCP" score={stock.vcpScore} />
            <MiniScoreBar label="vs IPO Low" score={stock.priceVsIpoLowScore} />
            <MiniScoreBar label="Weekly Conv" score={stock.weeklyConvictionScore} />
          </div>
        </div>

        <Separator className="bg-slate-700/50 mb-4" />

        {/* Price Chart */}
        <div className="mb-4">
          <PriceChart
            dailyPrices={stock.dailyPrices || []}
            weeklyPrices={stock.weeklyPrices || []}
            pivotLevel={stock.pivotLevel}
            supportLevel={stock.supportLevel}
            ipoPrice={stock.ipoPrice}
          />
        </div>

        <Separator className="bg-slate-700/50 mb-4" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Checklist */}
          <Checklist scores={{
            horizontalPivotScore: stock.horizontalPivotScore,
            volumeDryUpScore: stock.volumeDryUpScore,
            breakoutVolumeScore: stock.breakoutVolumeScore,
            vcpScore: stock.vcpScore,
            priceVsIpoLowScore: stock.priceVsIpoLowScore,
            weeklyConvictionScore: stock.weeklyConvictionScore,
          }} />

          {/* Risk Assessment */}
          <div>
            <h4 className="text-sm font-medium text-white mb-3">Risk Assessment</h4>
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <RiskIcon className={`h-5 w-5 ${risk.color}`} />
                <span className={`font-bold ${risk.color}`}>{risk.level} Risk</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{risk.description}</p>
            </div>

            {/* Key Levels */}
            <div className="mt-3">
              <h5 className="text-xs font-medium text-slate-300 mb-2">Key Levels</h5>
              <div className="space-y-1">
                <KeyLevel label="Pivot" value={stock.pivotLevel} color="text-amber-400" />
                <KeyLevel label="Support" value={stock.supportLevel} color="text-red-400" />
                <KeyLevel label="IPO Price" value={stock.ipoPrice} color="text-slate-400" />
                {stock.breakoutDate && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Breakout Date</span>
                    <span className="text-emerald-400">{stock.breakoutDate}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InfoCard({ label, value, valueColor = 'text-white', sublabel, sublabelColor = 'text-slate-500' }: { label: string; value: string; valueColor?: string; sublabel?: string; sublabelColor?: string }) {
  return (
    <div className="rounded-lg bg-slate-900/50 border border-slate-700/50 p-2.5">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-sm font-semibold ${valueColor}`}>{value}</div>
      {sublabel && <div className={`text-[9px] mt-0.5 ${sublabelColor}`}>{sublabel}</div>}
    </div>
  )
}

function KeyLevel({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={value ? color : 'text-slate-600'}>{value ? `₹${value.toFixed(0)}` : 'N/A'}</span>
    </div>
  )
}
