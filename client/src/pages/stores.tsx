import { useState, useEffect } from "react"
import { MarketplaceCard } from "@/components/marketplace/marketplace-card"
import { marketplaceService } from "@/services/marketplace"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import { useWorkspace } from "@/components/workspace/workspace-context"
import type { Marketplace } from "@/types/marketplace"

export function Stores() {
  const { currentWorkspace } = useWorkspace()
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

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
    // Only load if we have a current workspace
    if (currentWorkspace) {
      loadMarketplaces()
    }
  }, [currentWorkspace])


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
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
          />
        ))}
      </div>
    </div>
  )
}