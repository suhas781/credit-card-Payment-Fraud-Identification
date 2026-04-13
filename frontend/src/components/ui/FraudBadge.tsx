interface FraudBadgeProps {
  isFraud: boolean
}

export function FraudBadge({ isFraud }: FraudBadgeProps) {
  return (
    <div
      className={`inline-block rounded-lg px-6 py-3 text-center text-xl font-bold tracking-wide sm:text-2xl ${
        isFraud
          ? 'bg-red-950/50 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
          : 'bg-emerald-950/40 text-emerald-400 shadow-[0_0_20px_rgba(34,197,94,0.15)]'
      }`}
    >
      {isFraud ? 'FRAUD' : 'LEGITIMATE'}
    </div>
  )
}
