import { useCallback, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { batchPredict } from '../api/client'
import { TransactionTable } from '../components/tables/TransactionTable'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Spinner } from '../components/ui/Spinner'
import type { BatchResult } from '../types'

const MAX_PREVIEW_ROWS = 2500
const PREVIEW_LINES = 5

type FilterMode = 'all' | 'fraud' | 'legit'

export function BatchUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [rowCount, setRowCount] = useState<number | null>(null)
  const [previewLines, setPreviewLines] = useState<string[][]>([])
  const [result, setResult] = useState<BatchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<FilterMode>('all')

  const onDrop = useCallback(async (accepted: File[]) => {
    const f = accepted[0]
    if (!f) return
    setFile(f)
    setResult(null)
    setError(null)
    const text = await f.text()
    const lines = text.split(/\r?\n/).filter(Boolean)
    setRowCount(Math.max(0, lines.length - 1))
    const header = lines[0]?.split(',') ?? []
    const body = lines.slice(1, 1 + PREVIEW_LINES).map((ln) => ln.split(','))
    setPreviewLines([header, ...body])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  })

  async function submit() {
    if (!file) return
    setError(null)
    setLoading(true)
    try {
      const res = await batchPredict(file)
      setResult(res)
    } catch (e) {
      setResult(null)
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  function downloadCsv() {
    if (!result) return
    const header = [
      'row_index',
      'is_fraud',
      'confidence',
      'Amount',
      'risk_level',
    ]
    const lines = [
      header.join(','),
      ...result.results.map((r) =>
        [r.row_index, r.is_fraud, r.confidence, r.Amount, r.risk_level].join(
          ',',
        ),
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'fraudsense_batch_results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredRows = useMemo(() => {
    if (!result) return []
    let rows = result.results
    if (filter === 'fraud') rows = rows.filter((r) => r.is_fraud)
    if (filter === 'legit') rows = rows.filter((r) => !r.is_fraud)
    return rows.slice(0, MAX_PREVIEW_ROWS)
  }, [result, filter])

  const pieData = useMemo(() => {
    if (!result) return []
    return [
      { name: 'Legit', value: result.legit_count, fill: '#22c55e' },
      { name: 'Fraud', value: result.fraud_count, fill: '#ef4444' },
    ]
  }, [result])

  return (
    <PageWrapper>
      <h1 className="text-2xl font-bold text-[#f9fafb]">Batch upload</h1>
      <p className="mt-1 text-sm text-[#9ca3af]">
        CSV: V1–V28, Amount, Time. Large files use vectorized scoring on the
        server.
      </p>

      <div className="mt-4">
        <a
          href="/sample_transactions.csv"
          download
          className="text-sm text-indigo-400 hover:underline"
        >
          Download sample CSV
        </a>
      </div>

      <div
        {...getRootProps()}
        className={`mt-6 cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-950/30'
            : 'border-[rgba(255,255,255,0.1)] bg-[#111827] hover:border-[rgba(255,255,255,0.2)]'
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-[#f9fafb]">Drag and drop a CSV, or click to select</p>
        {file ? (
          <p className="mt-2 text-sm text-[#9ca3af]">
            {file.name}
            {rowCount !== null ? ` — ${rowCount} rows` : ''}
          </p>
        ) : null}
      </div>

      {previewLines.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0a0f1e] p-3 text-xs">
          <p className="mb-2 text-[#9ca3af]">Preview (first {PREVIEW_LINES} rows)</p>
          <table className="min-w-full">
            <tbody>
              {previewLines.map((row, i) => (
                <tr key={i}>
                  {row.slice(0, 8).map((c, j) => (
                    <td key={j} className="border border-[rgba(255,255,255,0.04)] px-2 py-1">
                      {c}
                    </td>
                  ))}
                  {row.length > 8 ? <td>…</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!file || loading}
          onClick={() => void submit()}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="!h-4 !w-4" />
              Processing…
            </span>
          ) : (
            'Run batch prediction'
          )}
        </button>
        {result ? (
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-lg border border-[rgba(255,255,255,0.06)] px-5 py-2.5 text-sm text-[#f9fafb] hover:bg-[#1f2937]"
          >
            Download results CSV
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 text-red-400">{error}</p>
      ) : null}

      {result ? (
        <div className="mt-8 space-y-6">
          <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#111827] px-4 py-3 text-sm text-[#e5e7eb]">
            <strong className="text-red-400">{result.fraud_count}</strong> fraud of{' '}
            <strong>{result.total}</strong> (
            {(result.fraud_rate * 100).toFixed(2)}%) · Legit{' '}
            {result.legit_count} · Fraud amount{' '}
            {new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency: 'USD',
            }).format(result.total_fraud_amount)}
          </div>

          <div className="flex flex-wrap gap-2">
            {(['all', 'fraud', 'legit'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                  filter === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[#1f2937] text-[#9ca3af]'
                }`}
              >
                {f === 'all' ? 'Show all' : f === 'fraud' ? 'Fraud only' : 'Legit only'}
              </button>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            <div className="md:col-span-3">
              {result.results.length > MAX_PREVIEW_ROWS ? (
                <p className="mb-2 text-sm text-amber-400">
                  Table: first {MAX_PREVIEW_ROWS} of {result.results.length} — CSV has
                  all rows.
                </p>
              ) : null}
              <TransactionTable mode="batch" batchRows={filteredRows} />
            </div>
            <div className="h-48 md:col-span-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                  >
                    {pieData.map((e) => (
                      <Cell key={e.name} fill={e.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}
    </PageWrapper>
  )
}
