'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { useIpoStore } from '@/lib/ipo-store'

export function FilterBar() {
  const { filters, setFilter, resetFilters } = useIpoStore()

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
      {/* Search */}
      <div className="relative w-full sm:w-48">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
        <Input
          placeholder="Search symbol..."
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
          className="pl-8 h-8 bg-slate-800 border-slate-700 text-sm text-white placeholder:text-slate-500"
        />
      </div>

      {/* Status select */}
      <Select value={filters.status} onValueChange={(v) => setFilter('status', v)}>
        <SelectTrigger className="w-full sm:w-36 h-8 bg-slate-800 border-slate-700 text-sm text-white">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700">
          <SelectItem value="ALL">All Status</SelectItem>
          <SelectItem value="FORMING">Forming</SelectItem>
          <SelectItem value="BREAKOUT">Breakout</SelectItem>
          <SelectItem value="ADVANCING">Advancing</SelectItem>
          <SelectItem value="FAILED">Failed</SelectItem>
        </SelectContent>
      </Select>

      {/* Recommendation select */}
      <Select value={filters.recommendation} onValueChange={(v) => setFilter('recommendation', v)}>
        <SelectTrigger className="w-full sm:w-36 h-8 bg-slate-800 border-slate-700 text-sm text-white">
          <SelectValue placeholder="Recommendation" />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700">
          <SelectItem value="ALL">All Recs</SelectItem>
          <SelectItem value="STRONG_BUY">Strong Buy</SelectItem>
          <SelectItem value="BUY">Buy</SelectItem>
          <SelectItem value="WATCH">Watch</SelectItem>
          <SelectItem value="AVOID">Avoid</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort select */}
      <Select value={filters.sortBy} onValueChange={(v) => setFilter('sortBy', v)}>
        <SelectTrigger className="w-full sm:w-36 h-8 bg-slate-800 border-slate-700 text-sm text-white">
          <SelectValue placeholder="Sort By" />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700">
          <SelectItem value="totalScore">Total Score</SelectItem>
          <SelectItem value="horizontalPivotScore">H-Pivot</SelectItem>
          <SelectItem value="volumeDryUpScore">Vol Dry-Up</SelectItem>
          <SelectItem value="breakoutVolumeScore">Breakout Vol</SelectItem>
          <SelectItem value="vcpScore">VCP</SelectItem>
          <SelectItem value="currentPrice">Current Price</SelectItem>
        </SelectContent>
      </Select>

      {/* Min Score slider */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <span className="text-xs text-slate-400 whitespace-nowrap">Min Score:</span>
        <Slider
          value={[filters.minScore]}
          min={0}
          max={100}
          step={5}
          onValueChange={([v]) => setFilter('minScore', v)}
          className="w-24"
        />
        <span className="text-xs text-emerald-400 font-mono w-7">{filters.minScore}</span>
      </div>

      {/* Reset */}
      <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-slate-400 hover:text-white">
        <X className="mr-1 h-3 w-3" /> Reset
      </Button>
    </div>
  )
}
