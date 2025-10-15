import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useWorkspace } from "@/components/workspace/workspace-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Search,
  MoreHorizontal,
  Edit,
  RefreshCw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Package,
  AlertCircle,
  Loader2,
  ExternalLink,
  Video,
  FileText,
  X,
  Sparkles,
  Clock
} from "lucide-react"
import { productsApi, videosApi, optimizationsApi, type Product, type ProductsResponse, type ProductsQuery } from "@/api"
import { VideoTemplateModal } from "@/components/videos/video-template-modal"
import { DescriptionApprovalModal } from "@/components/product/DescriptionApprovalModal"

const marketplaceColors: Record<string, string> = {
  shopify: 'bg-green-100 text-green-800',
  amazon: 'bg-orange-100 text-orange-800',
  vtex: 'bg-purple-100 text-purple-800',
  mercadolibre: 'bg-yellow-100 text-yellow-800',
  facebook_shop: 'bg-blue-100 text-blue-800',
  google_shopping: 'bg-red-100 text-red-800',
  woocommerce: 'bg-indigo-100 text-indigo-800',
}

const marketplaceIcons: Record<string, string> = {
  shopify: "🛍️",
  amazon: "📦",
  vtex: "🏪",
  mercadolibre: "🛒",
  facebook_shop: "👥",
  google_shopping: "🔍",
  woocommerce: "🌟",
}

