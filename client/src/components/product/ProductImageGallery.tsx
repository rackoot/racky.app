import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Image, ChevronLeft, ChevronRight } from "lucide-react"

interface ProductImage {
  url: string;
  altText?: string;
}

interface ProductImageGalleryProps {
  images: (string | ProductImage)[];
  title: string;
}

export function ProductImageGallery({ images, title }: ProductImageGalleryProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  // Normalize images to consistent format
  const normalizedImages = images.map(img => 
    typeof img === 'string' ? { url: img, altText: title } : img
  )

  if (!normalizedImages || normalizedImages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="w-5 h-5" />
            Product Images
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="aspect-square w-full bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Image className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No images available</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const handlePrevious = () => {
    setSelectedImageIndex(prev => 
      prev === 0 ? normalizedImages.length - 1 : prev - 1
    )
  }

  const handleNext = () => {
    setSelectedImageIndex(prev => 
      prev === normalizedImages.length - 1 ? 0 : prev + 1
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="w-5 h-5" />
          Product Images ({normalizedImages.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Image */}
        <div className="relative">
          <div className="aspect-square w-full bg-gray-100 rounded-lg overflow-hidden">
            <img 
              src={normalizedImages[selectedImageIndex].url} 
              alt={normalizedImages[selectedImageIndex].altText || title}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MC4xIDEwMy4yQzgwLjEgOTcuNCA4NC45IDkyLjcgOTAuNyA5Mi43SDEwOS4zQzExNS4xIDkyLjcgMTE5LjkgOTcuNSAxMTkuOSAxMDMuM1YxMjEuOUMxMTkuOSAxMjcuNyAxMTUuMSAxMzIuNSAxMDkuMyAxMzIuNUg5MC43Qzg0LjkgMTMyLjUgODAuMSAxMjcuNyA4MC4xIDEyMS45VjEwMy4yWiIgZmlsbD0iIzlDQTNCRiIvPgo8cGF0aCBkPSJNMTAwIDExM0MxMDMuMzEgMTEzIDEwNiAxMTAuMzEgMTA2IDEwN0MxMDYgMTAzLjY5IDEwMy4zMSAxMDEgMTAwIDEwMUM5Ni42OSAxMDEgOTQgMTAzLjY5IDk0IDEwN0M5NCAxMTAuMzEgOTYuNjkgMTEzIDEwMCAxMTNaIiBmaWxsPSIjRkZGRkZGIi8+Cjwvc3ZnPgo=';
              }}
            />
          </div>
          
          {/* Navigation arrows for multiple images */}
          {normalizedImages.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white"
                onClick={handlePrevious}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white"
                onClick={handleNext}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>

        {/* Thumbnail Navigation */}
        {normalizedImages.length > 1 && (
          <div className="grid grid-cols-4 gap-2">
            {normalizedImages.map((image, index) => (
              <button
                key={index}
                onClick={() => setSelectedImageIndex(index)}
                className={`relative aspect-square rounded border-2 overflow-hidden transition-all ${
                  selectedImageIndex === index 
                    ? 'border-slate-900 ring-2 ring-slate-900 ring-offset-2' 
                    : 'border-transparent hover:border-slate-300'
                }`}
              >
                <img 
                  src={image.url} 
                  alt={image.altText || `${title} ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNiAyMC42QzE2IDE5LjUgMTYuOSAxOC42IDE4IDE4LjZIMjJDMjMuMSAxOC42IDI0IDE5LjUgMjQgMjAuNlYyNC40QzI0IDI1LjUgMjMuMSAyNi40IDIyIDI2LjRIMThDMTYuOSAyNi40IDE2IDI1LjUgMTYgMjQuNFYyMC42WiIgZmlsbD0iIzlDQTNCRiIvPgo8cGF0aCBkPSJNMjAgMjIuNkMyMS4xIDIyLjYgMjIgMjEuNyAyMiAyMC42QzIyIDE5LjUgMjEuMSAxOC42IDIwIDE4LjZDMTguOSAxOC42IDE4IDE5LjUgMTggMjAuNkMxOCAyMS43IDE4LjkgMjIuNiAyMCAyMi42WiIgZmlsbD0iI0ZGRkZGRiIvPgo8L3N2Zz4K';
                  }}
                />
                {selectedImageIndex === index && (
                  <div className="absolute inset-0 bg-slate-900/20 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Image Counter */}
        {normalizedImages.length > 1 && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {selectedImageIndex + 1} of {normalizedImages.length}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}