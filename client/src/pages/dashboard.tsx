import { useState, useEffect } from "react"
import { MetricsCard } from "@/components/dashboard/metrics-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Package, Store, DollarSign, TrendingUp, PieChart, LineChart, Brain, RefreshCw, AlertCircle, Loader2, Activity, CheckCircle2, Clock } from "lucide-react"
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useWorkspace } from "@/components/workspace/workspace-context"
import { dashboardService, type DashboardAnalytics, type AIScanStatistics } from "@/services/dashboard"

// Racky brand colors
const BRAND_COLORS = {
  primary: '#18d2c0',    // Teal
  secondary: '#f5ca0b',  // Yellow
  accent: '#856dff',     // Purple
  text: '#000000'        // Black
}

export function Dashboard() {
  const { currentWorkspace } = useWorkspace()
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null)
  const [aiStatistics, setAiStatistics] = useState<AIScanStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiStatsLoading, setAiStatsLoading] = useState(false)
  const [error, setError] = useState("")

  const loadAnalytics = async () => {
    setLoading(true)
    setError("")
    
    try {
      const data = await dashboardService.getAnalytics()
      setAnalytics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }

  const loadAiStatistics = async () => {
    if (!currentWorkspace?._id) return;
    
    setAiStatsLoading(true)
    
    try {
      const data = await dashboardService.getAIScanStatistics(currentWorkspace._id)
      setAiStatistics(data)
    } catch (err) {
      console.error('Failed to load AI statistics:', err)
    } finally {
      setAiStatsLoading(false)
    }
  }

  useEffect(() => {
    // Only load if we have a current workspace
    if (currentWorkspace) {
      loadAnalytics()
      loadAiStatistics()
    }
  }, [currentWorkspace])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your marketplace performance
          </p>
        </div>
        <Button onClick={loadAnalytics} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricsCard
          title="Total Products"
          value={analytics?.metrics.totalProducts.toLocaleString() || "0"}
          change={analytics?.metrics.productGrowth || "+0% from last month"}
          changeType="positive"
          icon={Package}
        />
        <MetricsCard
          title="Connected Stores"
          value={analytics?.metrics.connectedStores.toString() || "0"}
          change="Marketplace connections"
          changeType="neutral"
          icon={Store}
        />
        <MetricsCard
          title="Monthly Revenue"
          value={analytics?.metrics.monthlyRevenue ? formatCurrency(analytics.metrics.monthlyRevenue) : "$0"}
          change="Estimated from products"
          changeType="neutral"
          icon={DollarSign}
        />
        <MetricsCard
          title="Avg. Order Value"
          value={analytics?.metrics.avgOrderValue ? formatCurrency(analytics.metrics.avgOrderValue) : "$0"}
          change="Industry average"
          changeType="neutral"
          icon={TrendingUp}
        />
      </div>

      {/* Charts and AI Suggestions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Product Distribution Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-normal">Product Distribution by Platform</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analytics?.charts.productDistribution && analytics.charts.productDistribution.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={analytics.charts.productDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {analytics.charts.productDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value}%`, name]} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-center">
                  <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No products yet</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Products Trend Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-normal">Products Added (Last 6 Months)</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analytics?.charts.productsTrend && analytics.charts.productsTrend.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={analytics.charts.productsTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}`, 'Products Added']} />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke={BRAND_COLORS.primary} 
                      strokeWidth={2}
                      dot={{ r: 4, fill: BRAND_COLORS.primary }}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-center">
                  <LineChart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No trend data yet</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Scan Statistics */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-normal flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI Scan Statistics
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={loadAiStatistics}
              disabled={aiStatsLoading}
              title="Refresh AI statistics"
            >
              <RefreshCw className={`w-4 h-4 ${aiStatsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {aiStatsLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : aiStatistics ? (
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 rounded-lg" style={{ backgroundColor: `${BRAND_COLORS.primary}20` }}>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Activity className="h-4 w-4" style={{ color: BRAND_COLORS.primary }} />
                      <span className="text-sm font-medium" style={{ color: BRAND_COLORS.text }}>Total Scans</span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: BRAND_COLORS.primary }}>{aiStatistics.metrics.totalScans}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg" style={{ backgroundColor: `${BRAND_COLORS.secondary}20` }}>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <CheckCircle2 className="h-4 w-4" style={{ color: BRAND_COLORS.secondary }} />
                      <span className="text-sm font-medium" style={{ color: BRAND_COLORS.text }}>Success Rate</span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: BRAND_COLORS.secondary }}>{aiStatistics.metrics.successRate}%</p>
                  </div>
                </div>

                {/* Status Distribution */}
                {aiStatistics.charts.statusDistribution.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Scan Status Distribution</h4>
                    <div className="flex flex-wrap gap-2">
                      {aiStatistics.charts.statusDistribution.map((item, index) => (
                        <div key={index} className="flex items-center gap-1">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-xs">{item.name}: {item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Metrics */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Products Processed (30d):</span>
                    <span className="font-medium">{aiStatistics.metrics.totalProductsProcessed.toLocaleString()}</span>
                  </div>
                  {aiStatistics.metrics.activeScans > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Active Scans:</span>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" style={{ color: BRAND_COLORS.secondary }} />
                        <span className="font-medium" style={{ color: BRAND_COLORS.secondary }}>{aiStatistics.metrics.activeScans}</span>
                      </div>
                    </div>
                  )}
                  {aiStatistics.metrics.lastScanAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Last Scan:</span>
                      <span className="font-medium">{new Date(aiStatistics.metrics.lastScanAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="pt-2 border-t">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => window.location.href = '/ai-optimization/start-scan'}
                      className="flex-1 text-xs"
                    >
                      <Brain className="w-3 h-3 mr-1" />
                      Start New Scan
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => window.location.href = '/ai-optimization/scan-history'}
                      className="flex-1 text-xs"
                    >
                      <Activity className="w-3 h-3 mr-1" />
                      View History
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-center">
                  <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-2">No AI scans yet</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.location.href = '/ai-optimization/start-scan'}
                  >
                    Start Your First Scan
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}