import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ShapValue } from '../../types'

interface ShapChartProps {
  items: ShapValue[]
}

export function ShapChart({ items }: ShapChartProps) {
  const data = items.map((d) => ({
    feature: d.feature,
    value: d.value,
    fraudPush: d.direction === 'fraud',
  }))

  return (
    <div className="w-full min-w-0" style={{ minHeight: 288 }}>
      <ResponsiveContainer width="100%" height={288}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="feature"
            width={100}
            tick={{ fill: '#9ca3af', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#111827',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8,
            }}
            labelStyle={{ color: '#f9fafb' }}
            formatter={(v) => [
              typeof v === 'number' ? v.toFixed(4) : String(v),
              'SHAP',
            ]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.feature}
                fill={entry.fraudPush ? '#ef4444' : '#22c55e'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
