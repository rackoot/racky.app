import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  AlertTriangle,
  RefreshCcw,
  Crown,
  CheckCircle,
  Building
} from "lucide-react"
import { ContributorSelector } from "@/components/pricing/contributor-selector"
import { reactivateWorkspaceSubscription } from "@/services/workspace"

interface CancelledSubscriptionViewProps {
  workspaceName: string;
  workspaceId: string;
  cancelledAt?: string;
  cancellationReason?: string;
  onReactivate: () => void;
}

export function CancelledSubscriptionView({ 
  workspaceName,
  workspaceId,
  cancelledAt,
  cancellationReason,
  onReactivate 
}: CancelledSubscriptionViewProps) {
  const [showReactivation, setShowReactivation] = useState(false)

  const handleReactivationComplete = async () => {
    try {
      // Call the parent onReactivate callback to refresh the data
      onReactivate()
      
      // Hide the reactivation view 
      setShowReactivation(false)
    } catch (error) {
      console.error('Error handling reactivation completion:', error)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (showReactivation) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setShowReactivation(false)}
            className="mb-4"
          >
            ← Back to Status
          </Button>
          <h1 className="text-3xl font-bold mb-2">Reactivate Workspace Subscription</h1>
          <p className="text-muted-foreground">
            Choose a plan to reactivate subscription for <strong>{workspaceName}</strong>
          </p>
        </div>

        <ContributorSelector 
          showHeader={false}
          title="Choose Your Plan"
          description="Select the plan and number of contributors for your workspace"
          onSubscriptionComplete={handleReactivationComplete}
          isReactivation={true}
        />
      </div>
    )
  }

  return (
    <div className="container max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Workspace Subscription</h1>
        <p className="text-muted-foreground">
          Manage subscription for <strong>{workspaceName}</strong> workspace
        </p>
      </div>

      {/* Cancelled Status Alert */}
      <Card className="mb-8 border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
            </div>
            <div className="flex-grow">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold text-red-900">Subscription Cancelled</h3>
                <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Cancelled
                </Badge>
              </div>
              <p className="text-red-800 mb-4">
                This workspace subscription was cancelled on <strong>{formatDate(cancelledAt)}</strong>.
                {cancellationReason && (
                  <> Reason: <em>{cancellationReason}</em></>
                )}
              </p>
              <div className="space-y-3 text-red-700 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Your workspace data is preserved and secure</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>All existing connections and products remain intact</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>You can reactivate at any time with a new subscription</span>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button 
                  onClick={() => setShowReactivation(true)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Reactivate Subscription
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">None</div>
            <div className="mt-2">
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Cancelled
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancellation Date</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cancelledAt 
                ? new Date(cancelledAt).toLocaleDateString()
                : 'Unknown'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Subscription was cancelled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0</div>
            <p className="text-xs text-muted-foreground">
              No active subscription
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reactivation Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5" />
            Reactivate Your Subscription
          </CardTitle>
          <CardDescription>
            Get back to managing your marketplace operations with a new subscription
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              • Choose from Junior Contributors ($29/month) or Senior Contributors ($79/month)
            </p>
            <p>
              • All your existing workspace data, connections, and products are preserved
            </p>
            <p>
              • Start with a 14-day free trial on any plan
            </p>
            <p>
              • Cancel anytime without losing your data
            </p>
          </div>
          
          <div className="pt-4">
            <Button 
              onClick={() => setShowReactivation(true)}
              size="lg"
              className="w-full bg-primary hover:bg-primary/90"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Choose Your Plan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}