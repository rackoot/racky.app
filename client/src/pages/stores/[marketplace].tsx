import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useWorkspace } from "@/components/workspace/workspace-context"
import { ConnectionForm } from "@/components/marketplace/connection-form"
import { ConnectedMarketplaceDetail } from "@/components/marketplace/connected-marketplace-detail"
import { ConnectedShopifyDetail } from "@/components/marketplace/connected-shopify-detail"
import { SyncConfirmationDialog } from "@/components/marketplace/sync-confirmation-dialog"
import { SyncFiltersModal } from "@/components/marketplace/sync-filters-modal"
import { SyncProgressDisplay } from "@/components/marketplace/sync-progress-display"
import { saveSyncJob, getSyncJob } from "@/lib/sync-storage"
import { marketplacesApi, productsApi } from "@/api"
import type { ProductSyncFilters } from "@/types/sync"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertCircle, ArrowLeft, Loader2, AlertTriangle, Trash2, Info } from "lucide-react"
import type { Marketplace } from "@/types/marketplace"

// Only Shopify and VTEX are currently available
const enabledMarketplaces = ["shopify", "vtex"]

export function MarketplacePage() {
  const { currentWorkspace } = useWorkspace()
  const { marketplace: marketplaceId } = useParams<{ marketplace: string }>()
  const navigate = useNavigate()
  const [marketplace, setMarketplace] = useState<Marketplace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showSyncConfirm, setShowSyncConfirm] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [productCount, setProductCount] = useState(0)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [deleteProducts, setDeleteProducts] = useState(true)

  // Async sync states
  const [showFiltersModal, setShowFiltersModal] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [showSyncProgress, setShowSyncProgress] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const loadMarketplace = async () => {
    if (!marketplaceId) return
    
    // Check if marketplace is enabled
    if (!enabledMarketplaces.includes(marketplaceId)) {
      const marketplaceName = marketplaceId.charAt(0).toUpperCase() + marketplaceId.slice(1).replace('_', ' ')
      setError(`The ${marketplaceName} integration will be available in the future. Currently, only Shopify and VTEX are supported.`)
      setLoading(false)
      return
    }
    
    setLoading(true)
    setError("")
    
    try {
      const data = await marketplacesApi.getMarketplaceStatus()
      const foundMarketplace = data.find(m => m.id === marketplaceId)
      
      if (!foundMarketplace) {
        setError(`Marketplace "${marketplaceId}" not found`)
        return
      }
      
      setMarketplace(foundMarketplace)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load marketplace")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentWorkspace) {
      loadMarketplace()
    }
  }, [marketplaceId, currentWorkspace])

  // Check for active sync job in localStorage on mount
  useEffect(() => {
    if (marketplace?.connectionInfo) {
      const storedJob = getSyncJob(marketplace.connectionInfo.connectionId)
      if (storedJob) {
        setCurrentJobId(storedJob.jobId)
        setShowSyncProgress(true)
      }
    }
  }, [marketplace])

  const handleConnectionSuccess = async () => {
    await loadMarketplace()
  }

  const handleSync = async (marketplace: Marketplace) => {
    if (!marketplace.connectionInfo) return

    // Clear previous error and open filters modal
    setSyncError(null)
    setShowFiltersModal(true)
  }

  const handleConfirmedSync = async () => {
    if (!marketplace) return
    setShowSyncConfirm(false)
    await performSync(marketplace, true) // Force sync
  }

  const performSync = async (marketplace: Marketplace, force: boolean = false) => {
    if (!marketplace.connectionInfo) return

    setSyncing(true)
    try {
      await productsApi.syncProducts(
        marketplace.connectionInfo.connectionId,
        force
      )
      await loadMarketplace()
    } catch (err) {
      console.error('Sync failed:', err)
    } finally {
      setSyncing(false)
    }
  }

  const handleStartAsyncSync = (filters: ProductSyncFilters) => {
    if (!marketplace?.connectionInfo) return

    setSyncing(true)

    productsApi.startAsyncSync({
      connectionId: marketplace.connectionInfo.connectionId,
      marketplace: marketplace.id,
      estimatedProducts: productCount || 50,
      batchSize: 50,
      filters
    })
    .then((response) => {
      console.log('Async sync started:', response)

      // Save job to localStorage for persistence
      saveSyncJob({
        jobId: response.jobId,
        connectionId: marketplace.connectionInfo.connectionId,
        marketplace: marketplace.id,
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
    console.log('Sync completed! Reloading marketplace...')
    loadMarketplace()

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

  const handleDisconnect = async (marketplace: Marketplace) => {
    if (!marketplace.connectionInfo) return
    
    // Check if products exist and get count
    try {
      const productInfo = await productsApi.hasProducts(marketplace.connectionInfo.connectionId)
      setProductCount(productInfo.count)
    } catch (error) {
      console.error('Error checking products:', error)
      setProductCount(0)
    }
    
    setShowDisconnectConfirm(true)
  }

  const handleConfirmedDisconnect = async () => {
    if (!marketplace?.connectionInfo) return
    
    setDisconnecting(true)
    try {
      await marketplacesApi.disconnectMarketplace(
        marketplace.connectionInfo.connectionId,
        deleteProducts
      )
      setShowDisconnectConfirm(false)
      navigate('/stores')
    } catch (error) {
      console.error('Error disconnecting marketplace:', error)
    } finally {
      setDisconnecting(false)
    }
  }

  const handleViewProducts = (marketplace: Marketplace) => {
    // Navigate to products page with store filter
    if (marketplace.connectionInfo) {
      navigate(`/products?store=${marketplace.connectionInfo.connectionId}`)
    } else {
      navigate(`/products?marketplace=${marketplace.id}`)
    }
  }

  const handleViewAnalytics = (marketplace: Marketplace) => {
    // TODO: Navigate to analytics page with marketplace filter
    console.log('View analytics for:', marketplace.name)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (error || !marketplace) {
    const isComingSoon = error?.includes("will be available in the future")
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/stores')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Stores
          </Button>
        </div>
        
        <Alert variant={isComingSoon ? "default" : "destructive"}>
          {isComingSoon ? <Info className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>
            {error || `Marketplace "${marketplaceId}" not found`}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // If marketplace is connected, show detail view
  if (marketplace.connectionInfo) {
    // Show Shopify-specific UI for Shopify
    if (marketplace.id === 'shopify') {
      return (
        <ConnectedShopifyDetail
          marketplace={marketplace}
          onBack={() => navigate('/stores')}
        />
      )
    }
    
    // Default connected marketplace view for other marketplaces
    return (
      <>
        <ConnectedMarketplaceDetail
          marketplace={marketplace}
          onBack={() => navigate('/stores')}
          onSync={handleSync}
          onDisconnect={handleDisconnect}
          onViewProducts={handleViewProducts}
          onViewAnalytics={handleViewAnalytics}
        />
        
        {/* Sync Confirmation Dialog */}
        <SyncConfirmationDialog
          isOpen={showSyncConfirm}
          onClose={() => setShowSyncConfirm(false)}
          onConfirm={handleConfirmedSync}
          marketplaceName={marketplace.name}
          productCount={productCount}
          isLoading={syncing}
        />

        {/* Sync Filters Modal - NEW */}
        {marketplace.connectionInfo && (
          <SyncFiltersModal
            open={showFiltersModal}
            onOpenChange={setShowFiltersModal}
            connectionId={marketplace.connectionInfo.connectionId}
            marketplace={marketplace.id}
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
                Disconnect {marketplace.name} Store
              </DialogTitle>
              <DialogDescription>
                This action will disconnect your {marketplace.name} store from Racky.
              </DialogDescription>
            </DialogHeader>
            
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> Disconnecting this store will:
                <ul className="list-disc list-inside mt-2 ml-4">
                  <li>Remove the connection to your {marketplace.name} store</li>
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
                  Delete products locally ({productCount} products)
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
                onClick={handleConfirmedDisconnect}
                disabled={disconnecting}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {disconnecting ? 'Disconnecting...' : 'Yes, Disconnect Store'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // If marketplace is not connected, show connection form
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/stores')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Stores
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Connect {marketplace.name}</h1>
          <p className="text-muted-foreground">
            Set up your {marketplace.name} connection
          </p>
        </div>
      </div>

      <div className="max-w-4xl">
        <ConnectionForm
          marketplace={marketplace}
          onSuccess={handleConnectionSuccess}
          onCancel={() => navigate('/stores')}
        />
      </div>
    </div>
  )
}