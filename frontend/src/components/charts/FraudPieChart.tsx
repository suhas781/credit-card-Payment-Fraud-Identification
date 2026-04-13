import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

interface FraudPieChartProps {
  fraudCount: number
  legitCount: number
}

const COLORS = { fraud: '#ef4444', legit: '#22c55e' }

export function FraudPieChart({ fraudCount, legitCount }: FraudPieChartProps) {
  const data = [
    { name: 'Legitimate', value: legitCount, fill: COLORS.legit },
    { name: 'Fraud', value: fraudCount, fill: COLORS.fraud },
  ]

  if (fraudCount + legitCount === 0) {
    return (
      <p className="py-12 text-center text-sm text-slate-500">No data yet</p>
    )
  }

  return (
    <div className="mx-auto w-full max-w-sm min-w-0" style={{ height: 288 }}>
      <ResponsiveContainer width="100%" height={288}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            label
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#111827',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
