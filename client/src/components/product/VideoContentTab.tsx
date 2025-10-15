import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  RefreshCw,
  Check,
  Loader2,
  Sparkles,
  Video,
  Image,
  ExternalLink,
  AlertCircle
} from "lucide-react"
import type { ProductDetail } from "@/types/product"
import { VideoTemplateModal } from "@/components/videos/video-template-modal"

interface VideoContentTabProps {
  product: ProductDetail;
}

export function VideoContentTab({ product }: VideoContentTabProps) {
  const hasImages = product.images && product.images.length > 0
  const [showTemplateModal, setShowTemplateModal] = useState(false)

  // Get latest video
  const latestVideo = product.videos && product.videos.length > 0
    ? product.videos[product.videos.length - 1]
    : null

  const handleGenerateVideo = async () => {
    setShowTemplateModal(true)
  }

  const handleTemplateSelected = async (templateId: string, templateName: string) => {
    try {
      console.log('Generating video for product with template:', {
        productId: product._id,
        productTitle: product.title,
        templateId,
        templateName
      })

      const { videosApi } = await import('@/api')
      const result = await videosApi.generateVideoForProduct(product._id, templateId, templateName)

      console.log('Video generation result:', result)

      if (result.success) {
        alert(`✅ ${result.message}`)
        // Reload the page to show the updated video status
        window.location.reload()
      } else {
        alert(`❌ Failed to generate video: ${result.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error generating video:', error)
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Failed to generate video'}`)
    } finally {
      setShowTemplateModal(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Video Template Modal */}
      <VideoTemplateModal
        open={showTemplateModal}
        onOpenChange={setShowTemplateModal}
        productCount={1}
        onCreateVideo={handleTemplateSelected}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Product Video Generation
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Generate promotional videos for your product using AI-powered video creation.
          </p>
        </CardHeader>
        <CardContent>
          {!hasImages ? (
            <div className="text-center py-12 border-2 border-dashed border-muted-foreground/20 rounded-lg">
              <Image className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2 text-muted-foreground">No Images Available</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Product video generation requires at least one product image. Please add images to your product to enable video creation.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Show latest video if available */}
              {latestVideo && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-900">
                      <Video className="w-5 h-5" />
                      Generated Video
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {latestVideo.status === 'completed' && latestVideo.videoUrl ? (
                      <div className="space-y-4">
                        <div className="aspect-video rounded-lg overflow-hidden bg-black">
                          <video
                            controls
                            className="w-full h-full"
                            src={latestVideo.videoUrl}
                          >
                            Your browser does not support the video tag.
                          </video>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-blue-900">Template: {latestVideo.templateName}</p>
                            <p className="text-xs text-muted-foreground">
                              Generated {new Date(latestVideo.completedAt || latestVideo.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(latestVideo.videoUrl, '_blank')}
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Open in New Tab
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleGenerateVideo}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Generate New
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : latestVideo.status === 'processing' ? (
                      <div className="text-center py-8">
                        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-600" />
                        <h3 className="text-lg font-semibold mb-2 text-purple-900">Processing Video...</h3>
                        <p className="text-muted-foreground">
                          Template: {latestVideo.templateName}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Started {new Date(latestVideo.createdAt).toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Video will be ready soon. We'll let you know when it's complete!
                        </p>
                      </div>
                    ) : latestVideo.status === 'pending' ? (
                      <div className="text-center py-8">
                        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-yellow-600" />
                        <h3 className="text-lg font-semibold mb-2 text-yellow-900">Video Pending...</h3>
                        <p className="text-muted-foreground">
                          Template: {latestVideo.templateName}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Started {new Date(latestVideo.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ) : latestVideo.status === 'failed' ? (
                      <div className="text-center py-8">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-600" />
                        <h3 className="text-lg font-semibold mb-2 text-red-900">Video Generation Failed</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {latestVideo.error || 'An error occurred during video generation'}
                        </p>
                        <Button onClick={handleGenerateVideo}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Try Again
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Product Images ({product.images.length})</h4>
                  <div className="grid grid-cols-2 gap-2 overflow-y-auto">
                    {product.images.map((image, index) => (
                      <div key={index} className="rounded-lg overflow-hidden bg-muted">
                        <img
                          src={image.url}
                          alt={image.altText || `Product image ${index + 1}`}
                          className="max-w-[400px] h-auto object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Video Generation</h4>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium">AI-Powered Video Creation</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create engaging product videos automatically using your product images, title, and description.
                      </p>
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" />
                          <span>High-quality video output</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" />
                          <span>Multiple video templates</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" />
                          <span>Professional animations</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" />
                          <span>Ready to share on social media</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      size="lg"
                      onClick={handleGenerateVideo}
                      className="w-full relative overflow-hidden"
                    >
                      <Video className="w-4 h-4 mr-2" />
                      {latestVideo ? 'Generate New Video' : 'Generate Product Video'}
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                      Video generation typically completes within 2-5 minutes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
