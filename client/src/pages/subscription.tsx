import { useEffect, useState } from "react"
import { subscriptionApi, workspaceUsageApi } from '@/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  CreditCard, 
  Calendar, 
  TrendingUp, 
  Store, 
  Package, 
  Activity,
  CheckCircle,
  AlertTriangle,
  Crown,
  UserCheck,
  Zap,
  Users
} from "lucide-react"
import { getCurrentUser } from "@/lib/auth"
import { getAuthHeaders } from "@/lib/utils"
import { useNavigate } from "react-router-dom"
import { useWorkspace } from "@/components/workspace/workspace-context"

interface WorkspaceSubscriptionData {
  workspaceId: string
  workspaceName: string
  subscription: {
    status: string
    plan: string
    hasActiveSubscription: boolean
    endsAt?: string
    planLimits: {
      maxStores: number
      maxProducts: number
      maxMarketplaces: number
      maxSyncFrequency: number
      apiCallsPerMonth: number
    }
  }
  currentPlan: {
    _id: string
    name: string
    displayName: string
    description: string
    contributorType: 'JUNIOR' | 'SENIOR' | 'EXECUTIVE'
    actionsPerContributor: number
    maxContributorsPerWorkspace: number
    isContactSalesOnly: boolean
    monthlyPrice: number
    yearlyPrice: number
    currency: string
    stripeMonthlyPriceId: string
    stripeYearlyPriceId: string
    features: Array<{
      _id: string
      name: string
      description: string
      enabled: boolean
    }>
    limits: {
      maxStores: number
      maxProducts: number
      maxMarketplaces: number
      maxSyncFrequency: number
      apiCallsPerMonth: number
    }
    isActive: boolean
    isPublic: boolean
    sortOrder: number
    trialDays: number
    createdAt: string
    updatedAt: string
  }
  hasActiveSubscription: boolean
  limits: {
    maxStores: number
    maxProducts: number
    maxMarketplaces: number
    maxSyncFrequency: number
    apiCallsPerMonth: number
  }
  features: Array<{
    _id: string
    name: string
    description: string
    enabled: boolean
  }>
}

interface WorkspaceUsageData {
  workspaceId: string
  workspaceName: string
  currentPeriod: {
    month: string
    apiCalls: number
    productSyncs: number
    storesConnected: number
    totalProducts: number
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
  } | null
  percentageUsed: {
    stores: number
    products: number
    apiCalls: number
  } | null
}

