import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useWorkspace } from "@/components/workspace/workspace-context"
import { ConnectionForm } from "@/components/marketplace/connection-form"
import { ConnectedMarketplaceDetail } from "@/components/marketplace/connected-marketplace-detail"
import { ConnectedShopifyDetail } from "@/components/marketplace/connected-shopify-detail"
import { SyncConfirmationDialog } from "@/components/marketplace/sync-confirmation-dialog"
import { marketplaceService } from "@/services/marketplace"
import { productsService } from "@/services/products"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertCircle, ArrowLeft, Loader2, AlertTriangle, Trash2 } from "lucide-react"
import type { Marketplace } from "@/types/marketplace"

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

  const loadMarketplace = async () => {
    if (!marketplaceId) return
    
    setLoading(true)
    setError("")
    
    try {
      const data = await marketplaceService.getMarketplaceStatus()
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

  const handleConnectionSuccess = async () => {
    await loadMarketplace()
  }

  const handleSync = async (marketplace: Marketplace) => {
    if (!marketplace.connectionInfo) return
    
    // Check if products exist
    try {
      const productInfo = await productsService.hasProducts(marketplace.connectionInfo.connectionId)
      setProductCount(productInfo.count)
      
      if (productInfo.hasProducts) {
        // Show warning modal if products exist
        setShowSyncConfirm(true)
      } else {
        // No products exist, sync directly
        await performSync(marketplace, false)
      }
    } catch (error) {
      console.error('Error checking products:', error)
      // If error checking, proceed with sync (fail safe)
      await performSync(marketplace, false)
    }
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
      await productsService.syncProducts(
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

  const handleDisconnect = async (marketplace: Marketplace) => {
    if (!marketplace.connectionInfo) return
    
    // Check if products exist and get count
    try {
      const productInfo = await productsService.hasProducts(marketplace.connectionInfo.connectionId)
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
      await marketplaceService.disconnectMarketplace(
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
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/stores')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Stores
          </Button>
        </div>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
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