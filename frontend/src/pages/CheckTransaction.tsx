import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { predictTransaction } from '../api/client'
import { ShapChart } from '../components/charts/ShapChart'
import { PageWrapper } from '../components/layout/PageWrapper'
import { FraudBadge } from '../components/ui/FraudBadge'
import { ConfidenceBar } from '../components/ui/ConfidenceBar'
import { RiskMeter } from '../components/ui/RiskMeter'
import { Spinner } from '../components/ui/Spinner'
import { useTransactionForm } from '../hooks/useTransactionForm'
import type { PredictionResult, RiskLevel } from '../types'

function RiskChip({ level }: { level: RiskLevel }) {
  const c =
    level === 'CRITICAL'
      ? 'bg-red-950 text-red-400 ring-2 ring-red-500/40'
      : level === 'HIGH'
        ? 'bg-orange-950 text-orange-400'
        : level === 'MEDIUM'
          ? 'bg-amber-950 text-amber-400'
          : 'bg-emerald-950 text-emerald-400'
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${c}`}>
      {level}
    </span>
  )
}

export function CheckTransaction() {
  const {
    values,
    handleChange,
    toInput,
    prefillFraud,
    prefillLegit,
    clearAll,
    fieldKeys,
  } = useTransactionForm()
  const [result, setResult] = useState<PredictionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [explainOpen, setExplainOpen] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await predictTransaction(toInput())
      setResult(res)
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper>
      <h1 className="text-2xl font-bold text-[#f9fafb]">Check transaction</h1>
      <p className="mt-1 text-sm text-[#9ca3af]">
        V1–V28, Amount, Time — scaled server-side before scoring.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void prefillFraud()}
          className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-300 hover:bg-red-950/50"
        >
          Pre-fill sample fraud
        </button>
        <button
          type="button"
          onClick={() => void prefillLegit()}
          className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-950/50"
        >
          Pre-fill sample legit
        </button>
        <button
          type="button"
          onClick={() => {
            clearAll()
            setResult(null)
          }}
          className="rounded-lg border border-[rgba(255,255,255,0.06)] px-3 py-2 text-sm text-[#9ca3af] hover:bg-[#1f2937]"
        >
          Clear all
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-6 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827] p-4 sm:p-6"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-[#9ca3af] sm:col-span-1">
            Amount
            <input
              type="number"
              step="any"
              className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0a0f1e] px-2 py-2 text-sm text-[#f9fafb]"
              value={values.Amount}
              onChange={(e) => handleChange('Amount', e.target.value)}
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-[#9ca3af] sm:col-span-1">
            Time
            <input
              type="number"
              step="any"
              className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0a0f1e] px-2 py-2 text-sm text-[#f9fafb]"
              value={values.Time}
              onChange={(e) => handleChange('Time', e.target.value)}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {fieldKeys
            .filter((k) => k !== 'Amount' && k !== 'Time')
            .map((name) => (
              <label
                key={name}
                className="flex flex-col gap-1 text-xs font-medium text-[#9ca3af]"
              >
                {name}
                <input
                  type="number"
                  step="any"
                  className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0a0f1e] px-2 py-1.5 text-sm text-[#f9fafb]"
                  value={values[name]}
                  onChange={(e) => handleChange(name, e.target.value)}
                />
              </label>
            ))}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="!h-4 !w-4" />
              Scoring…
            </span>
          ) : (
            'Run fraud check'
          )}
        </button>
      </form>

      {error ? (
        <p className="mt-4 text-red-400">{error}</p>
      ) : null}

      <AnimatePresence>
        {result ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-8 space-y-6 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827] p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <FraudBadge isFraud={result.is_fraud} />
              <RiskChip level={result.risk_level} />
            </div>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
              <RiskMeter confidence={result.confidence} />
              <div className="w-full max-w-md flex-1">
                <p className="mb-2 text-sm text-[#9ca3af]">Confidence</p>
                <ConfidenceBar confidence={result.confidence} />
              </div>
            </div>
            <div>
              <h2 className="mb-2 text-lg font-semibold text-[#f9fafb]">
                SHAP — top 5
              </h2>
              <ShapChart items={result.shap_values} />
            </div>
            <button
              type="button"
              className="text-sm text-indigo-400"
              onClick={() => setExplainOpen((o) => !o)}
            >
              {explainOpen ? 'Hide' : 'What does this mean?'}
            </button>
            {explainOpen ? (
              <p className="text-sm leading-relaxed text-[#9ca3af]">
                Each bar shows how much a feature pushed the model toward fraud
                (red) or away (green). Higher absolute values matter more for
                this prediction. This is a local explanation — not global
                risk for your business.
              </p>
            ) : null}
            <p className="font-mono text-xs text-[#6b7280]">
              {result.transaction_id} · {result.timestamp}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </PageWrapper>
  )
}
