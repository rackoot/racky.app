import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  RefreshCw,
  Check,
  X,
  Clock,
  AlertCircle,
  Loader2,
  Sparkles
} from "lucide-react"
import { optimizationsApi } from "@/api"
import type { ProductDetail } from "@/types/product"

interface DescriptionOptimizationProps {
  product: ProductDetail;
}

interface OptimizationSuggestion {
  id: string;
  suggestedContent: string;
  status: 'pending' | 'accepted' | 'rejected';
  confidence: number;
  createdAt: string;
}

export function DescriptionOptimization({ product }: DescriptionOptimizationProps) {
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string>("")
  const [suggestion, setSuggestion] = useState<OptimizationSuggestion | null>(null)

  const handleGenerateDescription = async () => {
    if (!product._id || !product.marketplace) {
      setError('Product or marketplace information is missing')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await optimizationsApi.getDescriptionOptimization(product._id, product.marketplace)

      if (result.suggestion) {
        setSuggestion({
          id: result.suggestion.id,
          suggestedContent: result.suggestion.suggestedContent,
          status: result.suggestion.status,
          confidence: result.suggestion.metadata.confidence,
          createdAt: result.suggestion.createdAt
        })
      } else {
        setError('Failed to generate description')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to generate description')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!suggestion) return

    setApplying(true)
    setError('')

    try {
      // Update status to accepted
      await optimizationsApi.updateSuggestionStatus(product._id, product.marketplace, suggestion.id, 'accepted')

      // Apply to store
      await optimizationsApi.applyDescriptionToStore(product._id, product.marketplace, suggestion.id)

      // Update local state
      setSuggestion({ ...suggestion, status: 'accepted' })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to accept description')
    } finally {
      setApplying(false)
    }
  }

  const handleReject = async () => {
    if (!suggestion) return

    try {
      await optimizationsApi.updateSuggestionStatus(product._id, product.marketplace, suggestion.id, 'rejected')
      setSuggestion({ ...suggestion, status: 'rejected' })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reject description')
    }
  }

  const handleRequestNew = async () => {
    if (!suggestion) return

    // Reject current suggestion
    try {
      await optimizationsApi.updateSuggestionStatus(product._id, product.marketplace, suggestion.id, 'rejected')
    } catch (error) {
      console.error('Failed to reject previous suggestion:', error)
    }

    // Clear current suggestion and generate new one
    setSuggestion(null)
    handleGenerateDescription()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI-Powered Description Optimization
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Generate AI-optimized product descriptions to improve SEO and conversion rates.
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
              <h3 className="text-lg font-semibold mb-2">Generating AI Description...</h3>
              <p className="text-muted-foreground">This usually takes a few seconds.</p>
            </div>
          )}

          {/* No Suggestion State */}
          {!loading && !suggestion && (
            <div className="text-center py-12 border-2 border-dashed border-muted-foreground/20 rounded-lg">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No AI Optimization Generated</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Generate an AI-optimized description for this product to improve SEO and conversion rates.
              </p>
              <Button onClick={handleGenerateDescription} size="lg">
                <Sparkles className="w-4 h-4 mr-2" />
                Generate AI Description
              </Button>
            </div>
          )}

          {/* Suggestion Available */}
          {!loading && suggestion && (
            <div className="space-y-6">
              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <Badge
                  variant={
                    suggestion.status === 'accepted' ? 'default' :
                    suggestion.status === 'rejected' ? 'destructive' :
                    'secondary'
                  }
                >
                  {suggestion.status === 'accepted' && <Check className="w-3 h-3 mr-1" />}
                  {suggestion.status === 'rejected' && <X className="w-3 h-3 mr-1" />}
                  {suggestion.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                  Status: {suggestion.status.charAt(0).toUpperCase() + suggestion.status.slice(1)}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  Confidence: {Math.round(suggestion.confidence * 100)}%
                </div>
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
                        {suggestion.suggestedContent}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-blue-200">
                        <Clock className="w-3 h-3" />
                        <span>Generated {new Date(suggestion.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                {suggestion.status === 'pending' && (
                  <>
                    <Button
                      onClick={handleAccept}
                      disabled={applying}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {applying ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      {applying ? 'Applying...' : 'Accept & Apply'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleReject}
                      disabled={applying}
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={handleRequestNew}
                  disabled={loading || applying}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Request New
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
