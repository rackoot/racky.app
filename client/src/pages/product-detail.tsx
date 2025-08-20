import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  TrendingUp
} from "lucide-react"
import { productsService } from "@/services/products"
import { ProductImageGallery } from "@/components/product/ProductImageGallery"
import { OptimizationTabs } from "@/components/product/OptimizationTabs"
import { ProductHistory } from "@/components/product/ProductHistory"
import { EditableDescription } from "@/components/product/EditableDescription"
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

const getMarketplaceProductUrl = (product: ProductDetail) => {
  const { marketplace, externalId, handle, storeConnectionId } = product
  
  switch (marketplace) {
    case 'shopify':
      // For Shopify, use the actual shop_url from credentials
      if (storeConnectionId?.credentials?.shop_url && handle) {
        const shopUrl = storeConnectionId.credentials.shop_url
        // Remove protocol if present and ensure it ends with .myshopify.com
        const cleanShopUrl = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
        return `https://${cleanShopUrl}/products/${handle}`
      }
      return null
    case 'amazon':
      if (externalId) {
        return `https://www.amazon.com/dp/${externalId}`
      }
      return null
    case 'mercadolibre':
      if (externalId) {
        return `https://www.mercadolibre.com/item/${externalId}`
      }
      return null
    case 'vtex':
      // For VTEX, use the account_name from credentials
      if (storeConnectionId?.credentials?.account_name && handle) {
        const accountName = storeConnectionId.credentials.account_name
        return `https://${accountName}.vtexcommercestable.com.br/${handle}/p`
      }
      return null
    case 'woocommerce':
      // For WooCommerce, we'd need the actual domain from credentials
      if (storeConnectionId?.credentials?.site_url && handle) {
        const siteUrl = storeConnectionId.credentials.site_url.replace(/^https?:\/\//, '').replace(/\/$/, '')
        return `https://${siteUrl}/product/${handle}`
      }
      return null
    case 'facebook_shop':
      return null // Facebook Shop URLs are complex and require specific page/shop IDs
    case 'google_shopping':
      return null // Google Shopping doesn't have direct product URLs
    default:
      return null
  }
}

export function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("details")

  useEffect(() => {
    if (id) {
      loadProduct()
    }
  }, [id])

  const loadProduct = async () => {
    if (!id) return
    
    setLoading(true)
    setError("")
    
    try {
      const data = await productsService.getProductById(id)
      setProduct(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load product")
    } finally {
      setLoading(false)
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

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="optimizations">Optimizations</TabsTrigger>
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

        <TabsContent value="history" className="space-y-6">
          <ProductHistory productId={product._id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}