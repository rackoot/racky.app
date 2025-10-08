import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  RefreshCw,
  Check,
  X,
  Clock,
  Loader2,
  Sparkles,
  AlertCircle
} from "lucide-react"
import type { Product } from "@/api"

interface CachedDescription {
  platform: string
  content: string
  confidence?: number
  keywords: string[]
  tokens?: number
  createdAt: string
  status: 'pending' | 'accepted' | 'rejected'
  _id?: string
}

interface DescriptionApprovalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onAction: (action: 'accept' | 'reject' | 'regenerate') => Promise<void>
}

export function DescriptionApprovalModal({
  open,
  onOpenChange,
  product,
  onAction
}: DescriptionApprovalModalProps) {
  const [actionInProgress, setActionInProgress] = useState<'accept' | 'reject' | 'regenerate' | null>(null)
  const [error, setError] = useState<string>("")

  if (!product) return null

  // Get the latest pending description for this product's marketplace
  const latestDescription = (product as any).cachedDescriptions
    ?.filter((desc: CachedDescription) => desc.platform === product.marketplace)
    .sort((a: CachedDescription, b: CachedDescription) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]

  if (!latestDescription) return null

  const handleAction = async (action: 'accept' | 'reject' | 'regenerate') => {
    setActionInProgress(action)
    setError("")

    try {
      await onAction(action)
      onOpenChange(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : `Failed to ${action} description`)
    } finally {
      setActionInProgress(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI Description Approval - {product.title}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <Badge
              variant={
                latestDescription.status === 'accepted' ? 'default' :
                latestDescription.status === 'rejected' ? 'destructive' :
                'secondary'
              }
              className={
                latestDescription.status === 'pending'
                  ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                  : ''
              }
            >
              {latestDescription.status === 'accepted' && <Check className="w-3 h-3 mr-1" />}
              {latestDescription.status === 'rejected' && <X className="w-3 h-3 mr-1" />}
              {latestDescription.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
              Status: {latestDescription.status === 'pending' ? 'Pending approval' : latestDescription.status.charAt(0).toUpperCase() + latestDescription.status.slice(1)}
            </Badge>
            {/* Confidence score - hidden but kept for future use */}
            {/* <div className="text-sm text-muted-foreground">
              Confidence: {Math.round((latestDescription.confidence || 0) * 100)}%
            </div> */}
          </div>

          {/* Comparison View */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current Description */}
            <div>
              <h4 className="font-medium mb-3 text-slate-700">Current Description:</h4>
              <div className="bg-slate-50 rounded-lg p-4 min-h-[200px] border border-slate-200">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {product.description || 'No description available'}
                </p>
              </div>
            </div>

            {/* AI Suggested Description */}
            <div>
              <h4 className="font-medium mb-3 text-blue-700 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                AI Suggested Description:
              </h4>
              <div className="bg-blue-50 rounded-lg min-h-[200px] border border-blue-200 overflow-hidden">
                <div className="p-4 space-y-3">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {latestDescription.content}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-blue-200">
                    <Clock className="w-3 h-3" />
                    <span>Generated {new Date(latestDescription.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            {latestDescription.status === 'pending' && (
              <>
                <Button
                  onClick={() => handleAction('accept')}
                  disabled={actionInProgress !== null}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {actionInProgress === 'accept' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  {actionInProgress === 'accept' ? 'Applying...' : 'Accept & Apply'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleAction('reject')}
                  disabled={actionInProgress !== null}
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </>
            )}
            <Button
              variant="outline"
              onClick={() => handleAction('regenerate')}
              disabled={actionInProgress !== null}
            >
              {actionInProgress === 'regenerate' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {actionInProgress === 'regenerate' ? 'Regenerating...' : 'Regenerate'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={actionInProgress !== null}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
