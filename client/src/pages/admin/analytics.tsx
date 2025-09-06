import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  Users, 
  Building, 
  CreditCard, 
  Store, 
  Package, 
  TrendingUp,
  Calendar,
  DollarSign,
  UserCheck,
  Building2,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Gauge,
  BarChart3
} from "lucide-react"
import { getAuthHeaders } from "@/lib/utils"

interface AnalyticsData {
  period: string
  overview: {
    totalUsers: number
    activeUsers: number
    superAdmins: number
    totalWorkspaces: number
    activeWorkspaces: number
    avgWorkspacesPerUser: number
    totalSubscriptions: number
    activeSubscriptions: number
    totalRevenue: number
    workspacesWithSubscriptions: number
    workspacesWithoutSubscriptions: number
    totalStoreConnections: number
    activeStoreConnections: number
    totalProducts: number
    syncedProducts: number
  }
  userGrowth: Array<{
    _id: { year: number, month: number, day: number }
    newUsers: number
  }>
  subscriptionBreakdown: Array<{
    _id: string
    count: number
  }>
  totalUsage: {
    totalApiCalls: number
    totalProductsSync: number
    totalStorageUsed: number
    totalUsers: number
  }
  generatedAt: string
}

interface AnalyticsResponse {
  success: boolean
  data: AnalyticsData
}

export function AdminAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState("30d")

  useEffect(() => {
    loadAnalytics()
  }, [period])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`http://localhost:5000/api/admin/analytics?period=${period}`, {
        headers: getAuthHeaders()
      })

      console.log('Analytics response status:', response.status)

      if (response.ok) {
        const data: AnalyticsResponse = await response.json()
        console.log('Analytics data:', data)
        if (data.success) {
          setAnalytics(data.data)
        } else {
          throw new Error('Failed to load analytics')
        }
      } else {
        const errorText = await response.text()
        console.error('Analytics error response:', errorText)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      console.error('Error loading analytics:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100) // Convert from cents
  }

  const formatPercentage = (value: number, total: number) => {
    if (total === 0) return '0%'
    return `${Math.round((value / total) * 100)}%`
  }

  const getHealthStatus = (value: number, total: number, threshold: number = 0.8) => {
    const percentage = total > 0 ? value / total : 0
    if (percentage >= threshold) return { status: 'healthy', color: 'text-green-600' }
    if (percentage >= 0.5) return { status: 'warning', color: 'text-yellow-600' }
    return { status: 'critical', color: 'text-red-600' }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Platform Analytics</h1>
          <p className="text-muted-foreground">Comprehensive platform metrics and insights</p>
        </div>
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Platform Analytics</h1>
          <p className="text-muted-foreground">Comprehensive platform metrics and insights</p>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No analytics data available</h3>
            <p className="text-muted-foreground mb-4">{error || 'Unable to load analytics data'}</p>
            <Button onClick={loadAnalytics}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const userHealthStatus = getHealthStatus(analytics.overview.activeUsers, analytics.overview.totalUsers)
  const workspaceHealthStatus = getHealthStatus(analytics.overview.activeWorkspaces, analytics.overview.totalWorkspaces)
  const subscriptionHealthStatus = getHealthStatus(analytics.overview.activeSubscriptions, analytics.overview.totalSubscriptions)
  const productSyncStatus = getHealthStatus(analytics.overview.syncedProducts, analytics.overview.totalProducts)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Platform Analytics</h1>
          <p className="text-muted-foreground">Comprehensive platform metrics and insights</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadAnalytics}>
            <Activity className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.totalUsers}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={userHealthStatus.color}>
                {analytics.overview.activeUsers} active
              </span>
              <span>•</span>
              <span>{analytics.overview.superAdmins} admins</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workspaces</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.totalWorkspaces}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={workspaceHealthStatus.color}>
                {analytics.overview.activeWorkspaces} active
              </span>
              <span>•</span>
              <span>{analytics.overview.avgWorkspacesPerUser} avg/user</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.totalSubscriptions}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={subscriptionHealthStatus.color}>
                {analytics.overview.activeSubscriptions} active
              </span>
              <span>•</span>
              <span>{formatCurrency(analytics.overview.totalRevenue)} revenue</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Store Connections</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.totalStoreConnections}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-green-600">
                {analytics.overview.activeStoreConnections} active
              </span>
              <span>•</span>
              <span>{formatPercentage(analytics.overview.activeStoreConnections, analytics.overview.totalStoreConnections)} rate</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.totalProducts}</div>
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className={`w-3 h-3 ${productSyncStatus.color}`} />
              <span className={productSyncStatus.color}>
                {analytics.overview.syncedProducts} synced
              </span>
              <span className="text-muted-foreground">
                ({formatPercentage(analytics.overview.syncedProducts, analytics.overview.totalProducts)})
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workspace Subscriptions</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.workspacesWithSubscriptions}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-red-600">
                {analytics.overview.workspacesWithoutSubscriptions} without subs
              </span>
              <span>•</span>
              <span>{formatPercentage(analytics.overview.workspacesWithSubscriptions, analytics.overview.totalWorkspaces)} coverage</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Health</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>User Activity</span>
                <Badge variant={userHealthStatus.status === 'healthy' ? 'default' : 'destructive'}>
                  {formatPercentage(analytics.overview.activeUsers, analytics.overview.totalUsers)}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Subscription Rate</span>
                <Badge variant={subscriptionHealthStatus.status === 'healthy' ? 'default' : 'destructive'}>
                  {formatPercentage(analytics.overview.workspacesWithSubscriptions, analytics.overview.totalWorkspaces)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              User Growth ({period})
            </CardTitle>
            <CardDescription>New users registered over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.userGrowth.length > 0 ? (
                analytics.userGrowth.map((growth, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded border">
                    <span className="text-sm">
                      {growth._id.year}-{String(growth._id.month).padStart(2, '0')}-{String(growth._id.day).padStart(2, '0')}
                    </span>
                    <Badge variant="outline">{growth.newUsers} users</Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No user growth data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* System Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              System Statistics
            </CardTitle>
            <CardDescription>Platform usage and performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 rounded border">
                  <div className="text-2xl font-bold text-blue-600">{analytics.totalUsage.totalApiCalls}</div>
                  <div className="text-xs text-muted-foreground">API Calls</div>
                </div>
                <div className="text-center p-4 rounded border">
                  <div className="text-2xl font-bold text-green-600">{analytics.totalUsage.totalProductsSync}</div>
                  <div className="text-xs text-muted-foreground">Product Syncs</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Storage Used</span>
                  <span className="text-sm font-medium">{analytics.totalUsage.totalStorageUsed} MB</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Avg Products/Store</span>
                  <span className="text-sm font-medium">
                    {analytics.overview.totalStoreConnections > 0 
                      ? Math.round(analytics.overview.totalProducts / analytics.overview.totalStoreConnections)
                      : 0
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Revenue per Subscription</span>
                  <span className="text-sm font-medium">
                    {analytics.overview.totalSubscriptions > 0
                      ? formatCurrency(analytics.overview.totalRevenue / analytics.overview.totalSubscriptions)
                      : '$0.00'
                    }
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Last updated: {new Date(analytics.generatedAt).toLocaleString()}</span>
            <span>Period: {analytics.period}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}