import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useWorkspace } from "@/components/workspace/workspace-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Package,
  Store,
  Tag,
  Calendar,
  AlertCircle,
  Loader2,
  ExternalLink,
  Clock,
  TrendingUp,
  RefreshCw
} from "lucide-react"
import { productsApi, getMarketplaceProductUrl } from "@/api"
import { ProductImageGallery } from "@/components/product/ProductImageGallery"
import { OptimizationTabs } from "@/components/product/OptimizationTabs"
import { ProductHistory } from "@/components/product/ProductHistory"
import { EditableDescription } from "@/components/product/EditableDescription"
import { OpportunitiesTab } from "@/components/product/OpportunitiesTab"
import type { ProductDetail } from "@/types/product"

const platformColors = {
  shopify: 'bg-green-100 text-green-800',
  amazon: 'bg-orange-100 text-orange-800',
  mercadolibre: 'bg-yellow-100 text-yellow-800',
  woocommerce: 'bg-purple-100 text-purple-800',
  vtex: 'bg-red-100 text-red-800',
  facebook_shop: 'bg-blue-100 text-blue-800',
  google_shopping: 'bg-red-100 text-red-800'
}

const statusColors = {
  active: 'bg-green-100 text-green-800',
  draft: 'bg-gray-100 text-gray-800',
  archived: 'bg-red-100 text-red-800'
}

const getInventoryColor = (inventory: number) => {
  if (inventory === 0) return 'text-red-600'
  if (inventory < 10) return 'text-yellow-600'
  return 'text-slate-900'
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}


