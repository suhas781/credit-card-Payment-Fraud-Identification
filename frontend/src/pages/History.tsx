import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getHistory } from '../api/client'
import { ShapChart } from '../components/charts/ShapChart'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Spinner } from '../components/ui/Spinner'
import type { HistoryTransaction, RiskLevel } from '../types'

const RISKS: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export function History() {
  const [page, setPage] = useState(1)
  const [filterFraud, setFilterFraud] = useState<boolean | undefined>(undefined)
  const [risk, setRisk] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Awaited<ReturnType<typeof getHistory>> | null>(
    null,
  )
  const [detail, setDetail] = useState<HistoryTransaction | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getHistory({
        page,
        limit: 20,
        is_fraud: filterFraud,
        risk_level: risk,
      })
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [page, filterFraud, risk])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <PageWrapper>
      <h1 className="text-2xl font-bold text-[#f9fafb]">Transaction history</h1>
      <p className="mt-1 text-sm text-[#9ca3af]">
        Paginated log with filters (MongoDB-backed).
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <select
          className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#111827] px-3 py-2 text-sm text-[#f9fafb]"
          value={filterFraud === undefined ? 'all' : filterFraud ? 'fraud' : 'legit'}
          onChange={(e) => {
            const v = e.target.value
            setPage(1)
            setFilterFraud(
              v === 'all' ? undefined : v === 'fraud',
            )
          }}
        >
          <option value="all">All</option>
          <option value="fraud">Fraud only</option>
          <option value="legit">Legit only</option>
        </select>
        <select
          className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#111827] px-3 py-2 text-sm text-[#f9fafb]"
          value={risk ?? ''}
          onChange={(e) => {
            setPage(1)
            setRisk(e.target.value || undefined)
          }}
        >
          <option value="">Any risk</option>
          {RISKS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="mt-4 text-red-400">{error}</p>
      ) : null}

      {loading ? (
        <div className="mt-12 flex justify-center">
          <Spinner />
        </div>
      ) : data ? (
        <>
          <div className="mt-6 overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[rgba(255,255,255,0.06)] text-[#9ca3af]">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2">Risk</th>
                  <th className="px-3 py-2">Conf.</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((t) => (
                  <tr
                    key={t.transaction_id}
                    className="cursor-pointer border-t border-[rgba(255,255,255,0.04)] hover:bg-[#1f2937]"
                    onClick={() => setDetail(t)}
                  >
                    <td className="px-3 py-2 text-xs text-[#9ca3af]">
                      {new Date(t.timestamp).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono">{t.Amount.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      {t.is_fraud ? (
                        <span className="text-red-400">Fraud</span>
                      ) : (
                        <span className="text-emerald-400">Legit</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{t.risk_level ?? '—'}</td>
                    <td className="px-3 py-2 font-mono">
                      {(t.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-indigo-400">View</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-[#9ca3af]">
            <span>
              Page {data.page} / {data.pages} — {data.total} total
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-[rgba(255,255,255,0.06)] px-3 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-[rgba(255,255,255,0.06)] px-3 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}

      <AnimatePresence>
        {detail ? (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-[rgba(255,255,255,0.06)] bg-[#0a0f1e] p-6 shadow-2xl"
          >
            <button
              type="button"
              className="mb-4 text-sm text-indigo-400"
              onClick={() => setDetail(null)}
            >
              Close
            </button>
            <h3 className="font-mono text-xs text-[#9ca3af]">
              {detail.transaction_id}
            </h3>
            <p className="mt-2 text-lg font-semibold text-[#f9fafb]">
              Amount ${detail.Amount.toFixed(2)}
            </p>
            {detail.shap_top5?.length ? (
              <div className="mt-6">
                <ShapChart
                  items={detail.shap_top5.map((s) => ({
                    feature: s.feature,
                    value: s.value,
                    direction:
                      (s.direction as 'fraud' | 'legit') ||
                      (s.value >= 0 ? 'fraud' : 'legit'),
                  }))}
                />
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </PageWrapper>
  )
}
