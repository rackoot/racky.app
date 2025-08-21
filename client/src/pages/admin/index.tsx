import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, DollarSign, Activity, TrendingUp, UserCheck, UserX, CreditCard, AlertTriangle } from "lucide-react"
import { getAuthHeaders } from "@/lib/utils"

interface AdminStats {
  totalUsers: number
  activeUsers: number
  trialUsers: number
  activeSubscriptions: number
  superAdmins: number
}

interface AnalyticsData {
  period: string
  totalUsage: {
    totalApiCalls: number
    totalProductsSync: number
    totalStorageUsed: number
    totalUsers: number
    totalProducts: number
    totalStoreConnections: number
  }
  userGrowth: Array<{
    _id: { year: number; month: number; day: number }
    newUsers: number
  }>
  subscriptionBreakdown: Array<{
    _id: string
    count: number
  }>
  revenueData: Array<{
    _id: string
    count: number
  }>
}

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [usersResponse, analyticsResponse] = await Promise.all([
        fetch('http://localhost:5000/api/admin/users?limit=1', {
          headers: getAuthHeaders()
        }),
        fetch('http://localhost:5000/api/admin/analytics', {
          headers: getAuthHeaders()
        })
      ])

      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        if (usersData.success) {
          setStats(usersData.data.stats)
        }
      }

      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json()
        if (analyticsData.success) {
          setAnalytics(analyticsData.data)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform overview and key metrics</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-16"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform overview and key metrics</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span>Error loading dashboard: {error}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const calculateMRR = () => {
    if (!analytics?.revenueData) return 0
    
    // Simple MRR calculation based on active subscriptions
    let mrr = 0
    analytics.revenueData.forEach(plan => {
      switch (plan._id) {
        case 'BASIC':
          mrr += plan.count * 29
          break
        case 'PRO':
          mrr += plan.count * 79
          break
        case 'ENTERPRISE':
          mrr += plan.count * 199
          break
      }
    })
    return mrr
  }

  const getRecentUserGrowth = () => {
    if (!analytics?.userGrowth) return 0
    const last7Days = analytics.userGrowth.slice(-7)
    return last7Days.reduce((sum, day) => sum + day.newUsers, 0)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Platform overview and key metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeUsers || 0} active users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${calculateMRR().toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeSubscriptions || 0} active subscriptions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Usage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.totalUsage.totalApiCalls?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{getRecentUserGrowth()}</div>
            <p className="text-xs text-muted-foreground">
              Last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-green-600" />
              User Status
            </CardTitle>
            <CardDescription>Current user account status breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Active Users</span>
              <span className="font-medium">{stats?.activeUsers || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Trial Users</span>
              <span className="font-medium">{stats?.trialUsers || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Super Admins</span>
              <span className="font-medium">{stats?.superAdmins || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Subscription Plans
            </CardTitle>
            <CardDescription>Distribution of subscription tiers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {analytics?.revenueData.map((plan) => (
              <div key={plan._id} className="flex justify-between">
                <span className="text-sm">{plan._id}</span>
                <span className="font-medium">{plan.count}</span>
              </div>
            )) || (
              <div className="text-sm text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              Platform Usage
            </CardTitle>
            <CardDescription>Key usage metrics this month</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Total Products</span>
              <span className="font-medium">
                {analytics?.totalUsage.totalProducts?.toLocaleString() || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Store Connections</span>
              <span className="font-medium">
                {analytics?.totalUsage.totalStoreConnections?.toLocaleString() || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Products Synced</span>
              <span className="font-medium">
                {analytics?.totalUsage.totalProductsSync?.toLocaleString() || 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}