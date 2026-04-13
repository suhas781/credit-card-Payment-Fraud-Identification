import { motion } from 'framer-motion'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  delay?: number
}

export function StatCard({ title, value, subtitle, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.3)] sm:p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">
        {title}
      </p>
      <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#f9fafb]">
        {value}
      </p>
      {subtitle ? (
        <p className="mt-1 text-sm text-[#9ca3af]">{subtitle}</p>
      ) : null}
    </motion.div>
  )
}
