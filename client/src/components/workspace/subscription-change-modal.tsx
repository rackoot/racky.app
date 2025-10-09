import React from "react"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Zap,
  AlertTriangle,
  CheckCircle,
  ArrowRight
} from "lucide-react"
import { SubscriptionPreview } from "@/api"

interface SubscriptionChangeModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  preview: SubscriptionPreview | null
  isLoading: boolean
}

export function SubscriptionChangeModal({
  isOpen,
  onClose,
  onConfirm,
  preview,
  isLoading
}: SubscriptionChangeModalProps) {
  if (!preview) return null

  const { changes, current, new: newSubscription, pricing } = preview

  const getChangeIcon = () => {
    if (pricing.isUpgrade) return <TrendingUp className="w-5 h-5 text-green-600" />
    if (pricing.isDowngrade) return <TrendingDown className="w-5 h-5 text-orange-600" />
    return <CheckCircle className="w-5 h-5 text-blue-600" />
  }

  const getChangeColor = () => {
    if (pricing.isUpgrade) return 'bg-green-50 border-green-200'
    if (pricing.isDowngrade) return 'bg-orange-50 border-orange-200'
    return 'bg-blue-50 border-blue-200'
  }

  const formatPrice = (price: number) => {
    return `$${price.toFixed(0)}`
  }

  const formatActions = (actions: number) => {
    return actions.toLocaleString()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getChangeIcon()}
            Confirm Subscription Change
          </DialogTitle>
          <DialogDescription>
            Review the changes to your workspace subscription before confirming.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Change Summary */}
          <Card className={`border-2 ${getChangeColor()}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {pricing.timing === 'immediate' ? (
                    <Zap className="w-5 h-5 text-yellow-600" />
                  ) : (
                    <Clock className="w-5 h-5 text-blue-600" />
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">
                      {pricing.changeType === 'upgrade' && 'Subscription Upgrade'}
                      {pricing.changeType === 'downgrade' && 'Subscription Downgrade'}
                      {pricing.changeType === 'no_change' && 'Subscription Update'}
                    </h3>
                    <p className="text-sm text-muted-foreground">{pricing.message}</p>
                  </div>
                </div>
                {pricing.priceDifference > 0 && (
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {pricing.isUpgrade ? '+' : '-'}{formatPrice(pricing.priceDifference)}
                    </div>
                    <div className="text-xs text-muted-foreground">per month</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Comparison Table */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Changes Overview
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Current Subscription */}
              <Card>
                <CardContent className="p-4">
                  <h5 className="font-semibold mb-3 text-muted-foreground">Current</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Plan:</span>
                      <Badge variant="outline">{current.contributorType}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Contributors:</span>
                      <span className="font-medium">{current.contributorCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Billing:</span>
                      <span className="font-medium">{current.billingCycle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Actions/month:</span>
                      <span className="font-medium">{formatActions(current.totalActions)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm font-medium">Monthly Price:</span>
                      <span className="text-lg font-bold">{formatPrice(current.monthlyPrice)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* New Subscription */}
              <Card className="ring-2 ring-primary">
                <CardContent className="p-4">
                  <h5 className="font-semibold mb-3 text-primary">New</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Plan:</span>
                      <Badge className={changes.planChange ? 'bg-primary' : ''}>
                        {newSubscription.contributorType}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Contributors:</span>
                      <span className={`font-medium ${changes.contributorChange ? 'text-primary' : ''}`}>
                        {newSubscription.contributorCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Billing:</span>
                      <span className={`font-medium ${changes.billingCycleChange ? 'text-primary' : ''}`}>
                        {newSubscription.billingCycle}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Actions/month:</span>
                      <span className="font-medium">{formatActions(newSubscription.totalActions)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm font-medium">Monthly Price:</span>
                      <span className="text-lg font-bold text-primary">
                        {formatPrice(newSubscription.monthlyPrice)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Important Notes */}
          <div className="space-y-3">
            {pricing.isUpgrade && (
              <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                <Zap className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-green-800">Immediate Upgrade</p>
                  <p className="text-green-700">
                    The upgrade will take effect immediately. You'll be charged a prorated amount 
                    for the remainder of your current billing period.
                  </p>
                </div>
              </div>
            )}

            {pricing.isDowngrade && (
              <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <Clock className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-orange-800">Scheduled Downgrade</p>
                  <p className="text-orange-700">
                    The downgrade will take effect at your next billing period. You'll keep 
                    your current features until then.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-800">Workspace-wide Changes</p>
                <p className="text-blue-700">
                  This subscription change will affect all members of this workspace. 
                  Everyone will have access to the new plan features and limits.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                Updating...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                Confirm Changes
                <ArrowRight className="w-4 h-4" />
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}