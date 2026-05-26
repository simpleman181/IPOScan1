'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useIpoStore } from '@/lib/ipo-store'
import { ScannerProvider } from '@/components/ipo-scanner/scanner-provider'
import { Header } from '@/components/ipo-scanner/header'
import { FilterBar } from '@/components/ipo-scanner/filter-bar'
import { StockGrid } from '@/components/ipo-scanner/stock-grid'
import { StockDetail } from '@/components/ipo-scanner/stock-detail'
import { StockListManager } from '@/components/ipo-scanner/stock-list-manager'
import { toast } from 'sonner'

const AUTO_REFRESH_INTERVAL = 60_000 // 60 seconds

function IpoScannerApp() {
  const queryClient = useQueryClient()
  const {
    filters, selectedStockId, isScanning, isSeeded, isRefreshingData, isManageStocksOpen,
    setSelectedStockId, setIsScanning, setIsSeeded, setIsRefreshingData, setIsManageStocksOpen,
  } = useIpoStore()

  const [selectedStock, setSelectedStock] = useState<any>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [dataSource, setDataSource] = useState<string>('seed')
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null)

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
        toast.success(`Database seeded with ${data.message.match(/\d+/)?.[0] || '20'} stocks. Fetching live prices...`)
        queryClient.invalidateQueries({ queryKey: ['ipo-stocks'] })
        // Auto-trigger full refresh after seeding to replace synthetic data with live data
        setTimeout(() => {
          handleFullRefresh()
        }, 1000)
      } else {
        setIsSeeded(true)
        // Already seeded - still trigger price refresh on load
        setTimeout(() => {
          handleRefreshPrices()
        }, 1000)
      }
    } catch {
      toast.error('Failed to seed database')
    }
  }

  // Set up auto-refresh interval
  useEffect(() => {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current)
    }

    autoRefreshRef.current = setInterval(() => {
      // Only auto-refresh if not already refreshing or scanning
      if (!isRefreshingData && !isScanning) {
        handleRefreshPrices()
      }
    }, AUTO_REFRESH_INTERVAL)

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current)
      }
    }
  }, [isRefreshingData, isScanning])

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
      if (data.failed > 0) {
        toast.warning(`Prices updated for ${data.updated}/${data.total} stocks (${data.failed} failed to fetch)`)
      } else {
        toast.success(data.message || 'Live prices refreshed')
      }
      if (data.timestamp) setLastUpdated(data.timestamp)
      queryClient.invalidateQueries({ queryKey: ['ipo-stocks'] })
    } catch {
      toast.error('Failed to refresh prices - check your connection')
    } finally {
      setIsRefreshingData(false)
    }
  }

  const handleRefreshHistory = async () => {
    setIsRefreshingData(true)
    toast.info('Fetching 6 months of real OHLCV history from Yahoo Finance — this takes ~30s...')
    try {
      const res = await fetch('/api/market-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'history' }),
      })
      const data = await res.json()
      if (data.failed > 0) {
        toast.warning(`History updated for ${data.updated}/${data.total} stocks (${data.failed} used synthetic fallback)`)
      } else {
        toast.success(data.message || 'Real OHLCV history loaded')
      }
      if (data.timestamp) setLastUpdated(data.timestamp)
      setDataSource('live')
      queryClient.invalidateQueries({ queryKey: ['ipo-stocks'] })
      // Re-run scanner now that we have real data
      await handleRunScanner()
    } catch {
      toast.error('Failed to fetch history — check your connection')
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
      if (data.failed > 0) {
        toast.warning(`Full refresh: ${data.updated}/${data.total} stocks updated (${data.failed} failed)`)
      } else {
        toast.success(data.message || 'Full refresh complete with live data')
      }
      if (data.timestamp) setLastUpdated(data.timestamp)
      setDataSource('live')
      queryClient.invalidateQueries({ queryKey: ['ipo-stocks'] })
      // Auto-scan after full refresh
      await handleRunScanner()
    } catch {
      toast.error('Failed to fetch live data - check your connection')
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

  // Get freshness info from stock data
  const stockLastUpdated = stocks.length > 0 ? stocks[0]?.lastUpdated : ''
  const stockDataSource = stocks.length > 0 ? stocks[0]?.dataSource : 'seed'
  const displayLastUpdated = lastUpdated || stockLastUpdated
  const displayDataSource = dataSource !== 'seed' ? dataSource : stockDataSource

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <Header
          stats={stats}
          onRefreshPrices={handleRefreshPrices}
          onRefreshHistory={handleRefreshHistory}
          onFullRefresh={handleFullRefresh}
          onRunScanner={handleRunScanner}
          onManageStocks={() => setIsManageStocksOpen(true)}
          isRefreshing={isRefreshingData}
          isScanning={isScanning}
          lastUpdated={displayLastUpdated}
          dataSource={displayDataSource}
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
