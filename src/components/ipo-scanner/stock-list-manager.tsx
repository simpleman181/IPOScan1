'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Plus, Trash2, Loader2, Info } from 'lucide-react'
import { useState } from 'react'

interface StockListManagerProps {
  stocks: any[]
  open: boolean
  onClose: () => void
  onSearchYahoo: (query: string) => Promise<any[]>
  onAddStock: (data: any) => Promise<any>
  onRemoveStock: (id: string) => Promise<void>
}

const recBadgeColors: Record<string, string> = {
  STRONG_BUY: 'bg-emerald-500/20 text-emerald-400',
  BUY: 'bg-emerald-500/15 text-emerald-300',
  WATCH: 'bg-amber-500/20 text-amber-400',
  AVOID: 'bg-red-500/20 text-red-400',
}

const recLabels: Record<string, string> = {
  STRONG_BUY: 'Strong Buy',
  BUY: 'Buy',
  WATCH: 'Watch',
  AVOID: 'Avoid',
}

export function StockListManager({ stocks, open, onClose, onSearchYahoo, onAddStock, onRemoveStock }: StockListManagerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Manual entry form
  const [manualForm, setManualForm] = useState({
    symbol: '',
    name: '',
    sector: '',
    ipoDate: '',
    ipoPrice: '',
    ipoOpenPrice: '',
    exchange: 'NSE',
  })

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const results = await onSearchYahoo(searchQuery)
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleAddFromSearch = async (result: any) => {
    setIsAdding(true)
    try {
      await onAddStock({
        symbol: result.symbol,
        name: result.name,
        sector: result.sector || 'Unknown',
        ipoDate: new Date().toISOString().split('T')[0],
        ipoPrice: 100,
        ipoOpenPrice: 100,
        exchange: result.exchange || 'NSE',
      })
      setSearchResults(searchResults.filter((r) => r.symbol !== result.symbol))
    } catch {
      // Error handled by toast
    } finally {
      setIsAdding(false)
    }
  }

  const handleManualAdd = async () => {
    if (!manualForm.symbol || !manualForm.name || !manualForm.sector || !manualForm.ipoDate || !manualForm.ipoPrice) return
    setIsAdding(true)
    try {
      await onAddStock({
        ...manualForm,
        ipoPrice: parseFloat(manualForm.ipoPrice),
        ipoOpenPrice: manualForm.ipoOpenPrice ? parseFloat(manualForm.ipoOpenPrice) : parseFloat(manualForm.ipoPrice),
      })
      setManualForm({ symbol: '', name: '', sector: '', ipoDate: '', ipoPrice: '', ipoOpenPrice: '', exchange: 'NSE' })
    } catch {
      // Error handled by toast
    } finally {
      setIsAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await onRemoveStock(id)
    } catch {
      // Error handled by toast
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-950 border-slate-700 text-white">
        <DialogTitle className="text-lg font-bold">Manage Watchlist</DialogTitle>

        <Tabs defaultValue="current" className="mt-2">
          <TabsList className="bg-slate-800">
            <TabsTrigger value="current" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs">
              Current ({stocks.length})
            </TabsTrigger>
            <TabsTrigger value="search" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs">
              Yahoo Search
            </TabsTrigger>
            <TabsTrigger value="manual" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs">
              Manual Entry
            </TabsTrigger>
          </TabsList>

          {/* Current watchlist */}
          <TabsContent value="current" className="mt-3">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {stocks.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No stocks in watchlist</p>
              ) : (
                stocks.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-900/50 p-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">{s.symbol}</span>
                        <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${recBadgeColors[s.recommendation] || 'text-slate-400'}`}>
                          {recLabels[s.recommendation] || s.recommendation}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{s.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium text-white">₹{s.currentPrice?.toFixed(0)}</div>
                      <div className="text-[10px] text-slate-500">Score: {s.totalScore}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(s.id)}
                      disabled={deletingId === s.id}
                      className="h-7 w-7 p-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                    >
                      {deletingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* Yahoo Search */}
          <TabsContent value="search" className="mt-3">
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Search Indian stocks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
              <Button onClick={handleSearch} disabled={isSearching} className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-900/50 p-2.5">
                    <div>
                      <div className="text-sm font-medium text-white">{r.symbol}</div>
                      <div className="text-xs text-slate-400">{r.name} • {r.exchange}</div>
                    </div>
                    <Button size="sm" onClick={() => handleAddFromSearch(r)} disabled={isAdding} className="bg-emerald-600 hover:bg-emerald-700">
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              searchQuery && !isSearching && <p className="text-center text-slate-500 py-4">No results found. Try manual entry.</p>
            )}
          </TabsContent>

          {/* Manual Entry */}
          <TabsContent value="manual" className="mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Symbol *</label>
                <Input placeholder="e.g., TATASTEEL" value={manualForm.symbol} onChange={(e) => setManualForm({ ...manualForm, symbol: e.target.value.toUpperCase() })} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Name *</label>
                <Input placeholder="Company name" value={manualForm.name} onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Sector *</label>
                <Input placeholder="e.g., Steel" value={manualForm.sector} onChange={(e) => setManualForm({ ...manualForm, sector: e.target.value })} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">IPO Date *</label>
                <Input type="date" value={manualForm.ipoDate} onChange={(e) => setManualForm({ ...manualForm, ipoDate: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">IPO Price *</label>
                <Input type="number" placeholder="Issue price" value={manualForm.ipoPrice} onChange={(e) => setManualForm({ ...manualForm, ipoPrice: e.target.value })} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">IPO Open Price</label>
                <Input type="number" placeholder="Listing open" value={manualForm.ipoOpenPrice} onChange={(e) => setManualForm({ ...manualForm, ipoOpenPrice: e.target.value })} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
              </div>
            </div>
            <Button onClick={handleManualAdd} disabled={isAdding} className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700">
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Stock
            </Button>
          </TabsContent>
        </Tabs>

        <div className="flex items-start gap-2 mt-3 p-2.5 rounded-lg bg-slate-900/50 border border-slate-700/30">
          <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-400">After adding a new stock, use &quot;Refresh Prices&quot; or &quot;Full Refresh&quot; to fetch real market data, then &quot;Run Scanner&quot; to score it.</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
