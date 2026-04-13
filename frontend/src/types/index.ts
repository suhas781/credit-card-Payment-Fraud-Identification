export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface TransactionInput {
  V1: number
  V2: number
  V3: number
  V4: number
  V5: number
  V6: number
  V7: number
  V8: number
  V9: number
  V10: number
  V11: number
  V12: number
  V13: number
  V14: number
  V15: number
  V16: number
  V17: number
  V18: number
  V19: number
  V20: number
  V21: number
  V22: number
  V23: number
  V24: number
  V25: number
  V26: number
  V27: number
  V28: number
  Amount: number
  Time: number
}

export interface ShapValue {
  feature: string
  value: number
  direction: 'fraud' | 'legit'
}

export interface PredictionResult {
  is_fraud: boolean
  predicted_class: 0 | 1
  fraud_probability: number
  confidence: number
  threshold_used: number
  risk_level: RiskLevel
  shap_values: ShapValue[]
  reason_codes: string[]
  reason_summary: string
  transaction_id: string
  timestamp: string
}

export interface LiveTransaction {
  transaction_id: string
  is_fraud: boolean
  confidence: number
  risk_level: RiskLevel
  Amount: number
  shap_values: ShapValue[]
  timestamp: string
}

export interface RecentTransactionRow {
  transaction_id: string
  is_fraud: boolean
  confidence: number
  Amount: number
  timestamp: string
  risk_level?: RiskLevel | null
}

export interface FraudOverTimePoint {
  hour: string
  count: number
}

export interface HourOfDayPoint {
  hour: number
  count: number
}

export interface StatsResponse {
  total_transactions: number
  fraud_count: number
  legit_count: number
  fraud_rate: number
  total_fraud_amount: number
  avg_confidence_fraud: number
  avg_confidence_legit: number
  recent_transactions: RecentTransactionRow[]
  fraud_over_time: FraudOverTimePoint[]
  fraud_by_hour_of_day: HourOfDayPoint[]
  fraud_by_risk_level: Record<RiskLevel, number>
  amount_ranges: Record<string, number>
}

export interface BatchResultRow {
  row_index: number
  is_fraud: boolean
  confidence: number
  Amount: number
  risk_level: RiskLevel
}

export interface BatchResult {
  total: number
  fraud_count: number
  legit_count: number
  fraud_rate: number
  total_fraud_amount: number
  results: BatchResultRow[]
}

export interface HistoryTransaction {
  transaction_id: string
  is_fraud: boolean
  confidence: number
  Amount: number
  timestamp: string
  risk_level?: RiskLevel | null
  shap_top5: { feature: string; value: number; direction?: string }[]
}

export interface HistoryResponse {
  transactions: HistoryTransaction[]
  total: number
  page: number
  pages: number
}

export interface ModelInfo {
  model_type: string
  features_count: number
  threshold: number
  training_metrics: { auc_roc: number; avg_precision: number; f1_score: number }
  top_features: { feature: string; importance: number }[]
  dataset_info: {
    total_samples: number
    fraud_samples: number
    fraud_rate: number
  }
}

export interface HealthResponse {
  status: string
  model_loaded: boolean
  db_connected: boolean
  uptime_seconds: number
}

export interface ExplainFeature {
  feature: string
  shap_value: number
  direction: 'fraud' | 'legit'
}

export interface ExplainResult {
  expected_value_fraud_class: number
  top_features: ExplainFeature[]
  reason_codes: string[]
  reason_summary: string
}
