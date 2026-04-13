import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pause, Play, Radio } from 'lucide-react'
import { setSimulationActive } from '../api/client'
import { ShapChart } from '../components/charts/ShapChart'
import { PageWrapper } from '../components/layout/PageWrapper'
import { RiskMeter } from '../components/ui/RiskMeter'
import { Spinner } from '../components/ui/Spinner'
import { useWebSocket } from '../hooks/useWebSocket'
import { useLiveStore } from '../store/useLiveStore'
import type { LiveTransaction } from '../types'

const riskBadge = (r: string) => {
  const c =
    r === 'CRITICAL'
      ? 'bg-red-950 text-red-400 ring-2 ring-red-500/50'
      : r === 'HIGH'
        ? 'bg-orange-950 text-orange-400'
        : r === 'MEDIUM'
          ? 'bg-amber-950 text-amber-400'
          : 'bg-emerald-950 text-emerald-400'
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>
      {r}
    </span>
  )
}

export function LiveMonitor() {
  const { isConnected, lastMessage } = useWebSocket<LiveTransaction>(true)
  const {
    transactions,
    totalCount,
    fraudCount,
    lastFraud,
    isRunning,
    setRunning,
    addTransaction,
    reset,
  } = useLiveStore()

  useEffect(() => {
    if (!lastMessage?.transaction_id) return
    addTransaction(lastMessage)
  }, [lastMessage, addTransaction])

  async function toggle() {
    const next = !isRunning
    setRunning(next)
    try {
      await setSimulationActive(next)
    } catch {
      setRunning(!next)
    }
  }

  return (
    <PageWrapper>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#f9fafb]">
            Live Monitor
          </h1>
          <p className="mt-1 text-sm text-[#9ca3af]">
            WebSocket stream — enable simulation on the server, then watch
            transactions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-sm text-[#9ca3af]">
            <span
              className={`h-2 w-2 rounded-full ${isConnected ? 'animate-pulse bg-emerald-500' : 'bg-red-500'}`}
            />
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          <button
            type="button"
            onClick={() => void toggle()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            {isRunning ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isRunning ? 'Pause' : 'Start'} simulation
          </button>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg border border-[rgba(255,255,255,0.06)] px-3 py-2 text-sm text-[#9ca3af] hover:bg-[#1f2937]"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-6 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-indigo-400" />
          <span className="font-mono text-[#f9fafb]">
            {totalCount} txs
          </span>
          <span className="text-[#9ca3af]">|</span>
          <span className="font-mono text-red-400">{fraudCount} fraud</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#9ca3af]">
            Live feed
          </h2>
          <div className="max-h-[520px] space-y-2 overflow-y-auto rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827] p-3">
            <AnimatePresence initial={false}>
              {transactions.length === 0 ? (
                <p className="py-12 text-center text-sm text-[#6b7280]">
                  Start simulation and wait for events…
                </p>
              ) : (
                transactions.map((t) => (
                  <motion.div
                    key={t.transaction_id + t.timestamp}
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                      t.is_fraud
                        ? 'border-red-500/40 bg-red-950/40 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                        : 'border-emerald-500/20 bg-[#0a0f1e]'
                    }`}
                  >
                    <span className="font-mono text-xs text-[#9ca3af]">
                      {new Date(t.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="font-mono text-[#f9fafb]">
                      ${t.Amount.toFixed(2)}
                    </span>
                    <span className="text-[#9ca3af]">
                      {(t.confidence * 100).toFixed(1)}%
                    </span>
                    {riskBadge(t.risk_level)}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827] p-4">
            <h3 className="text-sm font-semibold text-[#9ca3af]">
              Last fraud — SHAP
            </h3>
            {!lastFraud ? (
              <p className="mt-4 text-sm text-[#6b7280]">No fraud yet.</p>
            ) : (
              <ShapChart items={lastFraud.shap_values} />
            )}
          </div>
          <div className="flex flex-col items-center rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827] p-4">
            <h3 className="mb-2 text-sm font-semibold text-[#9ca3af]">
              Confidence
            </h3>
            {lastFraud ? (
              <RiskMeter confidence={lastFraud.confidence} />
            ) : (
              <Spinner />
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
