import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { explainTransaction, predictTransaction } from '../api/client'
import { ShapChart } from '../components/charts/ShapChart'
import { PageWrapper } from '../components/layout/PageWrapper'
import { FraudBadge } from '../components/ui/FraudBadge'
import { ConfidenceBar } from '../components/ui/ConfidenceBar'
import { RiskMeter } from '../components/ui/RiskMeter'
import { Spinner } from '../components/ui/Spinner'
import { useTransactionForm } from '../hooks/useTransactionForm'
import type { ExplainResult, PredictionResult, RiskLevel } from '../types'

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
  const [deepExplain, setDeepExplain] = useState<ExplainResult | null>(null)
  const [explainLoading, setExplainLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await predictTransaction(toInput())
      setResult(res)
      setDeepExplain(null)
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
            <div className="grid gap-3 text-sm text-[#d1d5db] sm:grid-cols-2">
              <p>
                <span className="text-[#9ca3af]">Predicted class</span>{' '}
                <span className="font-mono font-semibold text-[#f9fafb]">
                  {result.predicted_class ?? (result.is_fraud ? 1 : 0)} (0=legit, 1=fraud)
                </span>
              </p>
              <p>
                <span className="text-[#9ca3af]">Fraud probability</span>{' '}
                <span className="font-mono font-semibold text-[#f9fafb]">
                  {((result.fraud_probability ?? result.confidence) * 100).toFixed(2)}%
                </span>
              </p>
            </div>
            {result.reason_summary ? (
              <p className="rounded-lg border border-indigo-500/20 bg-indigo-950/20 p-3 text-sm text-indigo-200">
                {result.reason_summary}
              </p>
            ) : null}
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
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="text-sm text-indigo-400"
                onClick={() => setExplainOpen((o) => !o)}
              >
                {explainOpen ? 'Hide' : 'What does this mean?'}
              </button>
              <button
                type="button"
                disabled={explainLoading}
                className="text-sm text-indigo-400 disabled:opacity-50"
                onClick={async () => {
                  setExplainLoading(true)
                  try {
                    const ex = await explainTransaction(toInput())
                    setDeepExplain(ex)
                    setExplainOpen(true)
                  } catch {
                    setDeepExplain(null)
                  } finally {
                    setExplainLoading(false)
                  }
                }}
              >
                {explainLoading ? 'Loading…' : 'Deep explain (top 15 SHAP)'}
              </button>
            </div>
            {explainOpen ? (
              <div className="space-y-3 text-sm leading-relaxed text-[#9ca3af]">
                <p>
                  Each bar shows how much a feature pushed the model toward fraud
                  (positive SHAP) or away (negative). Higher absolute values
                  matter more for this prediction — local explanation only.
                </p>
                {deepExplain ? (
                  <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0a0f1e] p-3 font-mono text-xs text-[#d1d5db]">
                    <p className="mb-2 text-[#9ca3af]">
                      E[fraud] baseline ≈{' '}
                      {deepExplain.expected_value_fraud_class.toFixed(4)}
                    </p>
                    <ul className="max-h-40 space-y-1 overflow-y-auto">
                      {deepExplain.top_features.map((f) => (
                        <li key={f.feature}>
                          {f.feature}: {f.shap_value.toFixed(4)} ({f.direction})
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-indigo-200">{deepExplain.reason_summary}</p>
                  </div>
                ) : null}
              </div>
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
