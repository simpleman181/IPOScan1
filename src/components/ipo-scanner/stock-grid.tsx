'use client'

import { StockCard, SkeletonCard } from './stock-card'
import { SearchX } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'

interface StockGridProps {
  stocks: any[]
  isLoading: boolean
  onStockClick: (stock: any) => void
}

export function StockGrid({ stocks, isLoading, onStockClick }: StockGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (stocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <SearchX className="h-12 w-12 mb-3 text-slate-600" />
        <p className="text-lg font-medium">No stocks found</p>
        <p className="text-sm text-slate-500">Try adjusting your filters or seed the database</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <AnimatePresence mode="popLayout">
        {stocks.map((stock) => (
          <StockCard key={stock.id} stock={stock} onClick={() => onStockClick(stock)} />
        ))}
      </AnimatePresence>
    </div>
  )
}
