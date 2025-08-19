import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Settings } from "lucide-react"
import type { Marketplace } from "@/types/marketplace"

interface MarketplaceCardProps {
  marketplace: Marketplace
  onConnect: (marketplace: Marketplace) => void
  onManage?: (marketplace: Marketplace) => void
  onDisconnect?: (marketplace: Marketplace) => void
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


export function MarketplaceCard({ marketplace, onConnect, onManage }: MarketplaceCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleConnect = async () => {
    setIsLoading(true)
    try {
      await onConnect(marketplace)
    } finally {
      setIsLoading(false)
    }
  }

  const handleManage = () => {
    if (onManage) {
      onManage(marketplace)
    }
  }

  return (
    <Card className="h-full">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl">
              {marketplaceIcons[marketplace.id] || "🏪"}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{marketplace.name}</h3>
              <Badge 
                variant={marketplace.connected ? "default" : "secondary"}
                className={marketplace.connected ? "bg-green-100 text-green-800" : ""}
              >
                {marketplace.connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {marketplace.description}
        </p>

        {marketplace.connected && marketplace.connectionInfo && (
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Products:</span>
              <span>{marketplace.connectionInfo.productsCount || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Orders:</span>
              <span>0</span>
            </div>
            {marketplace.connectionInfo.lastSync && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last sync:</span>
                <span>{new Date(marketplace.connectionInfo.lastSync).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          {marketplace.connected ? (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={handleManage}
              >
                <Settings className="w-4 h-4 mr-2" />
                Manage
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(marketplace.documentationUrl, '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button 
                className="flex-1" 
                onClick={handleConnect}
                disabled={isLoading}
              >
                {isLoading ? "Connecting..." : "Connect Store"}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(marketplace.documentationUrl, '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}