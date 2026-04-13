import { NavLink } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  Brain,
  CreditCard,
  History,
  LayoutDashboard,
  Radio,
  Upload,
} from 'lucide-react'

const link =
  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#9ca3af] transition-colors hover:bg-[#1f2937] hover:text-[#f9fafb]'

const active =
  'bg-[#6366f1]/15 text-[#f9fafb] shadow-[0_0_20px_rgba(99,102,241,0.15)]'

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-[rgba(255,255,255,0.06)] bg-[#0a0f1e] py-6 md:flex">
      <div className="mb-8 flex items-center gap-2 px-4">
        <Activity className="h-8 w-8 text-indigo-500" />
        <span className="text-lg font-bold tracking-tight text-[#f9fafb]">
          FraudSense
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-2">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `${link} ${isActive ? active : ''}`}
        >
          <LayoutDashboard className="h-5 w-5 shrink-0" />
          Dashboard
        </NavLink>
        <NavLink
          to="/live"
          className={({ isActive }) => `${link} ${isActive ? active : ''}`}
        >
          <Radio className="h-5 w-5 shrink-0" />
          Live Monitor
        </NavLink>
        <NavLink
          to="/check"
          className={({ isActive }) => `${link} ${isActive ? active : ''}`}
        >
          <CreditCard className="h-5 w-5 shrink-0" />
          Check Transaction
        </NavLink>
        <NavLink
          to="/batch"
          className={({ isActive }) => `${link} ${isActive ? active : ''}`}
        >
          <Upload className="h-5 w-5 shrink-0" />
          Batch Upload
        </NavLink>
        <NavLink
          to="/history"
          className={({ isActive }) => `${link} ${isActive ? active : ''}`}
        >
          <History className="h-5 w-5 shrink-0" />
          History
        </NavLink>
        <NavLink
          to="/model"
          className={({ isActive }) => `${link} ${isActive ? active : ''}`}
        >
          <Brain className="h-5 w-5 shrink-0" />
          Model Info
        </NavLink>
      </nav>
      <div className="mt-auto px-4 pt-4 text-xs text-[#6b7280]">
        <BarChart3 className="mb-1 inline h-4 w-4" /> XGBoost + SHAP
      </div>
    </aside>
  )
}
