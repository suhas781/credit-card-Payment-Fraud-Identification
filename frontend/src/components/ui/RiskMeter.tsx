interface RiskMeterProps {
  confidence: number
}

export function RiskMeter({ confidence }: RiskMeterProps) {
  const pct = Math.min(100, Math.max(0, confidence * 100))
  const dash = (pct / 100) * 251.2

  return (
    <div className="relative mx-auto h-36 w-36">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="#1f2937"
          strokeWidth="10"
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="#6366f1"
          strokeWidth="10"
          strokeDasharray={`${dash} 251.2`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-bold tabular-nums text-[#f9fafb]">
          {pct.toFixed(1)}%
        </span>
        <span className="text-xs text-[#9ca3af]">fraud prob.</span>
      </div>
    </div>
  )
}
