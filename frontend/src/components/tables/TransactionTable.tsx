import type { BatchResultRow, RecentTransactionRow, RiskLevel } from '../../types'

function RiskChip({ level }: { level: RiskLevel | null | undefined }) {
  if (!level) return <span className="text-[#6b7280]">—</span>
  const c =
    level === 'CRITICAL'
      ? 'bg-red-950 text-red-400 ring-1 ring-red-500/50'
      : level === 'HIGH'
        ? 'bg-orange-950 text-orange-400'
        : level === 'MEDIUM'
          ? 'bg-amber-950 text-amber-400'
          : 'bg-emerald-950 text-emerald-400'
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>
      {level}
    </span>
  )
}

interface TransactionTableProps {
  mode: 'batch' | 'recent'
  batchRows?: BatchResultRow[]
  recentRows?: RecentTransactionRow[]
}

export function TransactionTable({
  mode,
  batchRows = [],
  recentRows = [],
}: TransactionTableProps) {
  if (mode === 'batch') {
    return (
      <div className="overflow-x-auto rounded-lg border border-[rgba(255,255,255,0.06)]">
        <table className="w-full min-w-[360px] text-left text-sm">
          <thead className="border-b border-[rgba(255,255,255,0.06)] bg-[#0a0f1e] text-[#9ca3af]">
            <tr>
              <th className="px-3 py-2 font-medium">Row</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Risk</th>
              <th className="px-3 py-2 font-medium">Prediction</th>
              <th className="px-3 py-2 font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {batchRows.map((p) => (
              <tr
                key={p.row_index}
                className={
                  p.is_fraud
                    ? 'bg-red-950/30 text-red-300'
                    : 'border-t border-[rgba(255,255,255,0.04)] hover:bg-[#1f2937]'
                }
              >
                <td className="px-3 py-2 tabular-nums">{p.row_index}</td>
                <td className="px-3 py-2 font-mono">{p.Amount.toFixed(2)}</td>
                <td className="px-3 py-2">
                  <RiskChip level={p.risk_level} />
                </td>
                <td className="px-3 py-2 font-medium">
                  {p.is_fraud ? 'Fraud' : 'Legit'}
                </td>
                <td className="px-3 py-2 font-mono tabular-nums">
                  {(p.confidence * 100).toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[rgba(255,255,255,0.06)]">
      <table className="w-full min-w-[400px] text-left text-sm">
        <thead className="border-b border-[rgba(255,255,255,0.06)] bg-[#0a0f1e] text-[#9ca3af]">
          <tr>
            <th className="px-3 py-2 font-medium">ID</th>
            <th className="px-3 py-2 font-medium">Amount</th>
            <th className="px-3 py-2 font-medium">Result</th>
            <th className="px-3 py-2 font-medium">Risk</th>
            <th className="px-3 py-2 font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {recentRows.map((r) => (
            <tr
              key={r.transaction_id}
              className={
                r.is_fraud
                  ? 'bg-red-950/20'
                  : 'border-t border-[rgba(255,255,255,0.04)]'
              }
            >
              <td className="max-w-[100px] truncate px-3 py-2 font-mono text-xs text-[#9ca3af]">
                {r.transaction_id}
              </td>
              <td className="px-3 py-2 font-mono">{r.Amount.toFixed(2)}</td>
              <td className="px-3 py-2">
                {r.is_fraud ? (
                  <span className="text-red-400">Fraud</span>
                ) : (
                  <span className="text-emerald-400">Legit</span>
                )}
              </td>
              <td className="px-3 py-2">
                <RiskChip level={r.risk_level as RiskLevel | undefined} />
              </td>
              <td className="px-3 py-2 font-mono tabular-nums">
                {(r.confidence * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
