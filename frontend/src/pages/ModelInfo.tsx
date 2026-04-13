import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getModelInfo } from '../api/client'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Spinner } from '../components/ui/Spinner'
import type { ModelInfo } from '../types'

export function ModelInfo() {
  const [data, setData] = useState<ModelInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const m = await getModelInfo()
        if (!cancelled) setData(m)
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <PageWrapper>
        <p className="text-red-400">{error}</p>
      </PageWrapper>
    )
  }

  if (!data) {
    return (
      <PageWrapper>
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      </PageWrapper>
    )
  }

  const chartData = data.top_features.slice(0, 15).map((f) => ({
    name: f.feature,
    imp: f.importance,
  }))

  return (
    <PageWrapper>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#f9fafb]">Model information</h1>
          <p className="mt-1 text-[#9ca3af]">
            {data.model_type} · {data.features_count} features · threshold{' '}
            <span className="font-mono text-indigo-400">
              {data.threshold.toFixed(4)}
            </span>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['AUC-ROC', data.training_metrics.auc_roc],
            ['Avg precision', data.training_metrics.avg_precision],
            ['F1', data.training_metrics.f1_score],
          ].map(([label, v]) => (
            <div
              key={label}
              className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827] p-4"
            >
              <p className="text-xs uppercase text-[#9ca3af]">{label}</p>
              <p className="mt-1 font-mono text-2xl text-[#f9fafb]">
                {Number(v).toFixed(4)}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827] p-4">
          <h2 className="mb-4 font-semibold text-[#f9fafb]">
            Feature importance (top 15)
          </h2>
          <div style={{ height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                />
                <Bar dataKey="imp" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827] p-4 text-sm text-[#9ca3af]">
          <p>
            The decision threshold is tuned on validation data (not fixed at 0.5)
            to balance precision and recall under class imbalance. SHAP values
            explain each prediction locally; global importance above reflects
            average gain from XGBoost.
          </p>
          <p className="mt-3">
            Dataset: {data.dataset_info.total_samples.toLocaleString()} samples,{' '}
            {data.dataset_info.fraud_samples} fraud (
            {(data.dataset_info.fraud_rate * 100).toFixed(3)}%).
          </p>
        </div>
      </motion.div>
    </PageWrapper>
  )
}
