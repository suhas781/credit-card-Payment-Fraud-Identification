import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { BatchUpload } from './pages/BatchUpload'
import { CheckTransaction } from './pages/CheckTransaction'
import { Dashboard } from './pages/Dashboard'
import { History } from './pages/History'
import { Landing } from './pages/Landing'
import { LiveMonitor } from './pages/LiveMonitor'
import { ModelInfo } from './pages/ModelInfo'

function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#0a0f1e]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-[#0a0f1e] px-4 py-3 md:hidden">
          <span className="font-bold text-[#f9fafb]">FraudSense</span>
          <button
            type="button"
            aria-label="Menu"
            className="rounded-lg p-2 text-[#f9fafb]"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </header>
        {open ? (
          <nav className="flex flex-col gap-1 border-b border-[rgba(255,255,255,0.06)] bg-[#111827] px-4 py-3 md:hidden">
            <Link to="/dashboard" className="py-2 text-[#f9fafb]" onClick={() => setOpen(false)}>
              Dashboard
            </Link>
            <Link to="/live" className="py-2 text-[#f9fafb]" onClick={() => setOpen(false)}>
              Live
            </Link>
            <Link to="/check" className="py-2 text-[#f9fafb]" onClick={() => setOpen(false)}>
              Check
            </Link>
            <Link to="/batch" className="py-2 text-[#f9fafb]" onClick={() => setOpen(false)}>
              Batch
            </Link>
            <Link to="/history" className="py-2 text-[#f9fafb]" onClick={() => setOpen(false)}>
              History
            </Link>
            <Link to="/model" className="py-2 text-[#f9fafb]" onClick={() => setOpen(false)}>
              Model
            </Link>
          </nav>
        ) : null}
        <main className="flex-1 overflow-auto px-4 py-8">{children}</main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/dashboard"
        element={
          <AppShell>
            <Dashboard />
          </AppShell>
        }
      />
      <Route
        path="/live"
        element={
          <AppShell>
            <LiveMonitor />
          </AppShell>
        }
      />
      <Route
        path="/check"
        element={
          <AppShell>
            <CheckTransaction />
          </AppShell>
        }
      />
      <Route
        path="/batch"
        element={
          <AppShell>
            <BatchUpload />
          </AppShell>
        }
      />
      <Route
        path="/history"
        element={
          <AppShell>
            <History />
          </AppShell>
        }
      />
      <Route
        path="/model"
        element={
          <AppShell>
            <ModelInfo />
          </AppShell>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
