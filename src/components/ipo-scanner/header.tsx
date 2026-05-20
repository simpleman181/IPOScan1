'use client'

import { Activity, RefreshCw, ScanSearch, ListPlus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useIpoStore } from '@/lib/ipo-store'

interface HeaderProps {
  stats: { total: number; strongBuy: number; buy: number; watch: number; avoid: number }
  onRefreshPrices: () => void
  onFullRefresh: () => void
  onRunScanner: () => void
  onManageStocks: () => void
  isRefreshing: boolean
  isScanning: boolean
}

export function Header({ stats, onRefreshPrices, onFullRefresh, onRunScanner, onManageStocks, isRefreshing, isScanning }: HeaderProps) {
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
              <h1 className="text-xl font-bold text-white">IPO Base Scanner</h1>
              <p className="text-xs text-slate-400">High-Probability Breakout Identification</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onManageStocks} className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
              <ListPlus className="mr-1.5 h-3.5 w-3.5" /> Manage
            </Button>
            <Button variant="outline" size="sm" onClick={onRefreshPrices} disabled={isRefreshing} className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh Prices
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
