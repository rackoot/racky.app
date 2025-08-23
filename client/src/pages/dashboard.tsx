import { useState, useEffect } from "react"
import { MetricsCard } from "@/components/dashboard/metrics-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Package, Store, DollarSign, TrendingUp, PieChart, LineChart, Lightbulb, RefreshCw, AlertCircle, Loader2 } from "lucide-react"
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useWorkspace } from "@/components/workspace/workspace-context"
import { dashboardService, type DashboardAnalytics, type AISuggestionsResponse } from "@/services/dashboard"

const priorityColors = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800'
};

const categoryIcons = {
  marketing: '📈',
  inventory: '📦',
  pricing: '💰',
  expansion: '🌐'
};

export function Dashboard() {
  const { currentWorkspace } = useWorkspace()
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null)
  const [suggestions, setSuggestions] = useState<AISuggestionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
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

  const loadSuggestions = async (forceRefresh = false) => {
    setSuggestionsLoading(true)
    
    try {
      const data = await dashboardService.getAISuggestions(forceRefresh)
      setSuggestions(data)
    } catch (err) {
      console.error('Failed to load AI suggestions:', err)
    } finally {
      setSuggestionsLoading(false)
    }
  }

  useEffect(() => {
    // Only load if we have a current workspace
    if (currentWorkspace) {
      loadAnalytics()
      loadSuggestions()
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
                      stroke="#2563eb" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
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

        {/* AI Suggestions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-normal flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              AI Suggestions
            </CardTitle>
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => loadSuggestions(false)}
                disabled={suggestionsLoading}
                title="Refresh suggestions"
              >
                <RefreshCw className={`w-4 h-4 ${suggestionsLoading ? 'animate-spin' : ''}`} />
              </Button>
              {suggestions?.cached && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => loadSuggestions(true)}
                  disabled={suggestionsLoading}
                  title="Generate new suggestions"
                >
                  <Lightbulb className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {suggestionsLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : suggestions?.suggestions && suggestions.suggestions.length > 0 ? (
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                {suggestions.suggestions.map((suggestion, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm">{suggestion.title}</h4>
                      <div className="flex gap-1 flex-shrink-0">
                        <Badge 
                          variant="secondary"
                          className={priorityColors[suggestion.priority]}
                        >
                          {suggestion.priority}
                        </Badge>
                        <span className="text-sm">{categoryIcons[suggestion.category]}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{suggestion.description}</p>
                    <p className="text-xs font-medium text-blue-600">{suggestion.impact}</p>
                  </div>
                ))}
                {suggestions.generatedAt && (
                  <div className="pt-2 space-y-1">
                    <p className="text-xs text-muted-foreground text-center">
                      {suggestions.cached ? 'Cached' : 'Generated'} {new Date(suggestions.generatedAt).toLocaleString()}
                    </p>
                    {suggestions.cached && suggestions.expiresAt && (
                      <p className="text-xs text-muted-foreground text-center">
                        Expires {new Date(suggestions.expiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-center">
                  <Lightbulb className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No suggestions available</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadSuggestions}
                    className="mt-2"
                  >
                    Generate Suggestions
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