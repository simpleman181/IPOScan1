'use client'

import { ScoreIndicator, MiniScoreBar } from './score-indicator'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { motion } from 'framer-motion'

interface StockCardProps {
  stock: any
  onClick: () => void
}

const statusColors: Record<string, string> = {
  FORMING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  BREAKOUT: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  ADVANCING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const recColors: Record<string, string> = {
  STRONG_BUY: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  BUY: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  WATCH: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  AVOID: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const recLabels: Record<string, string> = {
  STRONG_BUY: 'Strong Buy',
  BUY: 'Buy',
  WATCH: 'Watch',
  AVOID: 'Avoid',
}

export function StockCard({ stock, onClick }: StockCardProps) {
  const gainFromIpo = stock.ipoPrice > 0 ? ((stock.currentPrice - stock.ipoPrice) / stock.ipoPrice) * 100 : 0
  const isPositive = gainFromIpo >= 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className="group relative cursor-pointer border-slate-700/50 bg-slate-900/80 hover:border-emerald-500/40 hover:bg-slate-800/80 transition-all duration-300 overflow-hidden"
        onClick={onClick}
      >
        {/* Hover gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        <CardContent className="relative p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-bold text-white text-sm truncate">{stock.symbol}</h3>
                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${statusColors[stock.baseStatus] || ''}`}>
                  {stock.baseStatus}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 truncate">{stock.name}</p>
              <p className="text-[10px] text-slate-500">{stock.sector}</p>
            </div>
            <ScoreIndicator score={stock.totalScore} size={72} />
          </div>

          {/* Price */}
          <div className="mb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-white">&#8377;{stock.currentPrice.toFixed(0)}</span>
              <span className={`text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPositive ? '+' : ''}{gainFromIpo.toFixed(1)}% from IPO
              </span>
            </div>
            {/* Data freshness indicator */}
            {stock.dataSource && stock.dataSource !== 'seed' && stock.lastUpdated && stock.lastUpdated !== 'never' ? (
              <span className="text-[9px] text-emerald-500/70">Live • {new Date(stock.lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            ) : (
              <span className="text-[9px] text-amber-500/70">Seed data (click Refresh for live)</span>
            )}
          </div>

          {/* Mini Score Bars */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <MiniScoreBar label="H-Pivot" score={stock.horizontalPivotScore} />
            <MiniScoreBar label="Vol Dry-Up" score={stock.volumeDryUpScore} />
            <MiniScoreBar label="Breakout Vol" score={stock.breakoutVolumeScore} />
            <MiniScoreBar label="VCP" score={stock.vcpScore} />
            <MiniScoreBar label="vs IPO Low" score={stock.priceVsIpoLowScore} />
            <MiniScoreBar label="Weekly Conv" score={stock.weeklyConvictionScore} />
          </div>

          {/* Recommendation badge */}
          <div className="mt-3 flex items-center justify-between">
            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${recColors[stock.recommendation] || ''}`}>
              {recLabels[stock.recommendation] || stock.recommendation}
            </Badge>
            {stock.baseWeeks > 0 && (
              <span className="text-[10px] text-slate-500">{stock.baseWeeks}w in base</span>
            )}
          </div>

          {/* View details button on hover */}
          <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="text-center text-xs text-emerald-400 font-medium">View Details →</div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function SkeletonCard() {
  return (
    <Card className="border-slate-700/50 bg-slate-900/80">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="h-4 w-24 bg-slate-700 rounded animate-pulse mb-2" />
            <div className="h-3 w-32 bg-slate-700/50 rounded animate-pulse mb-1" />
            <div className="h-3 w-16 bg-slate-700/30 rounded animate-pulse" />
          </div>
          <div className="h-[72px] w-[72px] bg-slate-700/30 rounded-full animate-pulse" />
        </div>
        <div className="h-5 w-20 bg-slate-700/50 rounded animate-pulse mb-3" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3 bg-slate-700/30 rounded animate-pulse" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
