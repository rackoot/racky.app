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
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Video, AlertCircle, CheckCircle2 } from "lucide-react"
import { videosApi, type VideoTemplateResponse } from "@/api"
import { cn } from "@/lib/utils"

interface VideoTemplateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productCount: number
  onCreateVideo: (templateId: string) => void
}

export function VideoTemplateModal({
  open,
  onOpenChange,
  productCount,
  onCreateVideo,
}: VideoTemplateModalProps) {
  const [templates, setTemplates] = useState<VideoTemplateResponse[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch templates when modal opens
  useEffect(() => {
    if (open) {
      loadTemplates()
    }
  }, [open])

  const loadTemplates = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await videosApi.getVideoTemplates()

      if (response.success && response.templates) {
        setTemplates(response.templates)
        // Auto-select first template if available
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
      setLoading(false)
    }
  }

  const handleCreateVideo = () => {
    if (selectedTemplateId) {
      onCreateVideo(selectedTemplateId)
      // Reset state
      setSelectedTemplateId(null)
      onOpenChange(false)
    }
  }

  const handleClose = () => {
    setSelectedTemplateId(null)
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
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
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-2 text-sm text-muted-foreground">Loading templates...</span>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!loading && !error && templates.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No video templates available. Please try again later.
              </AlertDescription>
            </Alert>
          )}

          {!loading && templates.length > 0 && (
            <div className="grid grid-cols-1 gap-3">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    selectedTemplateId === template.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        {selectedTemplateId === template.id ? (
                          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm">{template.title}</h4>
                          <Badge variant="outline" className="text-xs">
                            <Video className="w-3 h-3 mr-1" />
                            {template.name_file_video}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {template.description}
                        </p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Background: {template.name_file_background_image}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateVideo}
            disabled={!selectedTemplateId || loading}
          >
            <Video className="w-4 h-4 mr-2" />
            Create Video{productCount > 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