export function ProductDetail() {
  const { currentWorkspace } = useWorkspace()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("details")
  const [resyncing, setResyncing] = useState(false)
  const [resyncDialogOpen, setResyncDialogOpen] = useState(false)

  useEffect(() => {
    if (id && currentWorkspace) {
      loadProduct()
    }
  }, [id, currentWorkspace])

  const loadProduct = async () => {
    if (!id) return

    setLoading(true)
    setError("")

    try {
      const data = await productsApi.getProductById(id)
      setProduct(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load product")
    } finally {
      setLoading(false)
    }
  }

  const handleResync = async () => {
    if (!product || !id) return

    setResyncing(true)
    setError("")
    setResyncDialogOpen(false) // Close dialog when starting resync

    try {
      // Call the resync endpoint
      const updatedProduct = await productsApi.resyncProduct(id)
      setProduct(updatedProduct)
      // Show success message (you might want to add a toast notification here)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resync product")
    } finally {
      setResyncing(false)
    }
  }

  const handleDescriptionUpdate = (newDescription: string) => {
    if (product) {
      setProduct({
        ...product,
        description: newDescription
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!product) {
    return (
      <div className="text-center py-8">
        <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">Product Not Found</h3>
        <p className="text-muted-foreground">The product you're looking for doesn't exist.</p>
        <Button onClick={() => navigate('/products')} className="mt-4">
          Back to Products
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/products')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Products
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{product.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={platformColors[product.marketplace as keyof typeof platformColors] || 'bg-gray-100 text-gray-800'}>
                {product.marketplace}
              </Badge>
              <Badge variant={product.status.toLowerCase() === 'active' ? 'default' : 'secondary'}>
                {product.status}
              </Badge>
              {product.storeConnectionId && (
                <Badge variant="outline">
                  {product.storeConnectionId.storeName}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={resyncDialogOpen} onOpenChange={setResyncDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={resyncing || !product.marketplace}
              >
                {resyncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Re-sync
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Re-sync Product Data</DialogTitle>
                <DialogDescription>
                  This will fetch the latest data for this product from {product.marketplace} and
                  overwrite all local information including:
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Product title and description</li>
                  <li>Price and inventory</li>
                  <li>Images and variants</li>
                  <li>Status (active/draft/archived)</li>
                </ul>
                <p className="mt-4 text-sm font-semibold">This action cannot be undone.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResyncDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleResync}>
                  Confirm Re-sync
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = product.marketplaceUrl || getMarketplaceProductUrl(product)
              if (url) {
                window.open(url, '_blank', 'noopener,noreferrer')
              }
            }}
            disabled={!product.marketplaceUrl && !getMarketplaceProductUrl(product)}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View in {product.marketplace}
          </Button>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="optimizations">SEO and Engagement</TabsTrigger>
          {/* <TabsTrigger value="opportunities">Opportunities</TabsTrigger> */}
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - 2/3 width */}
            <div className="lg:col-span-2 space-y-6">
              {/* Product Details Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Product Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Price</p>
                      <div>
                        <p className="font-semibold">{formatCurrency(product.price)}</p>
                        {product.compareAtPrice && product.compareAtPrice > product.price && (
                          <p className="text-sm text-muted-foreground line-through">
                            {formatCurrency(product.compareAtPrice)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">SKU</p>
                      <p className="font-semibold">{product.sku || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Inventory</p>
                      <p className={`font-semibold ${getInventoryColor(product.inventory)}`}>
                        {product.inventory} {product.inventory === 1 ? 'unit' : 'units'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Vendor</p>
                      <p className="font-semibold">{product.vendor || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Product Type</p>
                      <p className="font-semibold">{product.productType || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="font-semibold">{formatDate(product.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Updated</p>
                      <p className="font-semibold">{formatDate(product.updatedAt)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">External ID</p>
                      <p className="font-semibold">{product.externalId || 'N/A'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Editable Description */}
              <EditableDescription
                description={product.description || ""}
                productId={product._id}
                marketplace={product.marketplace}
                storeConnectionId={product.storeConnectionId?._id}
                onDescriptionUpdate={handleDescriptionUpdate}
              />

              {/* Product Variants */}
              {product.variants && product.variants.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Product Variants ({product.variants.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Variant</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Inventory</TableHead>
                          <TableHead>Weight</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {product.variants.map((variant) => (
                          <TableRow key={variant.id}>
                            <TableCell>{variant.title}</TableCell>
                            <TableCell>
                              <div>
                                <p>{formatCurrency(variant.price)}</p>
                                {variant.compareAtPrice && variant.compareAtPrice > variant.price && (
                                  <p className="text-sm text-muted-foreground line-through">
                                    {formatCurrency(variant.compareAtPrice)}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{variant.sku || 'N/A'}</TableCell>
                            <TableCell>
                              <span className={getInventoryColor(variant.inventory)}>
                                {variant.inventory}
                              </span>
                            </TableCell>
                            <TableCell>
                              {variant.weight ? `${variant.weight} ${variant.weightUnit || 'lb'}` : 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Platform Availability */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="w-5 h-5" />
                    Platform Availability
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(product.platforms).map(([platform, data]) => (
                      <div key={platform} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <Badge className={platformColors[platform as keyof typeof platformColors]}>
                            {platform}
                          </Badge>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            {formatDate(data.lastSyncAt || product.updatedAt)}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Platform ID</p>
                            <p className="font-medium">{data.platformId}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Status</p>
                            <Badge 
                              variant="outline"
                              className={statusColors[data.platformStatus as keyof typeof statusColors] || 'bg-gray-100'}
                            >
                              {data.platformStatus || product.status}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Price</p>
                            <p className="font-medium">{formatCurrency(data.platformPrice || product.price)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Inventory</p>
                            <p className={`font-medium ${getInventoryColor(data.platformInventory || product.inventory)}`}>
                              {data.platformInventory || product.inventory}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - 1/3 width */}
            <div className="space-y-6">
              {/* Image Gallery */}
              <ProductImageGallery 
                images={product.images}
                title={product.title}
              />

              {/* Tags */}
              {product.tags && product.tags.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="w-5 h-5" />
                      Tags ({product.tags.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {product.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="optimizations" className="space-y-6">
          <OptimizationTabs product={product} />
        </TabsContent>

        {/* <TabsContent value="opportunities" className="space-y-6">
          <OpportunitiesTab product={product} />
        </TabsContent> */}

        <TabsContent value="history" className="space-y-6">
          <ProductHistory productId={product._id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}