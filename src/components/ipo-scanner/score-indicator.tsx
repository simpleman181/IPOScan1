'use client'

interface ScoreIndicatorProps {
  score: number
  size?: number
}

const scoreColor = (score: number): string => {
  if (score >= 80) return '#10b981' // emerald
  if (score >= 50) return '#f59e0b' // amber
  return '#ef4444' // red
}

export function ScoreIndicator({ score, size = 72 }: ScoreIndicatorProps) {
  const strokeWidth = size * 0.08
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const color = scoreColor(score)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(148,163,184,0.15)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-bold text-white" style={{ fontSize: size * 0.28 }}>
          {score}
        </span>
      </div>
    </div>
  )
}

interface MiniScoreBarProps {
  label: string
  score: number
}

export function MiniScoreBar({ label, score }: MiniScoreBarProps) {
  const color = scoreColor(score)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400 w-16 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] text-slate-300 font-mono w-5 text-right">{score}</span>
    </div>
  )
}
