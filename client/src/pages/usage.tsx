import { useEffect, useState } from "react"
import { usageApi } from '@/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useWorkspace } from "@/components/workspace/workspace-context"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  Activity,
  TrendingUp,
  Database,
  Store,
  Package,
  Zap,
  Calendar,
  BarChart3,
  PieChart,
  Target
} from "lucide-react"
import { getCurrentUser } from "@/lib/auth"
import { getAuthHeaders } from "@/lib/utils"

interface UsageData {
  currentPeriod: {
    apiCalls: number
    productsSync: number
    storesConnected: number
    storageUsed: number
    features: {
      aiSuggestions: number
      opportunityScans: number
      bulkOperations: number
    }
  }
  limits: {
    maxStores: number
    maxProducts: number
    maxMarketplaces: number
    apiCallsPerMonth: number
  }
  trends: {
    apiCallsGrowth: number
    productsSyncGrowth: number
    storageGrowth: number
  }
  history: Array<{
    date: string
    apiCalls: number
    productsSync: number
    storageUsed: number
  }>
}

export function Usage() {
  const { currentWorkspace } = useWorkspace()
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const user = getCurrentUser()

  useEffect(() => {
    // Only load if we have a current workspace
    if (currentWorkspace) {
      loadUsageData()
    }
  }, [currentWorkspace])

  const loadUsageData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch real usage data from backend using centralized API
      const [currentData, trendsData, historyData] = await Promise.all([
        usageApi.getCurrentUsage(),
        usageApi.getUsageTrends(),
        usageApi.getUsageHistory(7)
      ])

      const usageData: UsageData = {
        currentPeriod: {
          month: new Date().toISOString().substring(0, 7), // Current month
          apiCalls: currentData.apiCalls || 0,
          productSyncs: currentData.productSyncs || 0,
          storesConnected: currentData.storeConnections || 0,
          totalProducts: 0, // May need to be added to API
          features: {
            aiSuggestions: 0,
            opportunityScans: 0,
            bulkOperations: 0
          }
        },
        limits: currentData.limit || {
          apiCalls: 1000,
          productSyncs: 100,
          storeConnections: 1
        },
        trends: trendsData || [],
        history: historyData || []
      }
      
      setUsageData(usageData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage data')
    } finally {
      setLoading(false)
    }
  }

  const generateMockHistory = () => {
    const history = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      history.push({
        date: date.toISOString().split('T')[0],
        apiCalls: Math.floor(Math.random() * 1000) + 200,
        productsSync: Math.floor(Math.random() * 20) + 5,
        storageUsed: Math.floor(Math.random() * 50) + 10
      })
    }
    return history
  }

  const getUsagePercentage = (current: number, max: number) => {
    return Math.min((current / max) * 100, 100)
  }

  const getProgressVariant = (percentage: number) => {
    if (percentage >= 90) return "destructive"
    if (percentage >= 75) return "warning"
    return "default"
  }

  const getTrendIcon = (growth: number) => {
    if (growth > 0) return <TrendingUp className="w-4 h-4 text-green-600" />
    if (growth < 0) return <TrendingUp className="w-4 h-4 text-red-600 rotate-180" />
    return <Activity className="w-4 h-4 text-gray-600" />
  }

  const formatTrend = (growth: number) => {
    const sign = growth > 0 ? '+' : ''
    return `${sign}${growth}%`
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Usage Dashboard</h1>
          <p className="text-muted-foreground">Monitor your platform usage and performance</p>
        </div>
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading usage data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Usage Dashboard</h1>
          <p className="text-muted-foreground">Monitor your platform usage and performance</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-destructive">
              <Activity className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to Load Usage Data</h3>
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Usage Dashboard</h1>
        <p className="text-muted-foreground">Monitor your platform usage and performance</p>
      </div>

      {usageData && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* API Calls */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">API Calls</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {usageData.currentPeriod.apiCalls.toLocaleString()}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {getTrendIcon(usageData.trends.apiCallsGrowth)}
                  <p className="text-xs text-muted-foreground">
                    {formatTrend(usageData.trends.apiCallsGrowth)} from last month
                  </p>
                </div>
                <div className="mt-3">
                  <Progress 
                    value={getUsagePercentage(usageData.currentPeriod.apiCalls, usageData.limits.apiCallsPerMonth)}
                    variant={getProgressVariant(getUsagePercentage(usageData.currentPeriod.apiCalls, usageData.limits.apiCallsPerMonth))}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {usageData.limits.apiCallsPerMonth.toLocaleString()} monthly limit
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Products Synced */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Products Synced</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {usageData.currentPeriod.productsSync.toLocaleString()}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {getTrendIcon(usageData.trends.productsSyncGrowth)}
                  <p className="text-xs text-muted-foreground">
                    {formatTrend(usageData.trends.productsSyncGrowth)} from last month
                  </p>
                </div>
                <div className="mt-3">
                  <Progress 
                    value={getUsagePercentage(usageData.currentPeriod.productsSync, usageData.limits.maxProducts)}
                    variant={getProgressVariant(getUsagePercentage(usageData.currentPeriod.productsSync, usageData.limits.maxProducts))}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {usageData.limits.maxProducts.toLocaleString()} product limit
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Connected Stores */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Connected Stores</CardTitle>
                <Store className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {usageData.currentPeriod.storesConnected}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    Active
                  </Badge>
                </div>
                <div className="mt-3">
                  <Progress 
                    value={getUsagePercentage(usageData.currentPeriod.storesConnected, usageData.limits.maxStores)}
                    variant={getProgressVariant(getUsagePercentage(usageData.currentPeriod.storesConnected, usageData.limits.maxStores))}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {usageData.limits.maxStores} store limit
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Storage Used */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {usageData.currentPeriod.storageUsed} MB
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {getTrendIcon(usageData.trends.storageGrowth)}
                  <p className="text-xs text-muted-foreground">
                    {formatTrend(usageData.trends.storageGrowth)} from last month
                  </p>
                </div>
                <div className="mt-3">
                  <Progress 
                    value={usageData.currentPeriod.storageUsed}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    1 GB limit
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Feature Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                Feature Usage
              </CardTitle>
              <CardDescription>Advanced features utilization this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {usageData.currentPeriod.features.aiSuggestions}
                  </div>
                  <div className="text-sm font-medium mb-1">AI Suggestions</div>
                  <div className="text-xs text-muted-foreground">Smart recommendations</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {usageData.currentPeriod.features.opportunityScans}
                  </div>
                  <div className="text-sm font-medium mb-1">Opportunity Scans</div>
                  <div className="text-xs text-muted-foreground">Market analysis</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {usageData.currentPeriod.features.bulkOperations}
                  </div>
                  <div className="text-sm font-medium mb-1">Bulk Operations</div>
                  <div className="text-xs text-muted-foreground">Mass actions</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                Usage History
              </CardTitle>
              <CardDescription>Last 7 days activity overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {usageData.history.map((day, index) => (
                  <div key={day.date} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {new Date(day.date).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {index === usageData.history.length - 1 ? 'Today' : `${usageData.history.length - 1 - index} days ago`}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="font-semibold text-blue-600">{day.apiCalls}</div>
                        <div className="text-xs text-muted-foreground">API calls</div>
                      </div>
                      <div>
                        <div className="font-semibold text-green-600">{day.productsSync}</div>
                        <div className="text-xs text-muted-foreground">Products</div>
                      </div>
                      <div>
                        <div className="font-semibold text-purple-600">{day.storageUsed} MB</div>
                        <div className="text-xs text-muted-foreground">Storage</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}