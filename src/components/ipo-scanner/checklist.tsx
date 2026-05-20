'use client'

import { CheckCircle2, XCircle } from 'lucide-react'

interface ChecklistProps {
  scores: {
    horizontalPivotScore: number
    volumeDryUpScore: number
    breakoutVolumeScore: number
    vcpScore: number
    priceVsIpoLowScore: number
    weeklyConvictionScore: number
  }
}

const THRESHOLDS = [
  { key: 'horizontalPivotScore', label: 'Horizontal Pivot', threshold: 60 },
  { key: 'volumeDryUpScore', label: 'Volume Dry-Up', threshold: 50 },
  { key: 'breakoutVolumeScore', label: 'Breakout Volume', threshold: 60 },
  { key: 'vcpScore', label: 'VCP Pattern', threshold: 50 },
  { key: 'priceVsIpoLowScore', label: 'Price vs IPO Low', threshold: 50 },
  { key: 'weeklyConvictionScore', label: 'Weekly Conviction', threshold: 50 },
]

export function Checklist({ scores }: ChecklistProps) {
  const passCount = THRESHOLDS.filter(t => (scores as any)[t.key] >= t.threshold).length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-white">IPO Base Checklist</h4>
        <span className="text-xs text-emerald-400">{passCount}/{THRESHOLDS.length} pass</span>
      </div>
      <div className="space-y-2">
        {THRESHOLDS.map(t => {
          const score = (scores as any)[t.key] as number
          const pass = score >= t.threshold
          return (
            <div key={t.key} className="flex items-center gap-2">
              {pass ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400 shrink-0" />
              )}
              <span className={`text-xs flex-1 ${pass ? 'text-slate-300' : 'text-slate-500'}`}>
                {t.label}
              </span>
              <span className={`text-xs font-mono ${pass ? 'text-emerald-400' : 'text-red-400'}`}>
                {score}/{t.threshold}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
