import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ConnectionForm } from "@/components/marketplace/connection-form"
import { ConnectedMarketplaceDetail } from "@/components/marketplace/connected-marketplace-detail"
import { marketplaceService } from "@/services/marketplace"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react"
import type { Marketplace } from "@/types/marketplace"

export function MarketplacePage() {
  const { marketplace: marketplaceId } = useParams<{ marketplace: string }>()
  const navigate = useNavigate()
  const [marketplace, setMarketplace] = useState<Marketplace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

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
    loadMarketplace()
  }, [marketplaceId])

  const handleConnectionSuccess = async () => {
    await loadMarketplace()
  }

  const handleSync = async (marketplace: Marketplace) => {
    if (!marketplace.connectionInfo) return
    
    try {
      await marketplaceService.testExistingConnection(
        marketplace.connectionInfo.connectionId,
        marketplace.connectionInfo.marketplaceId
      )
      await loadMarketplace()
    } catch (err) {
      console.error('Sync failed:', err)
    }
  }

  const handleDisconnect = async (marketplace: Marketplace) => {
    // TODO: Implement disconnect functionality
    console.log('Disconnect:', marketplace.name)
    await loadMarketplace()
  }

  const handleViewProducts = (marketplace: Marketplace) => {
    // TODO: Navigate to products page with marketplace filter
    console.log('View products for:', marketplace.name)
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
  if (marketplace.isConnected) {
    return (
      <ConnectedMarketplaceDetail
        marketplace={marketplace}
        onBack={() => navigate('/stores')}
        onSync={handleSync}
        onDisconnect={handleDisconnect}
        onViewProducts={handleViewProducts}
        onViewAnalytics={handleViewAnalytics}
      />
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