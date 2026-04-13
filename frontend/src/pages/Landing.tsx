import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Shield, Zap } from 'lucide-react'

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0f1e]">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(rgba(99,102,241,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.08) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="mb-6 flex justify-center">
            <Shield className="h-16 w-16 text-indigo-500" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-[#f9fafb] sm:text-6xl">
            Detect Fraud.{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              In Real Time.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[#9ca3af]">
            XGBoost-powered fraud detection with SHAP explainability, live
            monitoring, and batch analytics — built for production.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3 font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.15)] transition hover:bg-indigo-500"
            >
              Open Dashboard
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/live"
              className="inline-flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827] px-8 py-3 font-semibold text-[#f9fafb] transition hover:bg-[#1f2937]"
            >
              <Zap className="h-5 w-5 text-amber-400" />
              Try Live Demo
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-24 grid gap-6 sm:grid-cols-3"
        >
          {[
            {
              title: 'Real-Time Detection',
              body: 'WebSocket stream scoring sampled transactions with SHAP.',
            },
            {
              title: 'SHAP Explainability',
              body: 'Top features driving each fraud score, transparently.',
            },
            {
              title: 'Batch Processing',
              body: 'Vectorized scoring for large CSVs with risk tiers.',
            },
          ].map((f, i) => (
            <div
              key={f.title}
              className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
            >
              <h3 className="font-semibold text-[#f9fafb]">{f.title}</h3>
              <p className="mt-2 text-sm text-[#9ca3af]">{f.body}</p>
              <motion.div
                className="mt-4 h-1 rounded-full bg-gradient-to-r from-indigo-500/50 to-transparent"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
