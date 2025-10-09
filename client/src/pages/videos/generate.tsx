import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useWorkspace } from "@/components/workspace/workspace-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getAuthHeaders } from "@/lib/utils"
import { Loader2, ArrowLeft, Sparkles, Package } from "lucide-react"
import { API_CONFIG, ENDPOINTS } from "@/api/config"
import { videosApi, type VideoTemplate, type VideoUsageStats } from "@/api"
import { VideoUsageProgress } from "@/components/videos/VideoUsageProgress"

interface ProductImage {
  url: string
  altText?: string
  _id?: string
}

interface Product {
  _id: string
  title: string
  description: string
  images: ProductImage[] // Array of image objects
  marketplace: string
  price: number
  currency: string
  externalId: string
}

const VIDEO_TEMPLATES = [
  { value: 'product_showcase' as VideoTemplate, label: 'Product Showcase', description: 'Classic product presentation with rotating views' },
  { value: 'human_usage' as VideoTemplate, label: 'Human Usage', description: 'Show the product being used by real people' },
  { value: 'store_display' as VideoTemplate, label: 'Store Display', description: 'Product displayed in a retail environment' },
  { value: 'lifestyle' as VideoTemplate, label: 'Lifestyle', description: 'Product integrated into daily life scenarios' },
  { value: 'technical_demo' as VideoTemplate, label: 'Technical Demo', description: 'Detailed demonstration of features and functionality' },
  { value: 'unboxing' as VideoTemplate, label: 'Unboxing', description: 'Engaging unboxing experience video' }
]

