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
import { Loader2, Video, Info } from "lucide-react"

interface VideoTemplateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productCount: number
  onCreateVideo: (templateId: string, templateName: string) => void | Promise<void>
}

// Predefined video templates related to product marketing
const PREDEFINED_TEMPLATES = [
  {
    id: 'unboxing',
    name: 'Unboxing Experience',
    description: 'Showcase the product as it comes out of the box, highlighting packaging and first impressions'
  },
  {
    id: 'product_demo',
    name: 'Product Demo',
    description: 'Demonstrate the product features and how to use it effectively'
  },
  {
    id: 'lifestyle',
    name: 'Lifestyle Showcase',
    description: 'Show the product being used in everyday life situations'
  },
  {
    id: 'comparison',
    name: 'Before & After / Comparison',
    description: 'Compare the product with alternatives or show before and after usage'
  },
  {
    id: 'testimonial',
    name: 'Customer Testimonial',
    description: 'Feature customer reviews and testimonials about the product'
  },
  {
    id: 'tutorial',
    name: 'How-To Tutorial',
    description: 'Step-by-step guide on how to use the product'
  },
  {
    id: 'features',
    name: 'Feature Highlights',
    description: 'Quick overview of key product features and benefits'
  },
  {
    id: 'social_promo',
    name: 'Social Media Promo',
    description: 'Short, engaging video optimized for social media platforms'
  }
]

export function VideoTemplateModal({
  open,
  onOpenChange,
  productCount,
  onCreateVideo,
}: VideoTemplateModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // COMMENTED OUT: External API call to fetch templates
  // This would normally fetch templates from an external service
  // useEffect(() => {
  //   if (open) {
  //     loadTemplates()
  //   }
  // }, [open])
  //
  // const loadTemplates = async () => {
  //   setLoading(true)
  //   setError(null)
  //
  //   try {
  //     const response = await videosApi.getVideoTemplates()
  //
  //     if (response.success && response.templates) {
  //       setTemplates(response.templates)
  //       if (response.templates.length > 0) {
  //         setSelectedTemplateId(response.templates[0].id)
  //       }
  //     } else {
  //       setError(response.error || "Failed to load video templates")
  //     }
  //   } catch (err) {
  //     console.error("Error loading video templates:", err)
  //     setError(
  //       err instanceof Error
  //         ? err.message
  //         : "Failed to load video templates. The RCK Description Server may be offline."
  //     )
  //   } finally {
  //     setLoading(false)
  //   }
  // }

  // Auto-select first template when modal opens
  useEffect(() => {
    if (open && !selectedTemplateId) {
      setSelectedTemplateId(PREDEFINED_TEMPLATES[0].id)
    }
  }, [open])

  const handleGenerateVideo = async () => {
    if (selectedTemplateId) {
      const selectedTemplate = PREDEFINED_TEMPLATES.find(t => t.id === selectedTemplateId)
      if (selectedTemplate) {
        setLoading(true)
        try {
          await onCreateVideo(selectedTemplateId, selectedTemplate.name)
          // Reset state
          setSelectedTemplateId('')
          onOpenChange(false)
        } finally {
          setLoading(false)
        }
      }
    }
  }

  const handleClose = () => {
    setSelectedTemplateId('')
    onOpenChange(false)
  }

  const selectedTemplate = PREDEFINED_TEMPLATES.find(t => t.id === selectedTemplateId)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
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

          <div className="space-y-2">
            <Label htmlFor="template-select">Video Template</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger id="template-select">
                <SelectValue placeholder="Select a video template..." />
              </SelectTrigger>
              <SelectContent>
                {PREDEFINED_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate && (
            <div className="rounded-lg border p-4 bg-muted/50">
              <h4 className="font-medium text-sm mb-2">{selectedTemplate.name}</h4>
              <p className="text-sm text-muted-foreground">
                {selectedTemplate.description}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerateVideo}
            disabled={!selectedTemplateId || loading}
          >
            {loading ? (
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
