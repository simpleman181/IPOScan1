'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useIpoStore } from '@/lib/ipo-store'
import { ScannerProvider } from '@/components/ipo-scanner/scanner-provider'
import { Header } from '@/components/ipo-scanner/header'
import { FilterBar } from '@/components/ipo-scanner/filter-bar'
import { StockGrid } from '@/components/ipo-scanner/stock-grid'
import { StockDetail } from '@/components/ipo-scanner/stock-detail'
import { StockListManager } from '@/components/ipo-scanner/stock-list-manager'
import { toast } from 'sonner'

function IpoScannerApp() {
  const queryClient = useQueryClient()
  const {
    filters, selectedStockId, isScanning, isSeeded, isRefreshingData, isManageStocksOpen,
    setSelectedStockId, setIsScanning, setIsSeeded, setIsRefreshingData, setIsManageStocksOpen,
  } = useIpoStore()

  const [selectedStock, setSelectedStock] = useState<any>(null)

  // Fetch stocks with filters
  const { data: stocksData, isLoading } = useQuery({
    queryKey: ['ipo-stocks', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.status !== 'ALL') params.set('status', filters.status)
      if (filters.recommendation !== 'ALL') params.set('recommendation', filters.recommendation)
      if (filters.minScore > 0) params.set('minScore', String(filters.minScore))
      if (filters.sortBy) params.set('sortBy', filters.sortBy)
      if (filters.search) params.set('search', filters.search)

      const res = await fetch(`/api/ipo-stocks?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch stocks')
      return res.json()
    },
  })

  const stocks = stocksData?.stocks || []
  const stats = stocksData?.stats || { total: 0, strongBuy: 0, buy: 0, watch: 0, avoid: 0 }

  // Seed database on first load
  useEffect(() => {
    if (!isSeeded) {
      seedDatabase()
    }
  }, [isSeeded])

  const seedDatabase = async () => {
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.json()
      if (data.seeded) {
        setIsSeeded(true)
        toast.success(`Database seeded with ${data.message.match(/\d+/)?.[0] || '20'} stocks`)
        queryClient.invalidateQueries({ queryKey: ['ipo-stocks'] })
      } else {
        setIsSeeded(true) // Already seeded
      }
    } catch {
      toast.error('Failed to seed database')
    }
  }

  // Fetch single stock detail
  const fetchStockDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/ipo-stocks/${id}`)
      if (!res.ok) throw new Error('Failed to fetch stock detail')
      return await res.json()
    } catch {
      toast.error('Failed to load stock details')
      return null
    }
  }, [])

  const handleStockClick = async (stock: any) => {
    setSelectedStockId(stock.id)
    const detail = await fetchStockDetail(stock.id)
    if (detail) {
      setSelectedStock(detail.stock)
    }
  }

  const handleCloseDetail = () => {
    setSelectedStockId(null)
    setSelectedStock(null)
  }

  const handleRefreshPrices = async () => {
    setIsRefreshingData(true)
    try {
      const res = await fetch('/api/market-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'prices' }),
      })
      const data = await res.json()
      toast.success(data.message || 'Prices refreshed')
      queryClient.invalidateQueries({ queryKey: ['ipo-stocks'] })
      // Auto-scan after refresh
      await handleRunScanner()
    } catch {
      toast.error('Failed to refresh prices')
    } finally {
      setIsRefreshingData(false)
    }
  }

  const handleFullRefresh = async () => {
    setIsRefreshingData(true)
    try {
      const res = await fetch('/api/market-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'full' }),
      })
      const data = await res.json()
      toast.success(data.message || 'Full refresh complete')
      queryClient.invalidateQueries({ queryKey: ['ipo-stocks'] })
      await handleRunScanner()
    } catch {
      toast.error('Failed to full refresh')
    } finally {
      setIsRefreshingData(false)
    }
  }

  const handleRunScanner = async () => {
    setIsScanning(true)
    try {
      const res = await fetch('/api/scan', { method: 'POST' })
      const data = await res.json()
      toast.success(data.message || 'Scan complete')
      queryClient.invalidateQueries({ queryKey: ['ipo-stocks'] })
    } catch {
      toast.error('Failed to run scanner')
    } finally {
      setIsScanning(false)
    }
  }

  const handleSearchYahoo = async (query: string): Promise<any[]> => {
    try {
      const res = await fetch('/api/market-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'search', query }),
      })
      const data = await res.json()
      return data.results || []
    } catch {
      return []
    }
  }

  const handleAddStock = async (stockData: any) => {
    try {
      const res = await fetch('/api/ipo-stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stockData),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to add stock')
      }
      toast.success(`${stockData.symbol} added to watchlist`)
      queryClient.invalidateQueries({ queryKey: ['ipo-stocks'] })
    } catch (err: any) {
      toast.error(err.message || 'Failed to add stock')
      throw err
    }
  }

  const handleRemoveStock = async (id: string) => {
    try {
      await fetch('/api/ipo-stocks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      toast.success('Stock removed from watchlist')
      queryClient.invalidateQueries({ queryKey: ['ipo-stocks'] })
    } catch {
      toast.error('Failed to remove stock')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <Header
          stats={stats}
          onRefreshPrices={handleRefreshPrices}
          onFullRefresh={handleFullRefresh}
          onRunScanner={handleRunScanner}
          onManageStocks={() => setIsManageStocksOpen(true)}
          isRefreshing={isRefreshingData}
          isScanning={isScanning}
        />

        <FilterBar />

        <StockGrid
          stocks={stocks}
          isLoading={isLoading}
          onStockClick={handleStockClick}
        />
      </div>

      {/* Stock Detail Dialog */}
      <StockDetail
        stock={selectedStock}
        open={!!selectedStock}
        onClose={handleCloseDetail}
      />

      {/* Stock List Manager Dialog */}
      <StockListManager
        stocks={stocks}
        open={isManageStocksOpen}
        onClose={() => setIsManageStocksOpen(false)}
        onSearchYahoo={handleSearchYahoo}
        onAddStock={handleAddStock}
        onRemoveStock={handleRemoveStock}
      />
    </div>
  )
}

export default function HomePage() {
  return (
    <ScannerProvider>
      <IpoScannerApp />
    </ScannerProvider>
  )
}
