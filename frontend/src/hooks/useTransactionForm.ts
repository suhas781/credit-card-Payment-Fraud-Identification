import { useCallback, useState } from 'react'
import type { TransactionInput } from '../types'

const KEYS = [
  ...Array.from({ length: 28 }, (_, i) => `V${i + 1}`),
  'Amount',
  'Time',
] as const

function empty(): Record<string, string> {
  return Object.fromEntries(KEYS.map((k) => [k, '0'])) as Record<string, string>
}

export function useTransactionForm() {
  const [values, setValues] = useState<Record<string, string>>(empty)

  const handleChange = useCallback((name: string, value: string) => {
    setValues((v) => ({ ...v, [name]: value }))
  }, [])

  const toInput = useCallback((): TransactionInput => {
    const o = {} as TransactionInput
    for (const k of KEYS) {
      const v = parseFloat(values[k])
      o[k as keyof TransactionInput] = Number.isFinite(v) ? v : 0
    }
    return o
  }, [values])

  const prefill = useCallback((obj: Partial<Record<string, number>>) => {
    setValues((prev) => {
      const next = { ...prev }
      for (const k of KEYS) {
        if (obj[k] !== undefined) next[k] = String(obj[k])
      }
      return next
    })
  }, [])

  const prefillFraud = useCallback(() => {
    void fetch('/sample_fraud.json')
      .then((r) => r.json())
      .then((j: Record<string, number>) => prefill(j))
      .catch(() => {})
  }, [prefill])

  const prefillLegit = useCallback(() => {
    void fetch('/sample_legit.json')
      .then((r) => r.json())
      .then((j: Record<string, number>) => prefill(j))
      .catch(() => {})
  }, [prefill])

  const clearAll = useCallback(() => setValues(empty()), [])

  return {
    values,
    handleChange,
    toInput,
    prefillFraud,
    prefillLegit,
    clearAll,
    fieldKeys: KEYS,
  }
}
