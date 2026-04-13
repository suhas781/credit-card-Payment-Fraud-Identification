import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { FraudOverTimePoint } from '../../types'

interface FraudLineChartProps {
  data: FraudOverTimePoint[]
}

export function FraudLineChart({ data }: FraudLineChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: d.hour.slice(-5),
  }))

  return (
    <div className="w-full min-w-0" style={{ minHeight: 288 }}>
      <ResponsiveContainer width="100%" height={288}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
            }}
            labelFormatter={(_label, payload) =>
              (payload?.[0]?.payload as { hour?: string })?.hour ?? ''
            }
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="count"
            name="Fraud count"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
