import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle } from 'lucide-react'
import { marketplacesApi } from '@/api/resources/marketplaces'
import type { CategoryFilter, ProductSyncFilters } from '@/types/sync'

interface SyncFiltersModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  marketplace: string
  onStartSync: (filters: ProductSyncFilters) => void
  error?: string | null
  isStarting?: boolean
}

export function SyncFiltersModal({
  open,
  onOpenChange,
  connectionId,
  marketplace,
  onStartSync,
  error = null,
  isStarting = false
}: SyncFiltersModalProps) {
  // Filter options from API
  const [categories, setCategories] = useState<CategoryFilter[]>([])
  const [loadingFilters, setLoadingFilters] = useState(true)
  const [filterError, setFilterError] = useState<string | null>(null)

  // Selected filters
  const [includeActive, setIncludeActive] = useState(true)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  // Validation error (local only)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Load filters when modal opens
  useEffect(() => {
    if (open && connectionId) {
      // Reset states before loading to prevent cached data
      setCategories([])
      setSelectedCategories([])
      setFilterError(null)
      setValidationError(null)
      loadFilters()
    }
  }, [open, connectionId])

  const loadFilters = async () => {
    setLoadingFilters(true)
    setFilterError(null)

    try {
      const categoriesData = await marketplacesApi.getCategories(connectionId, true)
      setCategories(categoriesData)
    } catch (error) {
      console.error('Error loading filters:', error)
      setFilterError('Failed to load filters. Please try again.')
    } finally {
      setLoadingFilters(false)
    }
  }

  const handleCategoryToggle = (value: string) => {
    setSelectedCategories(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    )
  }

  const handleStartSync = () => {
    // Validation: at least one status must be selected
    if (!includeActive && !includeInactive) {
      setValidationError('You must select at least one product status (Active or Inactive)')
      return
    }

    // Clear validation error
    setValidationError(null)

    const filters: ProductSyncFilters = {
      includeActive,
      includeInactive,
      categoryIds: selectedCategories
    }

    // Call parent handler - parent will handle errors
    onStartSync(filters)
  }

  const handleClose = () => {
    if (!isStarting) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sync Filters</DialogTitle>
          <DialogDescription>
            Select filters to sync products from {marketplace === 'shopify' ? 'Shopify' : 'VTEX'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Product Status Filters */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Product Status</Label>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="active"
                checked={includeActive}
                onCheckedChange={(checked) => setIncludeActive(checked as boolean)}
              />
              <label
                htmlFor="active"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Include ACTIVE products
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="inactive"
                checked={includeInactive}
                onCheckedChange={(checked) => setIncludeInactive(checked as boolean)}
              />
              <label
                htmlFor="inactive"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Include INACTIVE products
              </label>
            </div>
          </div>

          {/* Categories Filter */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              Filter by Category <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>

            {loadingFilters ? (
              <div className="flex items-center justify-center py-8 border rounded-md bg-muted/50">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading categories...</span>
              </div>
            ) : filterError ? (
              <div className="py-4 px-3 border rounded-md bg-destructive/10 text-destructive text-sm">
                {filterError}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadFilters}
                  className="ml-2"
                >
                  Retry
                </Button>
              </div>
            ) : categories.length > 0 ? (
              <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2">
                {categories.map((category) => (
                  <div key={category.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`category-${category.value}`}
                      checked={selectedCategories.includes(category.value)}
                      onCheckedChange={() => handleCategoryToggle(category.value)}
                    />
                    <label
                      htmlFor={`category-${category.value}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                    >
                      {category.name}
                      {marketplace === 'shopify' && category.productCount !== undefined && (
                        <span className="ml-2 text-muted-foreground font-normal">
                          ({category.productCount} products)
                        </span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 px-3 border rounded-md bg-muted/50 text-sm text-muted-foreground text-center">
                No categories available
              </div>
            )}

            {selectedCategories.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'} selected
              </div>
            )}
          </div>
        </div>

        {/* Error Alert - from parent (API errors) or local (validation) */}
        {(error || validationError) && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || validationError}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isStarting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleStartSync}
            disabled={isStarting || loadingFilters || !!filterError}
          >
            {isStarting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              'Start Sync'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
