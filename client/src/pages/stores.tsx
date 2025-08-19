import { useState, useEffect } from "react"
import { MarketplaceCard } from "@/components/marketplace/marketplace-card"
import { ConnectionForm } from "@/components/marketplace/connection-form"
import { ConnectedMarketplaceDetail } from "@/components/marketplace/connected-marketplace-detail"
import { marketplaceService } from "@/services/marketplace"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import type { Marketplace } from "@/types/marketplace"

type ViewMode = 'list' | 'connect' | 'detail'

export function Stores() {
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedMarketplace, setSelectedMarketplace] = useState<Marketplace | null>(null)

  const loadMarketplaces = async () => {
    setLoading(true)
    setError("")
    
    try {
      const data = await marketplaceService.getMarketplaceStatus()
      setMarketplaces(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load marketplaces")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMarketplaces()
  }, [])

  const handleConnect = (marketplace: Marketplace) => {
    setSelectedMarketplace(marketplace)
    setViewMode('connect')
  }

  const handleManage = (marketplace: Marketplace) => {
    setSelectedMarketplace(marketplace)
    setViewMode('detail')
  }

  const handleDisconnect = async (marketplace: Marketplace) => {
    // TODO: Implement disconnect functionality
    console.log('Disconnect:', marketplace.name)
    // For now, just refresh the list
    await loadMarketplaces()
  }

  const handleConnectionSuccess = async () => {
    await loadMarketplaces()
    setViewMode('list')
    setSelectedMarketplace(null)
  }

  const handleSync = async (marketplace: Marketplace) => {
    if (!marketplace.connectionInfo) return
    
    try {
      await marketplaceService.testExistingConnection(
        marketplace.connectionInfo.connectionId,
        marketplace.connectionInfo.marketplaceId
      )
      await loadMarketplaces()
    } catch (err) {
      console.error('Sync failed:', err)
    }
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

  if (viewMode === 'connect' && selectedMarketplace) {
    return (
      <div className="max-w-4xl mx-auto">
        <ConnectionForm
          marketplace={selectedMarketplace}
          onSuccess={handleConnectionSuccess}
          onCancel={() => {
            setViewMode('list')
            setSelectedMarketplace(null)
          }}
        />
      </div>
    )
  }

  if (viewMode === 'detail' && selectedMarketplace) {
    return (
      <ConnectedMarketplaceDetail
        marketplace={selectedMarketplace}
        onBack={() => {
          setViewMode('list')
          setSelectedMarketplace(null)
        }}
        onSync={handleSync}
        onDisconnect={handleDisconnect}
        onViewProducts={handleViewProducts}
        onViewAnalytics={handleViewAnalytics}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Stores & Marketplaces</h1>
        <p className="text-muted-foreground">
          Connect your stores and marketplaces to centralize product management and synchronization.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {marketplaces.map((marketplace) => (
          <MarketplaceCard
            key={marketplace.id}
            marketplace={marketplace}
            onConnect={handleConnect}
            onManage={handleManage}
            onDisconnect={handleDisconnect}
          />
        ))}
      </div>
    </div>
  )
}