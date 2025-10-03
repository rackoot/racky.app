// Usage types
export interface UsageData {
  period: string
  apiCalls: number
  productSyncs: number
  storeConnections: number
  limit: {
    apiCalls: number
    productSyncs: number
    storeConnections: number
  }
}

export interface UsageTrend {
  date: string
  apiCalls: number
  productSyncs: number
}
