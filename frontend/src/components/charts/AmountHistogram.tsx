import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface AmountHistogramProps {
  amountRanges: Record<string, number>
}

export function AmountHistogram({ amountRanges }: AmountHistogramProps) {
  const chartData = Object.entries(amountRanges).map(([name, count]) => ({
    name,
    count,
  }))

  return (
    <div className="w-full min-w-0" style={{ minHeight: 260 }}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData}>
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#111827',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          />
          <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
