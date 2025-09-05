import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Settings } from "lucide-react"
import type { Marketplace } from "@/types/marketplace"

interface MarketplaceCardProps {
  marketplace: Marketplace
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

// Only Shopify and VTEX are currently available
const enabledMarketplaces = ["shopify", "vtex"]

export function MarketplaceCard({ marketplace }: MarketplaceCardProps) {
  const navigate = useNavigate()
  const isEnabled = enabledMarketplaces.includes(marketplace.id)

  const handleNavigate = () => {
    if (isEnabled) {
      navigate(`/stores/${marketplace.id}`)
    }
  }

  return (
    <Card className={`h-full ${!isEnabled ? 'opacity-75' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-lg ${isEnabled ? 'bg-muted' : 'bg-gray-100'} flex items-center justify-center text-2xl`}>
              {marketplaceIcons[marketplace.id] || "🏪"}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{marketplace.name}</h3>
              {isEnabled ? (
                <Badge 
                  variant={marketplace.connectionInfo ? "default" : "secondary"}
                  className={marketplace.connectionInfo ? "bg-green-100 text-green-800" : ""}
                >
                  {marketplace.connectionInfo ? "Connected" : "Disconnected"}
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  Coming Soon
                </Badge>
              )}
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {isEnabled ? marketplace.description : "This integration will be available in the future. Stay tuned for updates!"}
        </p>

        {isEnabled && marketplace.connectionInfo && (
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Products:</span>
              <span>{marketplace.connectionInfo.productsCount}</span>
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
          {isEnabled ? (
            <>
              <Button 
                className="flex-1" 
                onClick={handleNavigate}
                variant={marketplace.connectionInfo ? "outline" : "default"}
              >
                {marketplace.connectionInfo ? (
                  <>
                    <Settings className="w-4 h-4 mr-2" />
                    Manage
                  </>
                ) : (
                  "Connect Store"
                )}
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
            <Button 
              className="flex-1" 
              variant="secondary"
              disabled
            >
              Coming Soon
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}