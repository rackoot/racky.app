import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
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
  previewWorkspaceSubscriptionChange,
  updateWorkspaceSubscription,
  cancelWorkspaceSubscription,
  type WorkspaceSubscription,
  type WorkspaceUsage,
  type SubscriptionPreview 
} from "@/services/workspace"
import { subscriptionApi } from "@/api/subscription"
import { SubscriptionChangeModal } from "@/components/workspace/subscription-change-modal"
import { SuccessModal } from "@/components/ui/success-modal"
import { useNavigate } from "react-router-dom"
import { Slider } from "@/components/ui/slider"
import { CancelledSubscriptionView } from "@/components/workspace/cancelled-subscription-view"

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
  const [selectedPlan, setSelectedPlan] = useState<string>('')
  const [contributorCount, setContributorCount] = useState([1])
  const [subscriptionPreview, setSubscriptionPreview] = useState<SubscriptionPreview | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [successTitle, setSuccessTitle] = useState('Success!')
  const [errorMessage, setErrorMessage] = useState('')
  const [showErrorAlert, setShowErrorAlert] = useState(false)
  const [isCancellingDowngrade, setIsCancellingDowngrade] = useState(false)
  const [showCancelDowngradeModal, setShowCancelDowngradeModal] = useState(false)

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

  // Initialize form values when subscription data is loaded
  useEffect(() => {
    if (subscription) {
      setSelectedPlan(subscription.currentPlan?.name || 'JUNIOR')
      setBillingCycle(subscription.billingCycle)
      setContributorCount([subscription.contributorCount])
    }
  }, [subscription])

  // Helper functions for notifications
  const showSuccess = (title: string, message: string) => {
    setSuccessTitle(title)
    setSuccessMessage(message)
    setShowSuccessModal(true)
  }

  const showError = (message: string) => {
    setErrorMessage(message)
    setShowErrorAlert(true)
    setTimeout(() => setShowErrorAlert(false), 5000) // Auto-hide after 5 seconds
  }

  const handleSubscriptionPreview = async () => {
    if (!currentWorkspace || !selectedPlan || isPreviewLoading) return

    try {
      setIsPreviewLoading(true)
      const preview = await previewWorkspaceSubscriptionChange(currentWorkspace._id, {
        planName: selectedPlan as 'JUNIOR' | 'SENIOR',
        billingCycle,
        contributorCount: contributorCount[0]
      })
      
      setSubscriptionPreview(preview)
      setShowConfirmModal(true)
    } catch (error) {
      console.error('Error previewing subscription changes:', error)
      showError(error instanceof Error ? error.message : 'Failed to preview subscription changes')
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const handleConfirmSubscriptionChange = async () => {
    if (!currentWorkspace || !selectedPlan || isUpdating) return

    try {
      setIsUpdating(true)
      const result = await updateWorkspaceSubscription(currentWorkspace._id, {
        planName: selectedPlan as 'JUNIOR' | 'SENIOR',
        billingCycle,
        contributorCount: contributorCount[0]
      })
      
      console.log('Subscription update result:', result)
      
      // Close confirmation modal first
      setShowConfirmModal(false)
      
      // Reload subscription data
      await loadSubscriptionData()
      
      // Determine success message based on change type
      const plan = availablePlans.find(p => p.name === selectedPlan)
      const isUpgrade = subscriptionPreview?.pricing.isUpgrade
      const isDowngrade = subscriptionPreview?.pricing.isDowngrade
      
      let title = 'Subscription Updated!'
      let message = `Your workspace subscription has been updated to ${plan?.displayName} with ${contributorCount[0]} contributor${contributorCount[0] > 1 ? 's' : ''}.`
      
      if (isUpgrade) {
        title = 'Upgrade Complete!'
        message = `Successfully upgraded to ${plan?.displayName}! The changes are effective immediately and you'll be charged the prorated amount.`
      } else if (isDowngrade) {
        title = 'Downgrade Scheduled!'
        message = `Your downgrade to ${plan?.displayName} has been scheduled for the next billing period. You'll keep your current features until then.`
      }
      
      showSuccess(title, message)
      
    } catch (error) {
      console.error('Error updating subscription:', error)
      showError(error instanceof Error ? error.message : 'Failed to update subscription')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancelDowngradeClick = () => {
    if (!currentWorkspace || !subscription?.scheduledDowngrade || isCancellingDowngrade) return
    setShowCancelDowngradeModal(true)
  }

  const handleConfirmCancelDowngrade = async () => {
    if (!currentWorkspace || !subscription?.scheduledDowngrade || isCancellingDowngrade) return

    try {
      setIsCancellingDowngrade(true)
      await subscriptionApi.cancelScheduledDowngrade(currentWorkspace._id)
      
      // Close the modal first
      setShowCancelDowngradeModal(false)
      
      // Reload subscription data to reflect the cancellation
      await loadSubscriptionData()
      showSuccess('Downgrade Cancelled', 'Your scheduled downgrade has been cancelled successfully. You will remain on your current plan.')
    } catch (error) {
      console.error('Error cancelling scheduled downgrade:', error)
      showError(error instanceof Error ? error.message : 'Failed to cancel scheduled downgrade')
    } finally {
      setIsCancellingDowngrade(false)
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
      
      await loadSubscriptionData()
      showSuccess('Subscription Cancelled', 'Your workspace subscription has been cancelled successfully. The workspace will be downgraded to the free tier.')
    } catch (error) {
      console.error('Error cancelling subscription:', error)
      showError(error instanceof Error ? error.message : 'Failed to cancel subscription')
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

  // Check if subscription is cancelled and show appropriate view
  if (subscription?.subscription.status === 'CANCELLED') {
    return (
      <CancelledSubscriptionView
        workspaceName={currentWorkspace.name}
        workspaceId={currentWorkspace._id}
        cancelledAt={subscription.subscription.cancelledAt}
        cancellationReason={subscription.subscription.cancellationReason}
        onReactivate={loadSubscriptionData}
      />
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
  
  // Helper functions to format prices correctly (convert from cents to dollars)
  const formatPrice = (cents: number) => (cents / 100).toFixed(0)
  const formatYearlyPrice = (cents: number) => (cents / 100 / 12).toFixed(0)
  
  // Check if there are any changes from current subscription
  const hasChanges = subscription && (
    selectedPlan !== subscription.currentPlan?.name ||
    billingCycle !== subscription.billingCycle ||
    contributorCount[0] !== subscription.contributorCount
  )

  return (
    <div className="container max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Workspace Subscription</h1>
        <p className="text-muted-foreground">
          Manage subscription for <strong>{currentWorkspace.name}</strong> workspace
        </p>
      </div>

      {/* Scheduled Downgrade Alert */}
      {subscription?.scheduledDowngrade && (
        <Card className="mb-8 border-orange-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-orange-600 mt-0.5" />
              </div>
              <div className="flex-grow">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-orange-900">Downgrade Scheduled</h3>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(subscription.scheduledDowngrade.effectiveDate).toLocaleDateString()}
                  </Badge>
                </div>
                <p className="text-orange-800 mb-4">
                  Your workspace will downgrade from <strong>{subscription.currentPlan?.displayName}</strong> ({subscription.contributorCount} contributor{subscription.contributorCount > 1 ? 's' : ''}) to <strong>{subscription.scheduledDowngrade.planDisplayName}</strong> ({subscription.scheduledDowngrade.contributorCount} contributor{subscription.scheduledDowngrade.contributorCount > 1 ? 's' : ''}) on {new Date(subscription.scheduledDowngrade.effectiveDate).toLocaleDateString('en-US', { 
                    weekday: 'long',
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}.
                </p>
                <div className="flex gap-3">
                  <Button 
                    onClick={handleCancelDowngradeClick}
                    disabled={isCancellingDowngrade}
                    variant="outline"
                    className="border-orange-300 text-orange-700 hover:bg-orange-100"
                  >
                    {isCancellingDowngrade ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                        Cancelling...
                      </div>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Cancel Downgrade
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-orange-700 hover:text-orange-900 hover:bg-orange-100"
                    onClick={() => {
                      // Scroll to the manage subscription section
                      document.getElementById('manage-subscription')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    Learn More
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
            {subscription && subscription.contributorCount > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {subscription.contributorCount} contributor{subscription.contributorCount > 1 ? 's' : ''}
              </p>
            )}
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
            <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subscription ? `$${subscription.currentMonthlyPrice.toFixed(0)}` : '$0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Current monthly cost
            </p>
            {subscription && subscription.totalMonthlyActions > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {subscription.totalMonthlyActions.toLocaleString()} actions/month
              </p>
            )}
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

      {/* Subscription Manager */}
      <Card id="manage-subscription">
        <CardHeader>
          <CardTitle>Manage Subscription</CardTitle>
          <CardDescription>
            Update your workspace plan and contributor count
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plan Selection */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Plan Selection</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {availablePlans.map((plan) => {
                const isExecutive = plan.contributorType === 'EXECUTIVE';
                const isSelectable = !isExecutive;
                
                return (
                  <Card 
                    key={plan.name} 
                    className={`relative transition-all ${
                      isExecutive 
                        ? 'cursor-not-allowed opacity-75' 
                        : `cursor-pointer ${selectedPlan === plan.name ? 'ring-2 ring-primary' : 'hover:shadow-md'}`
                    }`}
                    onClick={isSelectable ? () => setSelectedPlan(plan.name) : undefined}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h5 className="font-semibold">{plan.displayName}</h5>
                          <div className="text-2xl font-bold">
                            {isExecutive ? (
                              <span className="text-muted-foreground">Contact Sales</span>
                            ) : (
                              <>
                                ${billingCycle === 'monthly' ? formatPrice(plan.monthlyPrice) : formatYearlyPrice(plan.yearlyPrice)}
                                <span className="text-xs text-muted-foreground">
                                  /contributor/{billingCycle === 'monthly' ? 'month' : 'year'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {currentPlan?.name === plan.name && (
                          <Badge variant="secondary" className="text-xs">Current</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">
                        {isExecutive ? 'Unlimited actions per contributor' : `${plan.limits.apiCallsPerMonth.toLocaleString()} actions per contributor`}
                      </div>
                      
                      {isExecutive && (
                        <Button 
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open('https://forms.monday.com/forms/226e77aa9d94bc45ae4ec3dd8518b5c0?r=use1', '_blank');
                          }}
                        >
                          Contact Sales
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Billing Cycle */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Billing Cycle</h4>
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
                <Badge variant="secondary" className="ml-2 text-xs">
                  Save 17%
                </Badge>
              </Button>
            </div>
          </div>

          {/* Contributor Count */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium">Number of Contributors</h4>
              <span className="text-2xl font-bold">{contributorCount[0]}</span>
            </div>
            <Slider
              value={contributorCount}
              onValueChange={setContributorCount}
              max={selectedPlan ? availablePlans.find(p => p.name === selectedPlan)?.limits.maxStores || 5 : 5}
              min={1}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 contributor</span>
              <span>{selectedPlan ? availablePlans.find(p => p.name === selectedPlan)?.limits.maxStores || 5 : 5} contributors max</span>
            </div>
          </div>

          {/* Preview */}
          {selectedPlan && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Selected plan:</span>
                <span className="font-medium">{availablePlans.find(p => p.name === selectedPlan)?.displayName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Contributors:</span>
                <span className="font-medium">{contributorCount[0]}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total monthly actions:</span>
                <span className="font-medium">
                  {((availablePlans.find(p => p.name === selectedPlan)?.limits.apiCallsPerMonth || 0) * contributorCount[0]).toLocaleString()}
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="text-lg font-semibold">Estimated Monthly Cost:</span>
                <span className="text-2xl font-bold text-primary">
                  ${billingCycle === 'annual' ? 
                    ((availablePlans.find(p => p.name === selectedPlan)?.yearlyPrice || 0) * contributorCount[0] / 100 / 12).toFixed(0) :
                    ((availablePlans.find(p => p.name === selectedPlan)?.monthlyPrice || 0) * contributorCount[0] / 100).toFixed(0)
                  }
                </span>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex gap-2">
            <Button 
              onClick={handleSubscriptionPreview}
              disabled={!selectedPlan || !hasChanges || isPreviewLoading}
              className="flex-1"
            >
              {isPreviewLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  Calculating...
                </div>
              ) : (
                'Preview Changes'
              )}
            </Button>
          </div>

          {!hasChanges && subscription && (
            <div className="text-center text-sm text-muted-foreground">
              No changes detected from your current subscription
            </div>
          )}
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

      {/* Subscription Change Modal */}
      <SubscriptionChangeModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubscriptionChange}
        preview={subscriptionPreview}
        isLoading={isUpdating}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={successTitle}
        message={successMessage}
      />

      {/* Cancel Downgrade Confirmation Modal */}
      <Dialog open={showCancelDowngradeModal} onOpenChange={setShowCancelDowngradeModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Cancel Scheduled Downgrade
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              {subscription?.scheduledDowngrade && (
                <>
                  You are about to cancel your scheduled downgrade from{' '}
                  <strong>{subscription.currentPlan?.displayName}</strong> ({subscription.contributorCount} contributor{subscription.contributorCount > 1 ? 's' : ''}) to{' '}
                  <strong>{subscription.scheduledDowngrade.planDisplayName}</strong> ({subscription.scheduledDowngrade.contributorCount} contributor{subscription.scheduledDowngrade.contributorCount > 1 ? 's' : ''}).
                  <br /><br />
                  <strong>This means:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>You will remain on your current <strong>{subscription.currentPlan?.displayName}</strong> plan</li>
                    <li>Your billing will continue at the current rate</li>
                    <li>The downgrade scheduled for {new Date(subscription.scheduledDowngrade.effectiveDate).toLocaleDateString('en-US', { 
                      weekday: 'long',
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })} will be removed</li>
                  </ul>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowCancelDowngradeModal(false)}
              disabled={isCancellingDowngrade}
            >
              Keep Downgrade
            </Button>
            <Button
              onClick={handleConfirmCancelDowngrade}
              disabled={isCancellingDowngrade}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isCancellingDowngrade ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  Cancelling...
                </div>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Yes, Cancel Downgrade
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Alert */}
      {showErrorAlert && (
        <div className="fixed top-4 right-4 z-50 max-w-md p-4 bg-red-50 border border-red-200 rounded-lg shadow-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error
              </h3>
              <p className="mt-1 text-sm text-red-700">
                {errorMessage}
              </p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setShowErrorAlert(false)}
                className="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}