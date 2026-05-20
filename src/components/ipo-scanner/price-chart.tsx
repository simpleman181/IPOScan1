'use client'

import { ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PriceChartProps {
  dailyPrices: { date: string; open: number; high: number; low: number; close: number; volume: number }[]
  weeklyPrices: { date: string; open: number; high: number; low: number; close: number; volume: number }[]
  pivotLevel: number | null
  supportLevel: number | null
  ipoPrice: number
}

function formatVolume(v: number): string {
  if (v >= 10000000) return `${(v / 10000000).toFixed(1)}Cr`
  if (v >= 100000) return `${(v / 100000).toFixed(1)}L`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`
  return v.toFixed(0)
}

function formatPrice(v: number): string {
  return `₹${v.toFixed(0)}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

export function PriceChart({ dailyPrices, weeklyPrices, pivotLevel, supportLevel, ipoPrice }: PriceChartProps) {
  const [view, setView] = useState<'daily' | 'weekly'>('daily')

  const data = (view === 'daily' ? dailyPrices : weeklyPrices).map((p) => ({
    date: formatDate(p.date),
    price: p.close,
    volume: p.volume,
    fullDate: p.date,
  }))

  const maxVolume = Math.max(...data.map(d => d.volume), 1)
  const minPrice = Math.min(...data.map(d => d.price))
  const maxPrice = Math.max(...data.map(d => d.price))
  const priceRange = maxPrice - minPrice || 1

  // Scale volume to 1/4 of price range
  const volumeScale = (priceRange * 0.25) / maxVolume

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-white">Price Chart</h4>
        <Tabs value={view} onValueChange={(v) => setView(v as 'daily' | 'weekly')}>
          <TabsList className="h-7 bg-slate-800">
            <TabsTrigger value="daily" className="text-xs h-5 px-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs h-5 px-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Weekly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#475569" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#475569" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              interval={Math.floor(data.length / 6)}
              axisLine={{ stroke: '#334155' }}
            />
            <YAxis
              yAxisId="price"
              domain={[minPrice - priceRange * 0.1, maxPrice + priceRange * 0.15]}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickFormatter={formatPrice}
              axisLine={{ stroke: '#334155' }}
            />
            <YAxis
              yAxisId="volume"
              orientation="right"
              domain={[0, maxVolume / 0.25]}
              hide
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#e2e8f0',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'price') return [formatPrice(value), 'Price']
                if (name === 'volume') return [formatVolume(value), 'Volume']
                return [value, name]
              }}
              labelFormatter={(label) => `Date: ${label}`}
            />

            {/* Volume bars */}
            <Bar
              yAxisId="price"
              dataKey="volume"
              fill="url(#volumeGradient)"
              barSize={view === 'daily' ? 3 : 6}
              // Scale volume manually via shape rendering
            />

            {/* Price area */}
            <Area
              yAxisId="price"
              type="monotone"
              dataKey="price"
              stroke="#10b981"
              strokeWidth={1.5}
              fill="url(#priceGradient)"
            />

            {/* Reference lines */}
            {pivotLevel && (
              <ReferenceLine yAxisId="price" y={pivotLevel} stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={1} label={{ value: `Pivot ₹${pivotLevel.toFixed(0)}`, position: 'right', fontSize: 9, fill: '#f59e0b' }} />
            )}
            {supportLevel && (
              <ReferenceLine yAxisId="price" y={supportLevel} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1} label={{ value: `Support ₹${supportLevel.toFixed(0)}`, position: 'right', fontSize: 9, fill: '#ef4444' }} />
            )}
            {ipoPrice > 0 && (
              <ReferenceLine yAxisId="price" y={ipoPrice} stroke="#64748b" strokeDasharray="3 3" strokeWidth={1} label={{ value: `IPO ₹${ipoPrice.toFixed(0)}`, position: 'left', fontSize: 9, fill: '#64748b' }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