export function Products() {
  const { currentWorkspace } = useWorkspace()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [pagination, setPagination] = useState<ProductsResponse['pagination'] | null>(null)
  const [filters, setFilters] = useState<ProductsResponse['filters'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Bulk selection state
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false)

  // Video template modal state
  const [showVideoTemplateModal, setShowVideoTemplateModal] = useState(false)

  // Description approval modal state
  const [showDescriptionModal, setShowDescriptionModal] = useState(false)
  const [selectedProductForDescription, setSelectedProductForDescription] = useState<Product | null>(null)

  // Initialize query state from URL parameters
  const [query, setQuery] = useState<ProductsQuery>(() => ({
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '20'),
    search: searchParams.get('search') || '',
    marketplace: searchParams.get('marketplace') || '',
    store: searchParams.get('store') || '',
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    status: searchParams.get('status') || ''
  }))

  const loadProducts = async () => {
    setLoading(true)
    setError("")
    
    try {
      const data = await productsApi.getAllProducts(query)
      setProducts(data.products)
      setPagination(data.pagination)
      setFilters(data.filters)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Only load if we have a current workspace
    if (currentWorkspace) {
      loadProducts()
    }
  }, [query, currentWorkspace])

  // Clear selection when products change (page change, filter, etc.)
  useEffect(() => {
    setSelectedProducts(new Set())
  }, [query.page, query.search, query.marketplace, query.status, query.sortBy])

  const handleSearch = (search: string) => {
    setQuery(prev => ({ ...prev, search, page: 1 }))
  }

  const handleFilter = (key: keyof ProductsQuery, value: string) => {
    setQuery(prev => ({ ...prev, [key]: value, page: 1 }))
  }

  const handleSort = (sortBy: string) => {
    setQuery(prev => ({
      ...prev,
      sortBy,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'desc' ? 'asc' : 'desc',
      page: 1
    }))
  }

  const handlePageChange = (page: number) => {
    setQuery(prev => ({ ...prev, page }))
  }

  const handleProductAction = async (action: string, product: Product) => {
    console.log(`${action} product:`, product.title)
    // TODO: Implement actions
  }

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set())
    } else {
      setSelectedProducts(new Set(products.map(p => p._id || p.id)))
    }
  }

  const handleSelectProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProducts(newSelected)
  }

  const handleClearSelection = () => {
    setSelectedProducts(new Set())
  }

  // Bulk action handlers
  const handleBulkCreateVideo = () => {
    console.log('Opening video template modal for products:', Array.from(selectedProducts))
    setShowVideoTemplateModal(true)
  }

  const handleVideoTemplateSelected = async (templateId: string, templateName: string) => {
    try {
      setBulkActionInProgress(true)

      const productIds = Array.from(selectedProducts)
      console.log('Creating videos for products with template:', {
        templateId,
        templateName,
        productIds,
        productCount: productIds.length
      })

      const result = await videosApi.bulkGenerateVideos(productIds, templateId, templateName)

      console.log('Bulk video generation result:', result)

      if (result.success) {
        alert(`✅ ${result.message}`)
        // Clear selection after successful generation
        setSelectedProducts(new Set())
        // Reload products to show "Processing..." status
        await loadProducts()
      } else {
        alert(`❌ Failed to generate videos: ${result.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error generating videos:', error)
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Failed to generate videos'}`)
    } finally {
      setBulkActionInProgress(false)
      setShowVideoTemplateModal(false)
    }
  }

  const handleBulkGenerateDescription = async () => {
    try {
      setBulkActionInProgress(true)

      const productIds = Array.from(selectedProducts)
      console.log('Generating descriptions for products:', productIds)

      const result = await optimizationsApi.bulkGenerateDescriptions(productIds)

      console.log('Bulk description generation result:', result)

      if (result.success) {
        alert(`✅ Description generation started for ${result.data.queuedCount} product(s)!\n\n${result.message}\n\nDescriptions will be marked as "Pending approval" when completed. Check back in a few minutes.`)
        // Clear selection after successful generation
        setSelectedProducts(new Set())
        // Reload products to show pending status
        await loadProducts()
      } else {
        alert(`❌ Failed to generate descriptions: ${result.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error generating descriptions:', error)
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Failed to generate descriptions'}`)
    } finally {
      setBulkActionInProgress(false)
    }
  }

  // Description approval modal handler
  const handleOpenDescriptionModal = (product: Product) => {
    setSelectedProductForDescription(product)
    setShowDescriptionModal(true)
  }

  const handleCloseDescriptionModal = () => {
    setShowDescriptionModal(false)
    setSelectedProductForDescription(null)
  }

  const handleDescriptionAction = async (action: 'accept' | 'reject' | 'regenerate') => {
    if (!selectedProductForDescription) return

    try {
      if (action === 'accept') {
        // Accept and apply the description
        await optimizationsApi.updateSuggestionStatus(
          selectedProductForDescription._id || selectedProductForDescription.id,
          selectedProductForDescription.marketplace || '',
          '', // suggestionId - will be handled by backend
          'accepted'
        )
      } else if (action === 'reject') {
        // Reject the description
        await optimizationsApi.updateSuggestionStatus(
          selectedProductForDescription._id || selectedProductForDescription.id,
          selectedProductForDescription.marketplace || '',
          '', // suggestionId - will be handled by backend
          'rejected'
        )
      } else if (action === 'regenerate') {
        // Regenerate description
        await optimizationsApi.regenerateDescriptionOptimization(
          selectedProductForDescription._id || selectedProductForDescription.id,
          selectedProductForDescription.marketplace || ''
        )
      }

      // Reload products to get updated status
      await loadProducts()
      handleCloseDescriptionModal()
    } catch (error) {
      console.error('Error handling description action:', error)
      alert(`Failed to ${action} description`)
    }
  }

  const formatCurrency = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price)
  }

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Video Template Modal */}
      <VideoTemplateModal
        open={showVideoTemplateModal}
        onOpenChange={setShowVideoTemplateModal}
        productCount={selectedProducts.size}
        onCreateVideo={handleVideoTemplateSelected}
      />

      {/* Description Approval Modal */}
      <DescriptionApprovalModal
        open={showDescriptionModal}
        onOpenChange={setShowDescriptionModal}
        product={selectedProductForDescription}
        onAction={handleDescriptionAction}
      />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Products</h1>
        <p className="text-muted-foreground">
          Manage all your products across different marketplaces
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Product Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search products..."
                value={query.search || ''}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Marketplace Filter */}
            <Select value={query.marketplace || 'all'} onValueChange={(value) => handleFilter('marketplace', value === 'all' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Marketplaces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Marketplaces</SelectItem>
                {filters?.marketplaces.map((mp) => (
                  <SelectItem key={mp.marketplace} value={mp.marketplace}>
                    {marketplaceIcons[mp.marketplace]} {mp.marketplace} ({mp.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={query.status || 'all'} onValueChange={(value) => handleFilter('status', value === 'all' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort By */}
            <Select value={query.sortBy || 'createdAt'} onValueChange={(value) => handleFilter('sortBy', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Date Created</SelectItem>
                <SelectItem value="title">Name</SelectItem>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="inventory">Stock</SelectItem>
                <SelectItem value="marketplace">Marketplace</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Toolbar */}
      {selectedProducts.size > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="font-medium text-blue-900">
                  {selectedProducts.size} product{selectedProducts.size !== 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearSelection}
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear Selection
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkCreateVideo}
                  disabled={bulkActionInProgress}
                >
                  <Video className="w-4 h-4 mr-2" />
                  Create Video
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkGenerateDescription}
                  disabled={bulkActionInProgress}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Description
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {pagination ? `${pagination.totalCount} Products` : 'Products'}
            </CardTitle>
            <Button onClick={loadProducts} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Products Found</h3>
              <p className="text-muted-foreground">
                {query.search || query.marketplace || query.status 
                  ? "Try adjusting your filters to see more products."
                  : "Connect your marketplaces and sync products to get started."
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedProducts.size === products.length && products.length > 0}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all products"
                      />
                    </TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('price')}
                    >
                      Price {query.sortBy === 'price' && (query.sortOrder === 'desc' ? '↓' : '↑')}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('marketplace')}
                    >
                      Marketplace {query.sortBy === 'marketplace' && (query.sortOrder === 'desc' ? '↓' : '↑')}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('inventory')}
                    >
                      Stock {query.sortBy === 'inventory' && (query.sortOrder === 'desc' ? '↓' : '↑')}
                    </TableHead>
                    {/* <TableHead>Variants</TableHead> */}
                    <TableHead>Status</TableHead>
                    <TableHead>Video</TableHead>
                    <TableHead>AI Description</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const isDisconnected = !product.isMarketplaceConnected;
                    const productId = product._id || product.id;

                    // Get latest video status
                    const latestVideo = product.videos && product.videos.length > 0
                      ? product.videos[product.videos.length - 1]
                      : null;

                    return (
                      <TableRow
                        key={productId}
                        className={isDisconnected ? "opacity-50" : ""}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedProducts.has(productId)}
                            onCheckedChange={() => handleSelectProduct(productId)}
                            aria-label={`Select ${product.title}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {product.images[0] && (
                              <img
                                src={product.images[0].url}
                                alt={product.images[0].altText || product.title}
                                className={`w-12 h-12 rounded object-cover ${isDisconnected ? "grayscale" : ""}`}
                              />
                            )}
                            <div>
                              <button 
                                onClick={() => navigate(`/products/${product._id || product.id}`)}
                                className="font-medium hover:text-blue-600 text-left transition-colors"
                              >
                                {product.title}
                              </button>
                              <div className="text-sm text-muted-foreground">
                                SKU: {product.handle || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      <TableCell>
                        <div className="font-medium">{formatCurrency(product.price)}</div>
                        {product.compareAtPrice && product.compareAtPrice > product.price && (
                          <div className="text-sm text-muted-foreground line-through">
                            {formatCurrency(product.compareAtPrice)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={marketplaceColors[product.marketplace] || 'bg-gray-100 text-gray-800'}
                        >
                          {marketplaceIcons[product.marketplace]} {product.marketplace}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={product.inventory <= 0 ? 'text-red-600' : ''}>
                          {product.inventory}
                        </span>
                      </TableCell>
                      {/* <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {product.variants?.length || 1} variant{(product.variants?.length || 1) !== 1 ? 's' : ''}
                        </span>
                      </TableCell> */}
                      <TableCell>
                        <Badge variant={product.status.toLowerCase() === 'active' ? 'default' : 'secondary'}>
                          {product.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {latestVideo ? (
                          latestVideo.status === 'completed' && latestVideo.videoUrl ? (
                            <a
                              href={latestVideo.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Video className="w-4 h-4" />
                              View Video
                            </a>
                          ) : latestVideo.status === 'processing' ? (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Processing...
                            </Badge>
                          ) : latestVideo.status === 'pending' ? (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Pending...
                            </Badge>
                          ) : latestVideo.status === 'failed' ? (
                            <Badge variant="destructive">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Failed
                            </Badge>
                          ) : null
                        ) : (
                          <span className="text-sm text-muted-foreground">No video</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.aiDescriptionStatus === 'accepted' ? (
                          <Badge
                            variant="default"
                            className="bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200"
                            onClick={() => handleOpenDescriptionModal(product)}
                          >
                            <Sparkles className="w-3 h-3 mr-1" />
                            Optimized
                          </Badge>
                        ) : product.aiDescriptionStatus === 'processing' ? (
                          <Badge
                            variant="outline"
                            className="bg-purple-50 text-purple-700 border-purple-300"
                          >
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Processing...
                          </Badge>
                        ) : product.aiDescriptionStatus === 'pending' ? (
                          <Badge
                            variant="outline"
                            className="bg-yellow-50 text-yellow-700 border-yellow-300 cursor-pointer hover:bg-yellow-100"
                            onClick={() => handleOpenDescriptionModal(product)}
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            Pending approval
                          </Badge>
                        ) : product.aiDescriptionStatus === 'rejected' ? (
                          <Badge
                            variant="outline"
                            className="bg-gray-100 text-gray-700 cursor-pointer hover:bg-gray-200"
                            onClick={() => handleOpenDescriptionModal(product)}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Rejected
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not optimized</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {/* Always show View on Marketplace */}
                            {product.marketplaceUrl ? (
                              <DropdownMenuItem 
                                onClick={() => window.open(product.marketplaceUrl, '_blank')}
                              >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View on Marketplace
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View on Marketplace
                              </DropdownMenuItem>
                            )}
                            
                            {/* Show editing options only for connected products */}
                            {!isDisconnected && (
                              <>
                                <DropdownMenuItem onClick={() => navigate(`/products/${product._id || product.id}`)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleProductAction('resync', product)}>
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Re-sync
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleProductAction('delete', product)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {((pagination.currentPage - 1) * pagination.limit) + 1} to {Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)} of {pagination.totalCount} products
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      disabled={!pagination.hasPrev}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <Button
                            key={`page-${page}`}
                            variant={page === pagination.currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(page)}
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      disabled={!pagination.hasNext}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}