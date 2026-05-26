'use client'

import { Activity, RefreshCw, ScanSearch, ListPlus, RotateCcw, Clock, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface HeaderProps {
  stats: { total: number; strongBuy: number; buy: number; watch: number; avoid: number }
  onRefreshPrices: () => void
  onRefreshHistory: () => void
  onFullRefresh: () => void
  onRunScanner: () => void
  onManageStocks: () => void
  isRefreshing: boolean
  isScanning: boolean
  lastUpdated?: string
  dataSource?: string
}

function formatLastUpdated(timestamp: string): string {
  if (!timestamp || timestamp === 'never') return 'Never'
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)

    if (diffSec < 10) return 'Just now'
    if (diffSec < 60) return `${diffSec}s ago`
    if (diffMin < 60) return `${diffMin}m ago`
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return 'Unknown'
  }
}

function isDataStale(timestamp: string): boolean {
  if (!timestamp || timestamp === 'never') return true
  try {
    const date = new Date(timestamp)
    const now = new Date()
    return (now.getTime() - date.getTime()) > 5 * 60 * 1000 // stale after 5 minutes
  } catch {
    return true
  }
}

export function Header({ stats, onRefreshPrices, onRefreshHistory, onFullRefresh, onRunScanner, onManageStocks, isRefreshing, isScanning, lastUpdated = 'never', dataSource = 'seed' }: HeaderProps) {
  const stale = isDataStale(lastUpdated)
  const isSeedData = dataSource === 'seed' || !lastUpdated || lastUpdated === 'never'

  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 p-6">
      {/* Decorative blurs */}
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-emerald-500/5 blur-3xl" />

      <div className="relative flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20">
              <Activity className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">IPO Base Scanner</h1>
                {/* Data Source Badge */}
                {isSeedData ? (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/10 border-amber-500/30 text-amber-400">
                    <WifiOff className="mr-1 h-2.5 w-2.5" />
                    SEED DATA
                  </Badge>
                ) : stale ? (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-orange-500/10 border-orange-500/30 text-orange-400">
                    <Clock className="mr-1 h-2.5 w-2.5" />
                    STALE
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                    <Wifi className="mr-1 h-2.5 w-2.5" />
                    LIVE
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400">
                High-Probability Breakout Identification
                {lastUpdated && lastUpdated !== 'never' && (
                  <span className="text-slate-500"> • Updated {formatLastUpdated(lastUpdated)}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onManageStocks} className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
              <ListPlus className="mr-1.5 h-3.5 w-3.5" /> Manage
            </Button>
            <Button variant="outline" size="sm" onClick={onRefreshPrices} disabled={isRefreshing} className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Live Prices
            </Button>
            <Button variant="outline" size="sm" onClick={onRefreshHistory} disabled={isRefreshing} className="border-purple-700/50 text-purple-300 hover:bg-purple-900/30 hover:text-purple-200">
              <RotateCcw className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Real History
            </Button>
            <Button variant="outline" size="sm" onClick={onFullRefresh} disabled={isRefreshing} className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
              <RotateCcw className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Full Refresh
            </Button>
            <Button size="sm" onClick={onRunScanner} disabled={isScanning} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <ScanSearch className={`mr-1.5 h-3.5 w-3.5 ${isScanning ? 'animate-pulse' : ''}`} /> {isScanning ? 'Scanning...' : 'Run Scanner'}
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2 text-center">
            <div className="text-lg font-bold text-white">{stats.total}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Total Stocks</div>
          </div>
          <div className="rounded-lg bg-emerald-950/30 border border-emerald-500/20 px-3 py-2 text-center">
            <div className="text-lg font-bold text-emerald-400">{stats.strongBuy + stats.buy}</div>
            <div className="text-[10px] uppercase tracking-wider text-emerald-400/70">Buy / Strong Buy</div>
          </div>
          <div className="rounded-lg bg-amber-950/30 border border-amber-500/20 px-3 py-2 text-center">
            <div className="text-lg font-bold text-amber-400">{stats.watch}</div>
            <div className="text-[10px] uppercase tracking-wider text-amber-400/70">Watch</div>
          </div>
          <div className="rounded-lg bg-red-950/30 border border-red-500/20 px-3 py-2 text-center">
            <div className="text-lg font-bold text-red-400">{stats.avoid}</div>
            <div className="text-[10px] uppercase tracking-wider text-red-400/70">Avoid</div>
          </div>
        </div>
      </div>
    </div>
  )
}
