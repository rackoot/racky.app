import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, RotateCcw, Package, TrendingUp, Trash2, AlertTriangle } from "lucide-react"
import { productsApi, marketplacesApi, type Product } from "@/api"
import { SyncConfirmationDialog } from "./sync-confirmation-dialog"
import { SyncFiltersModal } from "./sync-filters-modal"
import { SyncProgressDisplay } from "./sync-progress-display"
import { saveSyncJob, getSyncJob } from "@/lib/sync-storage"
import type { Marketplace } from "@/types/marketplace"
import type { ProductSyncFilters } from "@/types/sync"

interface ConnectedShopifyDetailProps {
  marketplace: Marketplace
  onBack: () => void
}


export function ConnectedShopifyDetail({ marketplace, onBack }: ConnectedShopifyDetailProps) {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [showSyncConfirm, setShowSyncConfirm] = useState(false)
  const [deleteProducts, setDeleteProducts] = useState(true)
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    totalInventory: 0,
    inventoryValue: 0
  })
  const [lastSync, setLastSync] = useState<string | null>(null)

  // New async sync states
  const [showFiltersModal, setShowFiltersModal] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [showSyncProgress, setShowSyncProgress] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const loadProducts = async () => {
    if (!marketplace.connectionInfo) return
    
    setLoading(true)
    try {
      console.log('Loading products for connection:', marketplace.connectionInfo.connectionId)
      const products = await productsApi.getStoreProducts(marketplace.connectionInfo.connectionId)
      console.log('Loaded products:', products.length, 'products')
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

  const handleSyncClick = async () => {
    if (!marketplace.connectionInfo) return

    // Clear previous error and open filters modal
    setSyncError(null)
    setShowFiltersModal(true)
  }

  const handleConfirmedSync = async () => {
    setShowSyncConfirm(false)
    // Open filters modal instead of direct sync
    setShowFiltersModal(true)
  }

  // New async sync function
  const handleStartAsyncSync = (filters: ProductSyncFilters) => {
    if (!marketplace.connectionInfo) return

    setSyncing(true)

    productsApi.startAsyncSync({
      connectionId: marketplace.connectionInfo.connectionId,
      marketplace: 'shopify',
      estimatedProducts: stats.totalProducts || 50,
      batchSize: 50,
      filters
    })
    .then((response) => {
      console.log('Async sync started:', response)

      // Save job to localStorage for persistence
      saveSyncJob({
        jobId: response.jobId,
        connectionId: marketplace.connectionInfo.connectionId,
        marketplace: 'shopify',
        startedAt: new Date().toISOString()
      })

      // Save job ID and show progress
      setCurrentJobId(response.jobId)
      setShowFiltersModal(false)
      setShowSyncProgress(true)
      setSyncing(false)
    })
    .catch((error: any) => {
      console.error('Error starting async sync:', error)
      setSyncing(false)

      let errorMessage: string
      if (error.response?.status === 409) {
        errorMessage = 'A sync is already in progress for this connection. Please wait for it to complete before starting another sync.'
      } else {
        errorMessage = error.response?.data?.message || 'Failed to start synchronization. Please try again or contact support if the problem persists.'
      }

      // Set error to be displayed in modal
      setSyncError(errorMessage)
    })
  }

  const handleSyncComplete = () => {
    console.log('Sync completed! Reloading products...')
    setLastSync(new Date().toLocaleString())
    loadProducts()

    // Hide progress after a delay
    setTimeout(() => {
      setShowSyncProgress(false)
      setCurrentJobId(null)
    }, 3000)
  }

  const handleSyncError = (error: string) => {
    console.error('Sync error:', error)
    alert(`Error en la sincronización: ${error}`)
  }

  const handleDisconnect = async () => {
    if (!marketplace.connectionInfo) return
    
    setDisconnecting(true)
    try {
      await marketplacesApi.disconnectMarketplace(
        marketplace.connectionInfo.connectionId,
        deleteProducts
      )
      setShowDisconnectConfirm(false)
      onBack() // Navigate back to stores after disconnect
    } catch (error) {
      console.error('Error disconnecting marketplace:', error)
    } finally {
      setDisconnecting(false)
    }
  }

  const handleViewAllProducts = () => {
    if (!marketplace.connectionInfo) return
    navigate(`/products?store=${marketplace.connectionInfo.connectionId}`)
  }

  useEffect(() => {
    loadProducts()
    if (marketplace.connectionInfo?.lastSync) {
      setLastSync(new Date(marketplace.connectionInfo.lastSync).toLocaleString())
    }

    // Check for active sync job in localStorage
    if (marketplace.connectionInfo) {
      const storedJob = getSyncJob(marketplace.connectionInfo.connectionId)
      if (storedJob) {
        setCurrentJobId(storedJob.jobId)
        setShowSyncProgress(true)
      }
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
          type="button"
          variant="destructive"
          size="sm"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            console.log('Disconnect button clicked, showing confirmation')
            setShowDisconnectConfirm(true)
          }}
          disabled={disconnecting}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {disconnecting ? 'Disconnecting...' : 'Disconnect Store'}
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
            <Button
              onClick={handleSyncClick}
              disabled={syncing || currentJobId !== null}
              title={currentJobId ? 'Sync already in progress' : ''}
            >
              <RotateCcw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Starting...' : currentJobId ? 'Syncing...' : 'Sync Products'}
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
            <Button variant="outline" className="flex-1" onClick={handleViewAllProducts}>
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
                    <h4
                      className="font-medium hover:text-primary cursor-pointer transition-colors"
                      onClick={() => navigate(`/products/${product._id || product.id}`)}
                    >
                      {product.title}
                    </h4>
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
                <Button variant="outline" onClick={handleViewAllProducts}>
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
            <Button
              onClick={handleSyncClick}
              disabled={syncing || currentJobId !== null}
              title={currentJobId ? 'Sync already in progress' : ''}
            >
              <RotateCcw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Starting...' : currentJobId ? 'Syncing...' : 'Sync Products Now'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sync Confirmation Dialog */}
      <SyncConfirmationDialog
        isOpen={showSyncConfirm}
        onClose={() => setShowSyncConfirm(false)}
        onConfirm={handleConfirmedSync}
        marketplaceName={marketplace.name}
        productCount={stats.totalProducts}
        isLoading={syncing}
      />

      {/* Sync Filters Modal - NEW */}
      {marketplace.connectionInfo && (
        <SyncFiltersModal
          open={showFiltersModal}
          onOpenChange={setShowFiltersModal}
          connectionId={marketplace.connectionInfo.connectionId}
          marketplace="shopify"
          onStartSync={handleStartAsyncSync}
          error={syncError}
          isStarting={syncing}
        />
      )}

      {/* Sync Progress Display - NEW */}
      {showSyncProgress && currentJobId && marketplace.connectionInfo && (
        <div className="fixed bottom-4 right-4 w-[500px] z-50 shadow-lg">
          <SyncProgressDisplay
            jobId={currentJobId}
            connectionId={marketplace.connectionInfo.connectionId}
            onComplete={handleSyncComplete}
            onError={handleSyncError}
            autoClose={true}
            autoCloseDelay={3000}
          />
        </div>
      )}

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={showDisconnectConfirm} onOpenChange={setShowDisconnectConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Disconnect Shopify Store
            </DialogTitle>
            <DialogDescription>
              This action will disconnect your Shopify store from Racky.
            </DialogDescription>
          </DialogHeader>
          
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> Disconnecting this store will:
              <ul className="list-disc list-inside mt-2 ml-4">
                <li>Remove the connection to your Shopify store</li>
                <li>Stop product synchronization</li>
                <li>{deleteProducts ? "Delete all product data locally" : "Keep existing product data but mark it as disconnected"}</li>
              </ul>
              <p className="mt-2">You can reconnect later if needed.</p>
            </AlertDescription>
          </Alert>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="delete-products"
                checked={deleteProducts}
                onCheckedChange={(checked) => setDeleteProducts(checked === true)}
              />
              <label 
                htmlFor="delete-products" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Delete products locally ({stats.totalProducts} products)
              </label>
            </div>
            <p className="text-sm text-muted-foreground">
              {deleteProducts 
                ? "Products will be permanently removed from your local database. You can re-sync them after reconnecting."
                : "Products will remain in your local database but will be marked as disconnected and cannot be edited."
              }
            </p>
          </div>
          
          <DialogFooter>
            <Button 
              type="button"
              variant="outline" 
              onClick={() => setShowDisconnectConfirm(false)}
              disabled={disconnecting}
            >
              Cancel
            </Button>
            <Button 
              type="button"
              variant="destructive" 
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {disconnecting ? 'Disconnecting...' : 'Yes, Disconnect Store'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}