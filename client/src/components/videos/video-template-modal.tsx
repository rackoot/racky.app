import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Loader2, Video, Info, AlertCircle } from "lucide-react"
import { videosApi, VideoTemplateResponse } from "@/api/resources/videos"

interface VideoTemplateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productCount: number
  onCreateVideo: (templateId: string, templateName: string, aspectRatio: string) => void | Promise<void>
}

// Default fallback video URL
const DEFAULT_PREVIEW_VIDEO = "https://www.youtube.com/embed/2T-ZiEdMHvw"

// Helper to convert YouTube URL to embed format
const getYouTubeEmbedUrl = (url: string): string => {
  if (!url) return DEFAULT_PREVIEW_VIDEO

  // If already an embed URL, return as is
  if (url.includes('/embed/')) return url

  // Extract video ID from various YouTube URL formats
  const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/)
  if (videoIdMatch && videoIdMatch[1]) {
    return `https://www.youtube.com/embed/${videoIdMatch[1]}`
  }

  return DEFAULT_PREVIEW_VIDEO
}

export function VideoTemplateModal({
  open,
  onOpenChange,
  productCount,
  onCreateVideo,
}: VideoTemplateModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('9:16')
  const [templates, setTemplates] = useState<VideoTemplateResponse[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatingVideo, setGeneratingVideo] = useState(false)

  // Fetch templates from external API when modal opens
  useEffect(() => {
    if (open) {
      loadTemplates()
    }
  }, [open])

  const loadTemplates = async () => {
    setLoadingTemplates(true)
    setError(null)

    try {
      const response = await videosApi.getVideoTemplates()

      if (response.success && response.templates) {
        setTemplates(response.templates)
        if (response.templates.length > 0) {
          setSelectedTemplateId(response.templates[0].id)
        }
      } else {
        setError(response.error || "Failed to load video templates")
      }
    } catch (err) {
      console.error("Error loading video templates:", err)
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load video templates. The RCK Description Server may be offline."
      )
    } finally {
      setLoadingTemplates(false)
    }
  }

  const handleGenerateVideo = async () => {
    if (selectedTemplateId) {
      const selectedTemplate = templates.find(t => t.id === selectedTemplateId)
      if (selectedTemplate) {
        setGeneratingVideo(true)
        try {
          await onCreateVideo(selectedTemplateId, selectedTemplate.title, selectedAspectRatio)
          // Reset state
          setSelectedTemplateId('')
          setSelectedAspectRatio('9:16')
          onOpenChange(false)
        } finally {
          setGeneratingVideo(false)
        }
      }
    }
  }

  const handleClose = () => {
    setSelectedTemplateId('')
    setSelectedAspectRatio('9:16')
    setError(null)
    onOpenChange(false)
  }

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)
  const isLoading = loadingTemplates || generatingVideo

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Select Video Template
          </DialogTitle>
          <DialogDescription>
            Choose a template to generate {productCount === 1 ? "a video" : `${productCount} videos`} for your selected product{productCount !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Video generation will start in the background. We'll notify you when it's ready!
            </AlertDescription>
          </Alert>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {loadingTemplates && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading templates...</span>
            </div>
          )}

          {/* Templates Selection */}
          {!loadingTemplates && templates.length > 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="template-select">Video Template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger id="template-select">
                    <SelectValue placeholder="Select a video template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aspect-ratio-select">Video Format</Label>
                <Select value={selectedAspectRatio} onValueChange={setSelectedAspectRatio}>
                  <SelectTrigger id="aspect-ratio-select">
                    <SelectValue placeholder="Select aspect ratio..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9:16">9:16 (Vertical - Stories/Reels)</SelectItem>
                    <SelectItem value="16:9">16:9 (Horizontal - YouTube/TV)</SelectItem>
                    <SelectItem value="1:1">1:1 (Square - Instagram/Facebook)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Template Preview */}
              {selectedTemplate && (
                <div className="space-y-3">
                  {/* YouTube Preview */}
                  <div className="rounded-lg border overflow-hidden bg-black aspect-video">
                    <iframe
                      src={getYouTubeEmbedUrl(selectedTemplate.url_video || '')}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={`${selectedTemplate.title} Preview`}
                    />
                  </div>

                  {/* Template Information */}
                  <div className="rounded-lg border p-4 bg-muted/50">
                    <h4 className="font-medium text-sm mb-2">{selectedTemplate.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedTemplate.description}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Empty State */}
          {!loadingTemplates && templates.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Video className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No templates available</p>
              <Button variant="link" onClick={loadTemplates} className="mt-2">
                Try again
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerateVideo}
            disabled={!selectedTemplateId || isLoading || templates.length === 0}
          >
            {generatingVideo ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Video className="w-4 h-4 mr-2" />
                Generate Video{productCount > 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
