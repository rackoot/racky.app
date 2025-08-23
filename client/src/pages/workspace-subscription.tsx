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
  Crown,
  Building
} from "lucide-react"
import { useWorkspace } from "@/components/workspace/workspace-context"
import { 
  getWorkspaceSubscription, 
  getWorkspaceUsage, 
  getSubscriptionPlans,
  updateWorkspaceSubscription,
  cancelWorkspaceSubscription,
  type WorkspaceSubscription,
  type WorkspaceUsage 
} from "@/services/workspace"
import { useNavigate } from "react-router-dom"
// TODO: Add toast library or use alert for now
const toast = {
  success: (message: string) => alert(`Success: ${message}`),
  error: (message: string) => alert(`Error: ${message}`)
}

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

export default function WorkspaceSubscriptionPage() {
  const navigate = useNavigate()
  const { currentWorkspace } = useWorkspace()
  const [subscription, setSubscription] = useState<WorkspaceSubscription | null>(null)
  const [usage, setUsage] = useState<WorkspaceUsage | null>(null)
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')

  useEffect(() => {
    if (!currentWorkspace) {
      setError('No workspace selected')
      setIsLoading(false)
      return
    }

    loadSubscriptionData()
  }, [currentWorkspace])

  const loadSubscriptionData = async () => {
    if (!currentWorkspace) return

    try {
      setIsLoading(true)
      setError(null)

      const [subscriptionData, usageData, plansData] = await Promise.all([
        getWorkspaceSubscription(currentWorkspace._id),
        getWorkspaceUsage(currentWorkspace._id),
        getSubscriptionPlans()
      ])

      setSubscription(subscriptionData)
      setUsage(usageData)
      setAvailablePlans(plansData)
    } catch (error) {
      console.error('Error loading subscription data:', error)
      setError(error instanceof Error ? error.message : 'Failed to load subscription data')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePlanUpgrade = async (planName: 'BASIC' | 'PRO' | 'ENTERPRISE') => {
    if (!currentWorkspace || isUpdating) return

    try {
      setIsUpdating(true)
      await updateWorkspaceSubscription(currentWorkspace._id, {
        planName,
        billingCycle
      })
      
      toast.success(`Workspace subscription updated to ${planName} plan`)
      await loadSubscriptionData()
    } catch (error) {
      console.error('Error updating subscription:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update subscription')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!currentWorkspace || !subscription?.hasActiveSubscription || isUpdating) return

    if (!confirm('Are you sure you want to cancel this workspace subscription? This will affect all workspace members.')) {
      return
    }

    try {
      setIsUpdating(true)
      await cancelWorkspaceSubscription(currentWorkspace._id)
      
      toast.success('Workspace subscription cancelled')
      await loadSubscriptionData()
    } catch (error) {
      console.error('Error cancelling subscription:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to cancel subscription')
    } finally {
      setIsUpdating(false)
    }
  }

  if (!currentWorkspace) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <Building className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-semibold mb-2">No Workspace Selected</h2>
          <p className="text-muted-foreground mb-4">
            Please select a workspace to manage its subscription.
          </p>
          <Button onClick={() => navigate('/workspaces')}>
            Select Workspace
          </Button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold">Loading subscription data...</h2>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-2xl font-semibold mb-2">Error Loading Subscription</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadSubscriptionData}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  const getStatusBadge = (status: string, hasActive: boolean) => {
    if (hasActive && status === 'ACTIVE') {
      return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>
    }
    if (status === 'TRIAL') {
      return <Badge variant="outline" className="border-blue-500 text-blue-700"><Calendar className="h-3 w-3 mr-1" />Trial</Badge>
    }
    if (status === 'CANCELLED') {
      return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Cancelled</Badge>
    }
    return <Badge variant="secondary">{status}</Badge>
  }

  const currentPlan = subscription?.currentPlan
  const planName = currentPlan?.name || 'No Plan'

  return (
    <div className="container max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Workspace Subscription</h1>
        <p className="text-muted-foreground">
          Manage subscription for <strong>{currentWorkspace.name}</strong> workspace
        </p>
      </div>

      {/* Current Subscription Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{planName}</div>
            <div className="mt-2">
              {subscription && getStatusBadge(subscription.subscription.status, subscription.hasActiveSubscription)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscription End</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subscription?.subscription.endsAt 
                ? new Date(subscription.subscription.endsAt).toLocaleDateString()
                : 'N/A'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {subscription?.subscription.endsAt && subscription.hasActiveSubscription
                ? `${Math.ceil((new Date(subscription.subscription.endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining`
                : 'No active subscription'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workspace Members</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Shared</div>
            <p className="text-xs text-muted-foreground">
              All workspace members benefit from this subscription
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Statistics */}
      {usage && subscription?.limits && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage Statistics - {usage.currentPeriod.month}
            </CardTitle>
            <CardDescription>
              Current month usage across your workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    <span className="text-sm font-medium">Stores</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {usage.currentPeriod.storesConnected} / {subscription.limits.maxStores}
                  </span>
                </div>
                <Progress 
                  value={usage.percentageUsed?.stores || 0} 
                  className="h-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span className="text-sm font-medium">Products</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {usage.currentPeriod.totalProducts} / {subscription.limits.maxProducts}
                  </span>
                </div>
                <Progress 
                  value={usage.percentageUsed?.products || 0} 
                  className="h-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span className="text-sm font-medium">API Calls</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {usage.currentPeriod.apiCalls} / {subscription.limits.apiCallsPerMonth}
                  </span>
                </div>
                <Progress 
                  value={usage.percentageUsed?.apiCalls || 0} 
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>
            Choose the plan that best fits your workspace needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-4">
            <span className="text-sm font-medium">Billing cycle:</span>
            <div className="flex gap-2">
              <Button 
                variant={billingCycle === 'monthly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setBillingCycle('monthly')}
              >
                Monthly
              </Button>
              <Button 
                variant={billingCycle === 'annual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setBillingCycle('annual')}
              >
                Annual
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {availablePlans.map((plan) => (
              <Card key={plan.name} className={`relative ${currentPlan?.name === plan.name ? 'ring-2 ring-primary' : ''}`}>
                {currentPlan?.name === plan.name && (
                  <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    Current Plan
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle>{plan.displayName}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="text-3xl font-bold">
                    ${billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
                    <span className="text-base font-normal text-muted-foreground">
                      /{billingCycle === 'monthly' ? 'month' : 'year'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-sm">
                      <strong>{plan.limits.maxStores}</strong> stores
                    </div>
                    <div className="text-sm">
                      <strong>{plan.limits.maxProducts.toLocaleString()}</strong> products
                    </div>
                    <div className="text-sm">
                      <strong>{plan.limits.maxMarketplaces}</strong> marketplaces
                    </div>
                    <div className="text-sm">
                      <strong>{plan.limits.apiCallsPerMonth.toLocaleString()}</strong> API calls/month
                    </div>
                  </div>

                  <div className="space-y-1">
                    {plan.features.map((feature) => (
                      <div key={feature.name} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {feature.name}
                      </div>
                    ))}
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => handlePlanUpgrade(plan.name as 'BASIC' | 'PRO' | 'ENTERPRISE')}
                    disabled={isUpdating || currentPlan?.name === plan.name}
                  >
                    {isUpdating ? 'Updating...' : 
                     currentPlan?.name === plan.name ? 'Current Plan' :
                     'Select Plan'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Subscription Management */}
      {subscription?.hasActiveSubscription && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <CreditCard className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Actions that will affect this workspace and all its members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive" 
              onClick={handleCancelSubscription}
              disabled={isUpdating}
            >
              {isUpdating ? 'Cancelling...' : 'Cancel Workspace Subscription'}
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              Cancelling will downgrade the workspace to free tier and affect all workspace members.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}