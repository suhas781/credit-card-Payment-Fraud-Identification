import { create } from 'zustand'
import type { LiveTransaction } from '../types'

const MAX = 100

interface LiveState {
  transactions: LiveTransaction[]
  isRunning: boolean
  totalCount: number
  fraudCount: number
  lastFraud: LiveTransaction | null
  addTransaction: (t: LiveTransaction) => void
  setRunning: (v: boolean) => void
  reset: () => void
}

export const useLiveStore = create<LiveState>((set) => ({
  transactions: [],
  isRunning: false,
  totalCount: 0,
  fraudCount: 0,
  lastFraud: null,
  addTransaction: (t) =>
    set((s) => {
      const next = [t, ...s.transactions].slice(0, MAX)
      const fraudCount = t.is_fraud ? s.fraudCount + 1 : s.fraudCount
      return {
        transactions: next,
        totalCount: s.totalCount + 1,
        fraudCount,
        lastFraud: t.is_fraud ? t : s.lastFraud,
      }
    }),
  setRunning: (v) => set({ isRunning: v }),
  reset: () =>
    set({
      transactions: [],
      totalCount: 0,
      fraudCount: 0,
      lastFraud: null,
    }),
}))
