import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HourOfDayPoint } from '../../types'

interface HourlyHeatmapProps {
  data: HourOfDayPoint[]
}

export function HourlyHeatmap({ data }: HourlyHeatmapProps) {
  const chartData = data.map((d) => ({
    h: `${d.hour}:00`,
    count: d.count,
  }))

  return (
    <div className="w-full min-w-0" style={{ minHeight: 260 }}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData}>
          <XAxis dataKey="h" tick={{ fill: '#9ca3af', fontSize: 9 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#111827',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          />
          <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
