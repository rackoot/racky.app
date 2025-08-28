import { useState, useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Lightbulb, 
  RefreshCw, 
  Check, 
  X, 
  Clock, 
  AlertCircle,
  Loader2,
  Sparkles,
  Zap,
  Timer,
  Crown
} from "lucide-react"
import { optimizationsService, type OptimizationSuggestion } from "@/services/optimizations"
import type { ProductDetail } from "@/types/product"

const platformColors = {
  shopify: 'bg-green-100 text-green-800 border-green-200',
  amazon: 'bg-orange-100 text-orange-800 border-orange-200',
  mercadolibre: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  woocommerce: 'bg-purple-100 text-purple-800 border-purple-200',
  vtex: 'bg-red-100 text-red-800 border-red-200',
  facebook_shop: 'bg-blue-100 text-blue-800 border-blue-200',
  google_shopping: 'bg-red-100 text-red-800 border-red-200'
}

const platformNames = {
  shopify: 'Shopify',
  amazon: 'Amazon',
  mercadolibre: 'MercadoLibre',
  woocommerce: 'WooCommerce', 
  vtex: 'VTEX',
  facebook_shop: 'Facebook Shop',
  google_shopping: 'Google Shopping'
}

// Get platforms available for this product
const getAvailablePlatforms = (product: ProductDetail) => {
  const availablePlatforms: string[] = []
  
  // Add the primary marketplace
  if (product.marketplace) {
    availablePlatforms.push(product.marketplace)
  }
  
  // Add any additional platforms from the platforms array
  if (product.platforms) {
    Object.keys(product.platforms).forEach(platform => {
      if (!availablePlatforms.includes(platform)) {
        availablePlatforms.push(platform)
      }
    })
  }
  
  // Filter to only supported platforms for description generation
  const supportedPlatforms = ['shopify', 'amazon', 'mercadolibre', 'woocommerce', 'vtex', 'facebook_shop', 'google_shopping']
  return availablePlatforms.filter(platform => supportedPlatforms.includes(platform))
}

interface OptimizationTabsProps {
  product: ProductDetail;
}

// Simulate different AI optimization states for demonstration
type AIOptimizationState = 'available' | 'processing' | 'queued' | 'none'

const getAIOptimizationState = (product: ProductDetail, platform: string, suggestion: OptimizationSuggestion | null): AIOptimizationState => {
  if (suggestion) return 'available'
  // For demo purposes, simulate different states based on platform
  if (platform === 'shopify') return 'processing'
  if (platform === 'amazon') return 'queued' 
  return 'none'
}

