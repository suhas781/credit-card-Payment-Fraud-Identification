import axios from 'axios'
import type {
  BatchResult,
  HealthResponse,
  HistoryResponse,
  ModelInfo,
  PredictionResult,
  StatsResponse,
  TransactionInput,
} from '../types'

function apiBaseUrl(): string {
  const u = import.meta.env.VITE_API_URL
  if (u == null || u === '') {
    throw new Error(
      'VITE_API_URL is not set. Add it to frontend/.env (e.g. http://localhost:8000).',
    )
  }
  return String(u).replace(/\/$/, '')
}

export function wsBaseUrl(): string {
  const u = import.meta.env.VITE_WS_URL
  if (u == null || u === '') {
    const http = apiBaseUrl()
    if (http.startsWith('https')) return http.replace(/^https/, 'wss') + '/ws/simulate'
    return http.replace(/^http/, 'ws') + '/ws/simulate'
  }
  const base = String(u).replace(/\/$/, '')
  return base.includes('/ws/simulate') ? base : `${base}/ws/simulate`
}

export const api = axios.create({
  baseURL: apiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
})

export async function predictTransaction(
  body: TransactionInput,
): Promise<PredictionResult> {
  const { data } = await api.post<PredictionResult>('/predict', body)
  return data
}

export async function batchPredict(file: File): Promise<BatchResult> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<BatchResult>('/batch-predict', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 1_800_000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  })
  return data
}

export async function getStats(): Promise<StatsResponse> {
  const { data } = await api.get<StatsResponse>('/stats')
  return data
}

export async function getHistory(params: {
  page?: number
  limit?: number
  is_fraud?: boolean
  risk_level?: string
  min_amount?: number
  max_amount?: number
  date_from?: string
  date_to?: string
}): Promise<HistoryResponse> {
  const { data } = await api.get<HistoryResponse>('/history', { params })
  return data
}

export async function getModelInfo(): Promise<ModelInfo> {
  const { data } = await api.get<ModelInfo>('/model-info')
  return data
}

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/health')
  return data
}

export async function setSimulationActive(active: boolean): Promise<{ active: boolean }> {
  const { data } = await api.post<{ active: boolean }>('/simulate/toggle', { active })
  return data
}
