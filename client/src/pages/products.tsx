import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  Loader2
} from "lucide-react"
import { productsService, type Product, type ProductsResponse, type ProductsQuery } from "@/services/products"

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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [pagination, setPagination] = useState<ProductsResponse['pagination'] | null>(null)
  const [filters, setFilters] = useState<ProductsResponse['filters'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  
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
      const data = await productsService.getAllProducts(query)
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
    loadProducts()
  }, [query])

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
                    <TableHead>Variants</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product._id || product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.images[0] && (
                            <img
                              src={product.images[0].url}
                              alt={product.images[0].altText || product.title}
                              className="w-12 h-12 rounded object-cover"
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
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {product.variants?.length || 1} variant{(product.variants?.length || 1) !== 1 ? 's' : ''}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.status.toLowerCase() === 'active' ? 'default' : 'secondary'}>
                          {product.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
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
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
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