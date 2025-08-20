import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  TrendingUp
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
  const availablePlatforms = []
  
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

export function OptimizationTabs({ product }: OptimizationTabsProps) {
  const [activeOptimizationTab, setActiveOptimizationTab] = useState("seo")
  const [suggestions, setSuggestions] = useState<Record<string, OptimizationSuggestion | null>>({})
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
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

  const handleStatusUpdate = async (platform: string, suggestionId: string, status: 'accepted' | 'rejected') => {
    try {
      await optimizationsService.updateSuggestionStatus(product._id, platform, suggestionId, status)
      
      // Update local state
      setSuggestions(prev => ({
        ...prev,
        [platform]: prev[platform] ? { ...prev[platform], status } : null
      }))
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

      <Tabs value={activeOptimizationTab} onValueChange={setActiveOptimizationTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="seo">SEO and Engagement</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
        </TabsList>

        <TabsContent value="seo" className="space-y-6">
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
              {availablePlatforms.map((platform) => (
              <Card key={platform} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={platformColors[platform as keyof typeof platformColors]}>
                        {platformNames[platform as keyof typeof platformNames]}
                      </Badge>
                      <h3 className="font-semibold">Description Optimization</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadSuggestion(platform, false)}
                        disabled={loadingStates[platform]}
                      >
                        {loadingStates[platform] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Lightbulb className="w-4 h-4" />
                        )}
                        {suggestions[platform] ? 'Refresh' : 'Generate'}
                      </Button>
                      {suggestions[platform] && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadSuggestion(platform, true)}
                          disabled={loadingStates[platform]}
                        >
                          <RefreshCw className="w-4 h-4" />
                          Regenerate
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {errors[platform] && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{errors[platform]}</AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Before Column */}
                    <div>
                      <h4 className="font-medium mb-3 text-slate-700">Before</h4>
                      <div className="bg-slate-50 rounded-lg p-4 min-h-[200px]">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {product.description || 'No description available'}
                        </p>
                      </div>
                    </div>

                    {/* After Column */}
                    <div>
                      <h4 className="font-medium mb-3 text-blue-700">After (AI Optimized)</h4>
                      <div className="bg-blue-50 rounded-lg p-4 min-h-[200px] border border-blue-200">
                        {loadingStates[platform] ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                              <p className="text-sm text-blue-600">Generating optimization...</p>
                            </div>
                          </div>
                        ) : suggestions[platform] ? (
                          <div className="space-y-3">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {suggestions[platform]?.suggestedContent}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-blue-200">
                              <Clock className="w-3 h-3" />
                              <span>Generated {new Date(suggestions[platform]?.createdAt || '').toLocaleString()}</span>
                              <span>•</span>
                              <span>{suggestions[platform]?.metadata.confidence * 100}% confidence</span>
                              <span>•</span>
                              <span>{suggestions[platform]?.metadata.tokens} tokens</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center text-muted-foreground">
                              <Lightbulb className="w-8 h-8 mx-auto mb-2" />
                              <p className="text-sm">Click "Generate" to create AI optimization</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Column */}
                    <div>
                      <h4 className="font-medium mb-3 text-slate-700">Actions</h4>
                      <div className="space-y-3">
                        {suggestions[platform] && (
                          <>
                            <div className="text-sm">
                              <p className="text-muted-foreground mb-2">Status:</p>
                              <Badge 
                                variant={
                                  suggestions[platform]?.status === 'accepted' ? 'default' :
                                  suggestions[platform]?.status === 'rejected' ? 'destructive' :
                                  'secondary'
                                }
                              >
                                {suggestions[platform]?.status === 'accepted' && <Check className="w-3 h-3 mr-1" />}
                                {suggestions[platform]?.status === 'rejected' && <X className="w-3 h-3 mr-1" />}
                                {suggestions[platform]?.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                                {suggestions[platform]?.status}
                              </Badge>
                            </div>

                            {suggestions[platform]?.status === 'pending' && (
                              <div className="space-y-2">
                                <Button 
                                  size="sm" 
                                  className="w-full bg-green-600 hover:bg-green-700"
                                  onClick={() => handleStatusUpdate(platform, suggestions[platform]!.id, 'accepted')}
                                >
                                  <Check className="w-4 h-4 mr-2" />
                                  Accept & Apply
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="w-full border-red-300 text-red-600 hover:bg-red-50"
                                  onClick={() => handleStatusUpdate(platform, suggestions[platform]!.id, 'rejected')}
                                >
                                  <X className="w-4 h-4 mr-2" />
                                  Reject
                                </Button>
                              </div>
                            )}

                            {suggestions[platform]?.metadata.keywords && suggestions[platform]?.metadata.keywords.length > 0 && (
                              <div className="pt-3 border-t">
                                <p className="text-xs text-muted-foreground mb-2">Keywords:</p>
                                <div className="flex flex-wrap gap-1">
                                  {suggestions[platform]?.metadata.keywords.slice(0, 6).map((keyword, index) => (
                                    <Badge key={index} variant="outline" className="text-xs">
                                      {keyword}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Business Opportunities
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                AI-generated insights and recommendations to improve your product performance and sales.
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Opportunities Coming Soon</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  We're working on AI-powered business opportunity analysis. This feature will provide 
                  insights on pricing, market positioning, and growth opportunities.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}