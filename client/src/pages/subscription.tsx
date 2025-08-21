import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  CreditCard, 
  Calendar, 
  TrendingUp, 
  Database, 
  Store, 
  Package, 
  Activity,
  CheckCircle,
  AlertTriangle,
  Crown
} from "lucide-react"
import { getCurrentUser } from "@/lib/auth"
import { getAuthHeaders } from "@/lib/utils"
import { useNavigate } from "react-router-dom"

interface Plan {
  name: string
  displayName: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
  limits: {
    maxStores: number
    maxProducts: number
    maxMarketplaces: number
    maxSyncFrequency: number
    apiCallsPerMonth: number
  }
  features: Array<{
    name: string
    description: string
    enabled: boolean
  }>
}

interface UserPlan {
  plan: Plan
  userSubscription: {
    status: string
    plan: string
    hasActiveSubscription: boolean
    subscriptionEndsAt?: string
    maxStores: number
    maxProducts: number
  }
}

interface Usage {
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

export function Subscription() {
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  
  const user = getCurrentUser()
  const navigate = useNavigate()

  useEffect(() => {
    loadSubscriptionData()
  }, [])

  const loadSubscriptionData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [planResponse, usageResponse] = await Promise.all([
        fetch('http://localhost:5000/api/plans/user/current', {
          headers: getAuthHeaders()
        }),
        fetch('http://localhost:5000/api/usage/current', {
          headers: getAuthHeaders()
        })
      ])

      if (planResponse.ok) {
        const planData = await planResponse.json()
        if (planData.success) {
          setUserPlan(planData.data)
        }
      }

      if (usageResponse.ok) {
        const usageData = await usageResponse.json()
        if (usageData.success) {
          setUsage({
            apiCalls: usageData.data.currentPeriod.apiCalls,
            productsSync: usageData.data.currentPeriod.productsSync,
            storesConnected: usageData.data.currentPeriod.storesConnected,
            storageUsed: usageData.data.currentPeriod.storageUsed,
            features: usageData.data.currentPeriod.features
          })
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription data')
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2)
  }

  const getStatusBadge = (subscription: UserPlan['userSubscription']) => {
    if (subscription.status === 'ACTIVE') {
      return <Badge variant="default">Active</Badge>
    } else if (subscription.status === 'SUSPENDED') {
      return <Badge variant="destructive">Suspended</Badge>
    } else if (subscription.status === 'CANCELLED') {
      return <Badge variant="outline">Cancelled</Badge>
    } else if (subscription.status === 'EXPIRED') {
      return <Badge variant="destructive">Expired</Badge>
    } else {
      return <Badge variant="outline">{subscription.status}</Badge>
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
    if (!userPlan) return
    
    setUpgrading(true)
    
    try {
      // Create Stripe billing portal session
      const response = await fetch('http://localhost:5000/api/billing/portal', {
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

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            Current Plan
          </CardTitle>
          <CardDescription>Your active subscription details</CardDescription>
        </CardHeader>
        <CardContent>
          {!userPlan ? (
            <div className="text-center py-8">
              <Crown className="w-16 h-16 mx-auto mb-4 text-yellow-500 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No Active Subscription</h3>
              <p className="text-muted-foreground mb-6">
                You need an active subscription to access Racky features.
              </p>
              <Button size="lg" asChild>
                <a href="/pricing">Choose a Plan</a>
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{userPlan.plan.displayName}</h3>
                    {getStatusBadge(userPlan.userSubscription)}
                  </div>
                  <p className="text-muted-foreground mb-4">{userPlan.plan.description}</p>
                  <div className="text-2xl font-bold">
                    ${formatPrice(userPlan.plan.monthlyPrice)}/month
                  </div>
                </div>
                <Button onClick={handleUpgradePlan} disabled={upgrading}>
                  {upgrading ? 'Loading...' : 'Upgrade Plan'}
                </Button>
              </div>

              {/* Subscription Info */}
              {userPlan.userSubscription.subscriptionEndsAt && userPlan.userSubscription.hasActiveSubscription && (
                <div className="flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Next billing on {new Date(userPlan.userSubscription.subscriptionEndsAt).toLocaleDateString()}</p>
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
                  <div className="font-medium">{userPlan.plan.limits.maxStores}</div>
                  <div className="text-sm text-muted-foreground">Max Stores</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Package className="w-8 h-8 mx-auto mb-2 text-green-600" />
                  <div className="font-medium">{userPlan.plan.limits.maxProducts.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Max Products</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Activity className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                  <div className="font-medium">{userPlan.plan.limits.apiCallsPerMonth.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">API Calls/Month</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      {userPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Current Usage
            </CardTitle>
            <CardDescription>Your usage this month</CardDescription>
          </CardHeader>
          <CardContent>
            {usage && (
            <div className="space-y-6">
              {/* API Calls */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">API Calls</span>
                  <span className="text-sm text-muted-foreground">
                    {usage.apiCalls.toLocaleString()} / {userPlan.plan.limits.apiCallsPerMonth.toLocaleString()}
                  </span>
                </div>
                <Progress 
                  value={getUsagePercentage(usage.apiCalls, userPlan.plan.limits.apiCallsPerMonth)}
                  className="h-2"
                />
              </div>

              {/* Stores */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Connected Stores</span>
                  <span className="text-sm text-muted-foreground">
                    {usage.storesConnected} / {userPlan.plan.limits.maxStores}
                  </span>
                </div>
                <Progress 
                  value={getUsagePercentage(usage.storesConnected, userPlan.plan.limits.maxStores)}
                  className="h-2"
                />
              </div>

              {/* Storage */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Storage Used</span>
                  <span className="text-sm text-muted-foreground">
                    {usage.storageUsed} MB
                  </span>
                </div>
                <Progress value={usage.storageUsed} className="h-2" />
              </div>

              {/* Feature Usage */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="font-medium text-lg">{usage.features.aiSuggestions}</div>
                  <div className="text-sm text-muted-foreground">AI Suggestions</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="font-medium text-lg">{usage.features.opportunityScans}</div>
                  <div className="text-sm text-muted-foreground">Opportunity Scans</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="font-medium text-lg">{usage.features.bulkOperations}</div>
                  <div className="text-sm text-muted-foreground">Bulk Operations</div>
                </div>
              </div>
            </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plan Features */}
      {userPlan && (
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
              {userPlan.plan.features.map((feature, index) => (
                <div key={index} className="flex items-start gap-3">
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
      {userPlan && (
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