export function OptimizationTabs({ product }: OptimizationTabsProps) {
  const navigate = useNavigate()
  const [suggestions, setSuggestions] = useState<Record<string, OptimizationSuggestion | null>>({})
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [queuePosition] = useState<Record<string, number>>({ amazon: 1247 }) // Mock queue data
  const hasLoadedCachedDescriptions = useRef(false)
  
  // Get platforms available for this specific product (memoized to prevent infinite loops)
  const availablePlatforms = useMemo(() => getAvailablePlatforms(product), [product.marketplace, product.platforms])

  // Load existing cached descriptions on mount (only once per product)
  useEffect(() => {
    const loadCachedDescriptions = async () => {
      if (hasLoadedCachedDescriptions.current) return
      
      hasLoadedCachedDescriptions.current = true
      
      for (const platform of availablePlatforms) {
        try {
          const result = await optimizationsService.getDescriptionOptimization(product._id, platform)
          if (result.cached) {
            setSuggestions(prev => ({ ...prev, [platform]: result.suggestion }))
          }
        } catch (error) {
          // Silently fail for platforms without cached descriptions
          console.debug(`No cached description for ${platform}:`, error)
        }
      }
    }

    if (availablePlatforms.length > 0 && !hasLoadedCachedDescriptions.current) {
      loadCachedDescriptions()
    }
  }, [product._id, availablePlatforms])

  // Reset the flag when product changes
  useEffect(() => {
    hasLoadedCachedDescriptions.current = false
    setSuggestions({})
  }, [product._id])

  const loadSuggestion = async (platform: string, forceRegenerate = false) => {
    setLoadingStates(prev => ({ ...prev, [platform]: true }))
    setErrors(prev => ({ ...prev, [platform]: '' }))

    try {
      const result = forceRegenerate 
        ? await optimizationsService.regenerateDescriptionOptimization(product._id, platform)
        : await optimizationsService.getDescriptionOptimization(product._id, platform)
      
      setSuggestions(prev => ({ ...prev, [platform]: result.suggestion }))
    } catch (error) {
      setErrors(prev => ({ 
        ...prev, 
        [platform]: error instanceof Error ? error.message : 'Failed to load suggestion'
      }))
    } finally {
      setLoadingStates(prev => ({ ...prev, [platform]: false }))
    }
  }

  // Navigate to bulk optimization page with filters
  const handleBulkOptimization = (platform?: string) => {
    const searchParams = new URLSearchParams()
    if (platform) {
      searchParams.set('marketplace', platform)
    }
    if (product.productType) {
      searchParams.set('category', product.productType)
    }
    navigate(`/ai-optimization?${searchParams.toString()}`)
  }

  // Navigate to view all marketplaces for this product
  const handleViewAllMarketplaces = () => {
    const searchParams = new URLSearchParams()
    searchParams.set('productId', product._id)
    navigate(`/ai-optimization?${searchParams.toString()}`)
  }

  // Handle individual product optimization
  const handleIndividualOptimization = async (platform: string) => {
    try {
      setLoadingStates(prev => ({ ...prev, [`${platform}_individual`]: true }))
      setErrors(prev => ({ ...prev, [platform]: '' }))

      const result = await optimizationsService.startIndividualOptimization(product._id, platform)
      
      // Start polling for results
      const pollInterval = setInterval(async () => {
        try {
          const status = await optimizationsService.getOptimizationJobStatus(result.jobId)
          
          if (status.status === 'completed') {
            clearInterval(pollInterval)
            // Refresh suggestions to get the new optimization
            await loadSuggestion(platform, false)
            setLoadingStates(prev => ({ ...prev, [`${platform}_individual`]: false }))
          } else if (status.status === 'failed') {
            clearInterval(pollInterval)
            setErrors(prev => ({ ...prev, [platform]: 'Individual optimization failed' }))
            setLoadingStates(prev => ({ ...prev, [`${platform}_individual`]: false }))
          }
        } catch (error) {
          // Continue polling on status check errors
        }
      }, 5000) // Poll every 5 seconds
      
      // Stop polling after 10 minutes
      setTimeout(() => {
        clearInterval(pollInterval)
        setLoadingStates(prev => ({ ...prev, [`${platform}_individual`]: false }))
      }, 600000)
      
    } catch (error) {
      setErrors(prev => ({ 
        ...prev, 
        [platform]: error instanceof Error ? error.message : 'Failed to start individual optimization'
      }))
      setLoadingStates(prev => ({ ...prev, [`${platform}_individual`]: false }))
    }
  }

  const handleStatusUpdate = async (platform: string, suggestionId: string, status: 'accepted' | 'rejected') => {
    try {
      if (status === 'accepted') {
        // First update the status
        await optimizationsService.updateSuggestionStatus(product._id, platform, suggestionId, status)
        
        // Then apply the description to the connected store
        setLoadingStates(prev => ({ ...prev, [`${platform}_apply`]: true }))
        
        try {
          const result = await optimizationsService.applyDescriptionToStore(product._id, platform, suggestionId)
          
          // Update local state with success
          setSuggestions(prev => ({
            ...prev,
            [platform]: prev[platform] ? { 
              ...prev[platform], 
              status,
              storeUpdateResult: result 
            } : null
          }))
          
          // Clear any previous errors
          setErrors(prev => ({ ...prev, [platform]: '' }))
          
        } catch (storeError) {
          // Update status but show store update error
          setSuggestions(prev => ({
            ...prev,
            [platform]: prev[platform] ? { 
              ...prev[platform], 
              status,
              storeUpdateResult: { 
                success: false, 
                message: storeError instanceof Error ? storeError.message : 'Failed to update store'
              }
            } : null
          }))
          setErrors(prev => ({ 
            ...prev, 
            [platform]: `Description accepted but store update failed: ${storeError instanceof Error ? storeError.message : 'Unknown error'}`
          }))
        } finally {
          setLoadingStates(prev => ({ ...prev, [`${platform}_apply`]: false }))
        }
      } else {
        // For rejected status, just update the status
        await optimizationsService.updateSuggestionStatus(product._id, platform, suggestionId, status)
        
        // Update local state
        setSuggestions(prev => ({
          ...prev,
          [platform]: prev[platform] ? { ...prev[platform], status } : null
        }))
      }
    } catch (error) {
      setErrors(prev => ({ 
        ...prev, 
        [platform]: error instanceof Error ? error.message : 'Failed to update suggestion'
      }))
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI-Powered Content Optimization
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Generate platform-specific content optimizations using AI to improve your product performance across different marketplaces.
          </p>
        </CardHeader>
      </Card>

      {availablePlatforms.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Platforms Available</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              This product is not available on any platforms that support description optimization.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {availablePlatforms.map((platform) => {
            const aiState = getAIOptimizationState(product, platform, suggestions[platform])
            const suggestion = suggestions[platform]
            
            return (
          <Card key={platform} className="overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge className={platformColors[platform as keyof typeof platformColors]}>
                    {platformNames[platform as keyof typeof platformNames]}
                  </Badge>
                  <h3 className="font-semibold">AI Optimization</h3>
                  {/* AI State Indicator */}
                  {aiState === 'available' && suggestion && (
                    <Badge variant="default" className="bg-blue-100 text-blue-800">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Suggestion Available
                    </Badge>
                  )}
                  {aiState === 'processing' && (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Processing
                    </Badge>
                  )}
                  {aiState === 'queued' && (
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                      <Timer className="w-3 h-3 mr-1" />
                      Queued
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {aiState === 'available' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadSuggestion(platform, false)}
                        disabled={loadingStates[platform]}
                      >
                        {loadingStates[platform] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        Refresh
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadSuggestion(platform, true)}
                        disabled={loadingStates[platform]}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Regenerate
                      </Button>
                    </>
                  )}
                  {(aiState === 'processing' || aiState === 'queued' || aiState === 'none') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadSuggestion(platform, false)}
                      disabled={loadingStates[platform] || aiState === 'processing'}
                    >
                      {loadingStates[platform] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Lightbulb className="w-4 h-4" />
                      )}
                      {aiState === 'processing' ? 'Processing...' : 'Generate'}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {errors[platform] && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>{errors[platform]}</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => loadSuggestion(platform, false)}
                      className="ml-4"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Render different UI states based on AI optimization state */}
              {aiState === 'available' && suggestion && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Before Column */}
                  <div>
                    <h4 className="font-medium mb-3 text-slate-700">Current Description ({platformNames[platform as keyof typeof platformNames]}):</h4>
                    <div className="bg-slate-50 rounded-lg p-4 min-h-[200px]">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {product.description || 'No description available'}
                      </p>
                    </div>
                  </div>

                  {/* After Column */}
                  <div>
                    <h4 className="font-medium mb-3 text-blue-700 flex items-center gap-2">
                      💡 AI Suggested Description ({platformNames[platform as keyof typeof platformNames]}):
                      <Badge variant="outline" className="text-xs">
                        Score: {Math.round((suggestion.metadata.confidence || 0) * 100)}%
                      </Badge>
                    </h4>
                    <div className="bg-blue-50 rounded-lg min-h-[200px] border border-blue-200 overflow-hidden">
                      {/* Platform Preview Header */}
                      <div className={`px-3 py-2 text-xs font-medium border-b ${platformColors[platform as keyof typeof platformColors]} bg-opacity-30`}>
                        {platform === 'amazon' && '📦 Amazon Product Description Preview'}
                        {platform === 'shopify' && '🛍️ Shopify Product Details Preview'}
                        {platform === 'mercadolibre' && '🏪 MercadoLibre Descripción Preview'}
                        {platform === 'vtex' && '🏢 VTEX Product Information Preview'}
                        {platform === 'woocommerce' && '🛒 WooCommerce Description Preview'}
                        {platform === 'facebook_shop' && '📱 Facebook Shop Details Preview'}
                        {platform === 'google_shopping' && '🔍 Google Shopping Description Preview'}
                        {!['amazon', 'shopify', 'mercadolibre', 'vtex', 'woocommerce', 'facebook_shop', 'google_shopping'].includes(platform) && '🌐 Marketplace Description Preview'}
                      </div>
                      
                      <div className="p-4 space-y-3">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {suggestion.suggestedContent}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-blue-200">
                          <Clock className="w-3 h-3" />
                          <span>Generated {new Date(suggestion.createdAt).toLocaleString()}</span>
                          <span>•</span>
                          <span>{Math.round((suggestion.metadata.confidence || 0) * 100)}% confidence</span>
                          <span>•</span>
                          <span>{suggestion.metadata.tokens} tokens</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div>
                    <h4 className="font-medium mb-3 text-slate-700">Actions</h4>
                    <div className="space-y-3">
                      <div className="text-sm">
                        <p className="text-muted-foreground mb-2">Status:</p>
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
                          {suggestion.status}
                        </Badge>
                      </div>

                      {suggestion.status === 'pending' && (
                        <div className="space-y-2">
                          <Button 
                            size="sm" 
                            className="w-full bg-green-600 hover:bg-green-700"
                            onClick={() => handleStatusUpdate(platform, suggestion.id, 'accepted')}
                            disabled={loadingStates[`${platform}_apply`]}
                          >
                            {loadingStates[`${platform}_apply`] ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4 mr-2" />
                            )}
                            {loadingStates[`${platform}_apply`] ? 'Applying to Store...' : 'Accept & Apply'}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full border-red-300 text-red-600 hover:bg-red-50"
                            onClick={() => handleStatusUpdate(platform, suggestion.id, 'rejected')}
                            disabled={loadingStates[`${platform}_apply`]}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      )}

                      {suggestion.status === 'accepted' && (suggestion as any)?.storeUpdateResult && (
                        <div className="pt-3 border-t">
                          <p className="text-xs text-muted-foreground mb-2">Store Update:</p>
                          <div className={`p-2 rounded text-xs ${
                            (suggestion as any).storeUpdateResult.success 
                              ? 'bg-green-50 text-green-700 border border-green-200' 
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {(suggestion as any).storeUpdateResult.message}
                          </div>
                        </div>
                      )}

                      {suggestion.metadata.keywords && suggestion.metadata.keywords.length > 0 && (
                        <div className="pt-3 border-t">
                          <p className="text-xs text-muted-foreground mb-2">Keywords:</p>
                          <div className="flex flex-wrap gap-1">
                            {suggestion.metadata.keywords.slice(0, 6).map((keyword, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Processing State */}
              {aiState === 'processing' && (
                <div className="bg-orange-50 rounded-lg p-8 border border-orange-200">
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-orange-600" />
                    <h3 className="text-lg font-semibold mb-2 text-orange-800">🔄 AI Optimization in Progress</h3>
                    <p className="text-orange-700 mb-4">
                      We're generating optimized descriptions for this product.<br />
                      This usually takes 2-5 minutes.
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh Status
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-orange-600 hover:bg-orange-700"
                        onClick={() => handleIndividualOptimization(platform)}
                        disabled={loadingStates[`${platform}_individual`]}
                      >
                        {loadingStates[`${platform}_individual`] ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Crown className="w-4 h-4 mr-2" />
                        )}
                        Priority Queue (Pro Feature)
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Queued State */}
              {aiState === 'queued' && (
                <div className="bg-yellow-50 rounded-lg p-8 border border-yellow-200">
                  <div className="text-center">
                    <Timer className="w-12 h-12 mx-auto mb-4 text-yellow-600" />
                    <h3 className="text-lg font-semibold mb-2 text-yellow-800">⏳ Queued for AI Optimization</h3>
                    <div className="text-yellow-700 mb-4">
                      <p className="mb-2">Position in queue: <strong>{queuePosition[platform] || 0} products ahead</strong></p>
                      <p>Estimated time: <strong>3-4 hours</strong></p>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Button 
                        size="sm" 
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleIndividualOptimization(platform)}
                        disabled={loadingStates[`${platform}_individual`]}
                      >
                        {loadingStates[`${platform}_individual`] ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4 mr-2" />
                        )}
                        Start Individual Optimization (Pro)
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleBulkOptimization(platform)}
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Bulk Optimization
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* No Suggestion State */}
              {aiState === 'none' && !loadingStates[platform] && (
                <div className="bg-slate-50 rounded-lg p-8 border border-slate-200">
                  <div className="text-center text-muted-foreground">
                    <Lightbulb className="w-12 h-12 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">AI Optimization Available</h3>
                    <p className="mb-4">Generate an AI-optimized description for this product on {platformNames[platform as keyof typeof platformNames]}.</p>
                    <Button onClick={() => loadSuggestion(platform, false)}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate AI Optimization
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}