import { motion } from 'framer-motion'
import { AmountHistogram } from '../components/charts/AmountHistogram'
import { FraudLineChart } from '../components/charts/FraudLineChart'
import { FraudPieChart } from '../components/charts/FraudPieChart'
import { HourlyHeatmap } from '../components/charts/HourlyHeatmap'
import { StatCard } from '../components/cards/StatCard'
import { PageWrapper } from '../components/layout/PageWrapper'
import { TransactionTable } from '../components/tables/TransactionTable'
import { Spinner } from '../components/ui/Spinner'
import { useStats } from '../hooks/useStats'

export function Dashboard() {
  const { data, loading, error } = useStats()

  if (loading && !data) {
    return (
      <PageWrapper>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner />
        </div>
      </PageWrapper>
    )
  }

  if (error && !data) {
    return (
      <PageWrapper>
        <p className="text-amber-400">{error}</p>
      </PageWrapper>
    )
  }

  if (!data) return null

  const fmtPct = (x: number) => `${(x * 100).toFixed(2)}%`
  const fmtMoney = (x: number) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(x)

  const hod = data.fraud_by_hour_of_day?.length
    ? data.fraud_by_hour_of_day
    : Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }))

  const amounts = data.amount_ranges ?? {
    '0-100': 0,
    '100-500': 0,
    '500-1000': 0,
    '1000+': 0,
  }

  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[#f9fafb]">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-[#9ca3af]">
          Refreshes every 30s · fraud analytics overview
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total transactions"
          value={data.total_transactions.toLocaleString()}
          delay={0}
        />
        <StatCard
          title="Fraud detected"
          value={data.fraud_count.toLocaleString()}
          delay={0.05}
        />
        <StatCard
          title="Fraud rate"
          value={fmtPct(data.fraud_rate)}
          delay={0.1}
        />
        <StatCard
          title="Total fraud amount"
          value={fmtMoney(data.total_fraud_amount)}
          delay={0.15}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827] p-4 lg:col-span-7"
        >
          <h2 className="mb-3 text-sm font-semibold text-[#9ca3af]">
            Fraud by hour (last 24h)
          </h2>
          <FraudLineChart data={data.fraud_over_time} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827] p-4 lg:col-span-3"
        >
          <h2 className="mb-3 text-sm font-semibold text-[#9ca3af]">
            Fraud vs legit
          </h2>
          <FraudPieChart
            fraudCount={data.fraud_count}
            legitCount={data.legit_count}
          />
        </motion.div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827] p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#9ca3af]">
            Fraud by hour of day
          </h2>
          <HourlyHeatmap data={hod} />
        </div>
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827] p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#9ca3af]">
            Fraud by amount (USD)
          </h2>
          <AmountHistogram amountRanges={amounts} />
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#9ca3af]">
          Recent transactions
        </h2>
        <TransactionTable
          mode="recent"
          recentRows={data.recent_transactions.slice(0, 10)}
        />
      </div>
    </PageWrapper>
  )
}
