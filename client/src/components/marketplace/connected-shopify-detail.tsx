import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, RotateCcw, Package, TrendingUp, DollarSign, Archive, Trash2 } from "lucide-react"
import { productsService, type Product } from "@/services/products"
import type { Marketplace } from "@/types/marketplace"

interface ConnectedShopifyDetailProps {
  marketplace: Marketplace
  onBack: () => void
}


export function ConnectedShopifyDetail({ marketplace, onBack }: ConnectedShopifyDetailProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    totalInventory: 0,
    inventoryValue: 0
  })
  const [lastSync, setLastSync] = useState<string | null>(null)

  const loadProducts = async () => {
    if (!marketplace.connectionInfo) return
    
    setLoading(true)
    try {
      const products = await productsService.getStoreProducts(marketplace.connectionInfo.connectionId)
      setProducts(products)
      
      // Calculate stats
      const totalProducts = products.length
      const activeProducts = products.filter(p => p.status.toLowerCase() === 'active').length
      const totalInventory = products.reduce((sum, p) => sum + (p.inventory || 0), 0)
      const inventoryValue = products.reduce((sum, p) => sum + ((p.price || 0) * (p.inventory || 0)), 0)
      
      setStats({ totalProducts, activeProducts, totalInventory, inventoryValue })
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    if (!marketplace.connectionInfo) return
    
    setSyncing(true)
    try {
      const result = await productsService.syncProducts(
        marketplace.connectionInfo.connectionId,
        marketplace.connectionInfo.marketplaceId
      )
      setLastSync(new Date().toLocaleString())
      await loadProducts()
      console.log('Sync completed:', result)
    } catch (error) {
      console.error('Error syncing products:', error)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    loadProducts()
    if (marketplace.connectionInfo?.lastSync) {
      setLastSync(new Date(marketplace.connectionInfo.lastSync).toLocaleString())
    }
  }, [marketplace])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Stores
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-lg">
              🛍️
            </div>
            <div>
              <h1 className="text-2xl font-bold">{marketplace.name} Connection</h1>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800">connected</Badge>
              </div>
            </div>
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Disconnect Store
        </Button>
      </div>

      {/* Product Management Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              <CardTitle>Product Management</CardTitle>
            </div>
            <Button onClick={handleSync} disabled={syncing}>
              <RotateCcw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Products'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.totalProducts}</div>
              <div className="text-sm text-muted-foreground">Total Products</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.activeProducts}</div>
              <div className="text-sm text-muted-foreground">Active Products</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.totalInventory}</div>
              <div className="text-sm text-muted-foreground">Total Inventory</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                ${stats.inventoryValue.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Inventory Value</div>
            </div>
          </div>

          {/* Last Sync Info */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                📅
              </div>
              <span className="text-sm">Last Synchronization</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {lastSync || 'Never synced'}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1">
              <Package className="w-4 h-4 mr-2" />
              View All Products
            </Button>
            <Button variant="outline" className="flex-1">
              <TrendingUp className="w-4 h-4 mr-2" />
              View Analytics
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Products */}
      {products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {products.slice(0, 5).map((product) => (
                <div key={product.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  {product.images[0] && (
                    <img
                      src={product.images[0].url}
                      alt={product.images[0].altText || product.title}
                      className="w-12 h-12 rounded object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium">{product.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      ${product.price} • {product.inventory} in stock
                    </p>
                  </div>
                  <Badge variant={product.status.toLowerCase() === 'active' ? 'default' : 'secondary'}>
                    {product.status}
                  </Badge>
                </div>
              ))}
            </div>
            {products.length > 5 && (
              <div className="mt-4 text-center">
                <Button variant="outline">
                  View All {products.length} Products
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-spin w-8 h-8 mx-auto mb-4">⏳</div>
            <p>Loading products...</p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && products.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Products Found</h3>
            <p className="text-muted-foreground mb-4">
              Start by syncing your products from Shopify to see them here.
            </p>
            <Button onClick={handleSync} disabled={syncing}>
              <RotateCcw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Products Now'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}