export function GenerateVideo() {
  const { currentWorkspace } = useWorkspace()
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<VideoTemplate>('product_showcase')
  const [customInstructions, setCustomInstructions] = useState("")
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [videoStats, setVideoStats] = useState<VideoUsageStats | null>(null)

  useEffect(() => {
    if (currentWorkspace) {
      loadProducts()
      loadVideoStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace])

  const loadProducts = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${ENDPOINTS.PRODUCTS.LIST}`, {
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        throw new Error("Failed to load products")
      }

      const data = await response.json()
      const productsList = data?.data?.products || []
      setProducts(productsList)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products")
    } finally {
      setLoading(false)
    }
  }

  const loadVideoStats = async () => {
    try {
      const stats = await videosApi.getUsageStats()
      setVideoStats(stats)
    } catch (err) {
      console.error('Failed to load video stats:', err)
    }
  }

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p._id === productId)
    if (product) {
      setSelectedProduct(product)
    }
  }

  const handleGenerateVideo = () => {
    if (!selectedProduct) {
      setNotification({ type: 'error', message: "Please select a product" })
      setTimeout(() => setNotification(null), 5000)
      return
    }

    // Show confirmation dialog
    setShowConfirmDialog(true)
  }

  const handleConfirmGeneration = async () => {
    setShowConfirmDialog(false)
    setGenerating(true)
    setNotification(null)

    try {
      // Create the video record
      const video = await videosApi.createVideo({
        productId: selectedProduct!._id,
        template: selectedTemplate,
        customInstructions: customInstructions.trim() || undefined
      })

      // Start the generation process
      await videosApi.generateVideo(video._id)

      // Navigate to videos page with flash message in URL
      navigate('/videos?generated=true')
    } catch (error) {
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : "Failed to generate video"
      })
      setTimeout(() => setNotification(null), 5000)
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500 mb-2">Error loading products</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <div className={`mb-6 p-4 rounded-lg border ${
          notification.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <p className="text-sm font-medium">{notification.message}</p>
        </div>
      )}

      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/videos')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Videos
        </Button>
        <h1 className="text-3xl font-bold">Generate AI Video</h1>
        <p className="text-muted-foreground mt-2">
          Create an AI-powered video for your product
        </p>
      </div>

      {/* Video Usage Progress */}
      <VideoUsageProgress />

      {products.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No products available</h3>
            <p className="text-muted-foreground mb-4">
              Please add products first before generating videos.
            </p>
            <Button onClick={() => navigate('/products')}>
              Go to Products
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column 1: Video Settings */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Video Settings</CardTitle>
                <CardDescription>Configure your AI video generation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="product">Select Product *</Label>
                  <Select
                    value={selectedProduct?._id || ""}
                    onValueChange={handleProductSelect}
                  >
                    <SelectTrigger id="product">
                      <SelectValue placeholder="Choose a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product._id} value={product._id}>
                          <div className="flex items-center gap-2">
                            <span>{product.title}</span>
                            <span className="text-xs text-muted-foreground">
                              ({product.marketplace})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template">Template *</Label>
                  <Select
                    value={selectedTemplate}
                    onValueChange={(value: VideoTemplate) => setSelectedTemplate(value)}
                  >
                    <SelectTrigger id="template" className="justify-start text-left [&>span]:text-left">
                      <SelectValue placeholder="Choose a video style" />
                    </SelectTrigger>
                    <SelectContent>
                      {VIDEO_TEMPLATES.map((template) => (
                        <SelectItem key={template.value} value={template.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{template.label}</span>
                            <span className="text-xs text-muted-foreground">{template.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instructions">Custom Instructions (Optional)</Label>
                  <Textarea
                    id="instructions"
                    placeholder="Describe specific requirements for your video (up to 500 characters)..."
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={4}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground">
                    {customInstructions.length}/500 characters
                  </p>
                </div>

                <div className="pt-4">
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleGenerateVideo}
                    disabled={!selectedProduct || generating}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generating Video...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Generate AI Video
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Column 2: Product Preview */}
          <div>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Product Preview</CardTitle>
                <CardDescription>Selected product information</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedProduct ? (
                  <div className="space-y-4">
                    {/* Product Images */}
                    <div className="space-y-2">
                      {selectedProduct.images && selectedProduct.images.length > 0 && (
                        <>
                          {/* Main image */}
                          <div className="flex justify-center">
                            <img
                              src={selectedProduct.images[0].url}
                              alt={selectedProduct.images[0].altText || selectedProduct.title}
                              className="w-[200px] h-[200px] object-contain rounded-lg border"
                              style={{ width: '200px', height: '200px' }}
                            />
                          </div>

                          {/* Additional images if available */}
                          {selectedProduct.images.length > 1 && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              {selectedProduct.images.slice(1, 5).map((image, index) => (
                                <img
                                  key={index}
                                  src={image.url}
                                  alt={image.altText || `${selectedProduct.title} - Image ${index + 2}`}
                                  className="w-[95px] h-[95px] object-contain rounded border"
                                  style={{ width: '95px', height: '95px' }}
                                />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground">Title</h3>
                        <p className="text-base">{selectedProduct.title}</p>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground">Description</h3>
                        <p className="text-sm">
                          {selectedProduct.description || "No description available"}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="text-sm font-semibold text-muted-foreground">Marketplace</h3>
                          <p className="text-sm capitalize">{selectedProduct.marketplace}</p>
                        </div>

                        {selectedProduct.price && (
                          <div>
                            <h3 className="text-sm font-semibold text-muted-foreground">Price</h3>
                            <p className="text-sm">
                              {selectedProduct.currency} {selectedProduct.price.toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground">Product ID</h3>
                        <p className="text-xs font-mono text-muted-foreground">
                          {selectedProduct.externalId}
                        </p>
                      </div>
                    </div>

                    {/* AI Video Info */}
                    <div className="mt-6 p-4 bg-muted rounded-lg">
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        AI Video Generation
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Our AI will create a professional product video featuring:
                      </p>
                      <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                        <li>• Dynamic product showcase</li>
                        <li>• Key features and benefits</li>
                        <li>• Professional voiceover</li>
                        <li>• Background music</li>
                        <li>• 30-60 second duration</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Select a product to see its preview
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Video Generation</DialogTitle>
            <DialogDescription>
              You're about to generate an AI video for <strong>{selectedProduct?.title}</strong> using the <strong>{selectedTemplate.replace('_', ' ')}</strong> template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {videoStats && (
              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-medium mb-2">Video Usage</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Videos used this period:</span>
                    <span className="font-medium">{videoStats.used} / {videoStats.limit}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Remaining videos:</span>
                    <span className={`font-medium ${videoStats.remaining === 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {videoStats.remaining}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Generation Time</h4>
                  <p className="text-sm text-blue-700">
                    Video generation typically takes up to <strong>2 minutes</strong>. You'll be redirected to the videos page where you can monitor the progress.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={generating}>
              Cancel
            </Button>
            <Button onClick={handleConfirmGeneration} disabled={generating || (videoStats?.remaining === 0)}>
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Video
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}