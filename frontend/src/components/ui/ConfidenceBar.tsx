interface ConfidenceBarProps {
  confidence: number
}

export function ConfidenceBar({ confidence }: ConfidenceBarProps) {
  const pct = Math.min(100, confidence * 100)
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-[#1f2937]">
      <div
        className="h-full rounded-full bg-indigo-500 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