export function Subscription() {
  const [subscriptionData, setSubscriptionData] = useState<WorkspaceSubscriptionData | null>(null)
  const [usageData, setUsageData] = useState<WorkspaceUsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  
  const user = getCurrentUser()
  const navigate = useNavigate()
  const { currentWorkspace } = useWorkspace()

  useEffect(() => {
    if (currentWorkspace) {
      loadSubscriptionData()
    }
  }, [currentWorkspace])

  const loadSubscriptionData = async () => {
    if (!currentWorkspace) {
      setError('No workspace selected')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const [subscriptionResponse, usageResponse] = await Promise.all([
        subscriptionApi.getSubscription(currentWorkspace._id),
        workspaceUsageApi.getWorkspaceUsage(currentWorkspace._id)
      ])

      setSubscriptionData(subscriptionResponse)
      setUsageData(usageResponse)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription data')
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2)
  }

  const getContributorIcon = (contributorType?: 'JUNIOR' | 'SENIOR' | 'EXECUTIVE') => {
    switch (contributorType) {
      case 'JUNIOR':
        return <Zap className="w-5 h-5 text-blue-600" />
      case 'SENIOR':
        return <UserCheck className="w-5 h-5 text-green-600" />
      case 'EXECUTIVE':
        return <Crown className="w-5 h-5 text-purple-600" />
      default:
        return <Users className="w-5 h-5 text-gray-600" />
    }
  }

  const getContributorTypeColor = (contributorType?: 'JUNIOR' | 'SENIOR' | 'EXECUTIVE') => {
    switch (contributorType) {
      case 'JUNIOR':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-950/50'
      case 'SENIOR':
        return 'text-green-600 bg-green-50 dark:bg-green-950/50'
      case 'EXECUTIVE':
        return 'text-purple-600 bg-purple-50 dark:bg-purple-950/50'
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-950/50'
    }
  }

  const getStatusBadge = (status: string) => {
    if (status === 'ACTIVE') {
      return <Badge variant="default">Active</Badge>
    } else if (status === 'SUSPENDED') {
      return <Badge variant="destructive">Suspended</Badge>
    } else if (status === 'CANCELLED') {
      return <Badge variant="outline">Cancelled</Badge>
    } else if (status === 'EXPIRED') {
      return <Badge variant="destructive">Expired</Badge>
    } else {
      return <Badge variant="outline">{status}</Badge>
    }
  }

  const getUsagePercentage = (current: number, max: number) => {
    return Math.min((current / max) * 100, 100)
  }

  const getProgressVariant = (percentage: number) => {
    if (percentage >= 90) return "destructive"
    if (percentage >= 75) return "warning" 
    return "default"
  }

  const handleUpgradePlan = async () => {
    if (!subscriptionData) return
    
    setUpgrading(true)
    
    try {
      // Create Stripe billing portal session
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      
      if (data.success && data.data.url) {
        // Redirect to Stripe billing portal
        window.location.href = data.data.url
      } else {
        // Fallback to pricing page
        navigate('/pricing')
      }
    } catch (error) {
      console.error('Error creating portal session:', error)
      // Fallback to pricing page
      navigate('/pricing')
    } finally {
      setUpgrading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Subscription</h1>
          <p className="text-muted-foreground">Manage your plan and view usage</p>
        </div>
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading subscription...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Subscription</h1>
          <p className="text-muted-foreground">Manage your plan and view usage</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span>Error: {error}</span>
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
        <h1 className="text-3xl font-bold">Subscription</h1>
        <p className="text-muted-foreground">Manage your plan and view usage</p>
      </div>

      {/* Current Contributors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Your Contributors
          </CardTitle>
          <CardDescription>Your hired AI contributors and their capabilities</CardDescription>
        </CardHeader>
        <CardContent>
          {!subscriptionData || !subscriptionData.hasActiveSubscription ? (
            <div className="text-center py-8">
              <Users className="w-16 h-16 mx-auto mb-4 text-primary opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No Contributors Hired</h3>
              <p className="text-muted-foreground mb-6">
                You need to hire AI contributors to automate your marketplace operations.
              </p>
              <Button size="lg" asChild>
                <a href="/pricing">Hire Contributors</a>
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Contributor Type and Count Header */}
              <div className={`flex items-center gap-4 p-4 rounded-lg ${getContributorTypeColor(subscriptionData.currentPlan.contributorType)}`}>
                <div className="flex items-center gap-3">
                  {getContributorIcon(subscriptionData.currentPlan.contributorType)}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-semibold">1x {subscriptionData.currentPlan.displayName}</h3>
                      {getStatusBadge(subscriptionData.subscription.status)}
                    </div>
                    <p className="text-sm opacity-80">{subscriptionData.currentPlan.description}</p>
                  </div>
                </div>
              </div>

              {/* Pricing and Actions Summary */}
              <div className="flex items-start justify-between">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-2xl font-bold">
                      ${formatPrice(subscriptionData.currentPlan.monthlyPrice)}/month
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Per contributor
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {subscriptionData.currentPlan.actionsPerContributor === -1 ? 'Unlimited' : 
                       subscriptionData.currentPlan.actionsPerContributor.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Actions per contributor
                    </div>
                  </div>
                </div>
                <Button onClick={handleUpgradePlan} disabled={upgrading}>
                  {upgrading ? 'Loading...' : 'Manage Contributors'}
                </Button>
              </div>

              {/* Subscription Info */}
              {subscriptionData.subscription.endsAt && subscriptionData.subscription.hasActiveSubscription && (
                <div className="flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Next billing on {new Date(subscriptionData.subscription.endsAt).toLocaleDateString()}</p>
                    <p className="text-sm text-muted-foreground">
                      Your subscription will automatically renew
                    </p>
                  </div>
                </div>
              )}

              {/* Plan Limits */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <Store className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                  <div className="font-medium">{subscriptionData.limits.maxStores}</div>
                  <div className="text-sm text-muted-foreground">Max Stores</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Package className="w-8 h-8 mx-auto mb-2 text-green-600" />
                  <div className="font-medium">{subscriptionData.limits.maxProducts.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Max Products</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Activity className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                  <div className="font-medium">{subscriptionData.limits.apiCallsPerMonth.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">API Calls/Month</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contributor Performance */}
      {subscriptionData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Contributor Performance
            </CardTitle>
            <CardDescription>How your contributors are performing this month</CardDescription>
          </CardHeader>
          <CardContent>
            {usageData && (
            <div className="space-y-6">
              {/* Total Actions Used */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Actions Used This Month</span>
                  <span className="text-sm text-muted-foreground">
                    {usageData.currentPeriod.apiCalls.toLocaleString()} / {subscriptionData.limits.apiCallsPerMonth === -1 ? 'Unlimited' : subscriptionData.limits.apiCallsPerMonth.toLocaleString()}
                  </span>
                </div>
                {subscriptionData.limits.apiCallsPerMonth !== -1 && (
                  <Progress 
                    value={getUsagePercentage(usageData.currentPeriod.apiCalls, subscriptionData.limits.apiCallsPerMonth)}
                    className="h-2"
                  />
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  Current contributor performance: {usageData.currentPeriod.apiCalls.toLocaleString()} actions
                </div>
              </div>

              {/* Current Contributor Performance */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-3">Current Contributor Performance</h4>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <div className="text-center p-3 bg-background rounded border">
                    <div className="flex justify-center mb-2">
                      {getContributorIcon(subscriptionData.currentPlan.contributorType)}
                    </div>
                    <div className="font-medium text-sm">{subscriptionData.currentPlan.displayName}</div>
                    <div className="text-xs text-muted-foreground">
                      {usageData.currentPeriod.apiCalls.toLocaleString()} actions this month
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      {subscriptionData.currentPlan.actionsPerContributor === -1 ? 'Unlimited capacity' : 
                       `${((usageData.currentPeriod.apiCalls / subscriptionData.currentPlan.actionsPerContributor) * 100).toFixed(0)}% capacity utilized`
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Stores */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Connected Stores</span>
                  <span className="text-sm text-muted-foreground">
                    {usageData.currentPeriod.storesConnected} / {subscriptionData.limits.maxStores}
                  </span>
                </div>
                <Progress 
                  value={getUsagePercentage(usageData.currentPeriod.storesConnected, subscriptionData.limits.maxStores)}
                  className="h-2"
                />
              </div>

              {/* Products */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Total Products</span>
                  <span className="text-sm text-muted-foreground">
                    {usageData.currentPeriod.totalProducts.toLocaleString()} / {subscriptionData.limits.maxProducts.toLocaleString()}
                  </span>
                </div>
                <Progress 
                  value={getUsagePercentage(usageData.currentPeriod.totalProducts, subscriptionData.limits.maxProducts)}
                  className="h-2"
                />
              </div>

              {/* Feature Usage */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="font-medium text-lg">{usageData.currentPeriod.features.aiSuggestions}</div>
                  <div className="text-sm text-muted-foreground">AI Suggestions</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="font-medium text-lg">{usageData.currentPeriod.features.opportunityScans}</div>
                  <div className="text-sm text-muted-foreground">Opportunity Scans</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="font-medium text-lg">{usageData.currentPeriod.features.bulkOperations}</div>
                  <div className="text-sm text-muted-foreground">Bulk Operations</div>
                </div>
              </div>
            </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plan Features */}
      {subscriptionData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Plan Features
            </CardTitle>
            <CardDescription>Features included in your current plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subscriptionData.features.map((feature, index) => (
                <div key={feature._id || index} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">{feature.name}</div>
                    <div className="text-sm text-muted-foreground">{feature.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing Information */}
      {subscriptionData && (
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Billing Information
          </CardTitle>
          <CardDescription>Manage your billing details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">Payment Method</div>
                <div className="text-sm text-muted-foreground">•••• •••• •••• 4242</div>
              </div>
              <Button variant="outline">Update</Button>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">Billing Email</div>
                <div className="text-sm text-muted-foreground">{user?.email}</div>
              </div>
              <Button variant="outline">Update</Button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">Billing History</div>
                <div className="text-sm text-muted-foreground">View past invoices and payments</div>
              </div>
              <Button variant="outline">View History</Button>
            </div>
          </div>
        </CardContent>
        </Card>
      )}
    </div>
  )
}