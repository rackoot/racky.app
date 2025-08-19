import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, 
  RefreshCw, 
  Calendar, 
  Package, 
  TrendingUp, 
  Eye,
  Trash2,
  AlertTriangle
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Marketplace } from "@/types/marketplace"

interface ConnectedMarketplaceDetailProps {
  marketplace: Marketplace
  onBack: () => void
  onSync: (marketplace: Marketplace) => void
  onDisconnect: (marketplace: Marketplace) => void
  onViewProducts: (marketplace: Marketplace) => void
  onViewAnalytics: (marketplace: Marketplace) => void
}

export function ConnectedMarketplaceDetail({ 
  marketplace, 
  onBack, 
  onSync, 
  onDisconnect, 
  onViewProducts,
  onViewAnalytics 
}: ConnectedMarketplaceDetailProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const connectionInfo = marketplace.connectionInfo!

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await onSync(marketplace)
    } finally {
      setIsSyncing(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'syncing':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'syncing':
        return <RefreshCw className="w-4 h-4 animate-spin" />
      case 'failed':
        return <AlertTriangle className="w-4 h-4" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl">
              {marketplace.id === 'shopify' ? '🛍️' : 
               marketplace.id === 'amazon' ? '📦' :
               marketplace.id === 'vtex' ? '🏪' :
               marketplace.id === 'mercadolibre' ? '🛒' :
               marketplace.id === 'facebook_shop' ? '👥' :
               marketplace.id === 'google_shopping' ? '🔍' : '🌟'}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{marketplace.name} Connection</h1>
              <Badge variant="default" className="bg-green-100 text-green-800 mt-1">
                connected
              </Badge>
            </div>
          </div>
        </div>
        
        <Button 
          variant="destructive" 
          onClick={() => onDisconnect(marketplace)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Disconnect Store
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Product Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{connectionInfo.productsCount || 0}</div>
              <div className="text-sm text-muted-foreground">Total Products</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{connectionInfo.activeProductsCount || 0}</div>
              <div className="text-sm text-muted-foreground">Active Products</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{connectionInfo.totalInventory || 0}</div>
              <div className="text-sm text-muted-foreground">Total Inventory</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{connectionInfo.inventoryValue || '$0'}</div>
              <div className="text-sm text-muted-foreground">Inventory Value</div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-6 border-t">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Last Synchronization: {formatDate(connectionInfo.lastSync)}
              </span>
              <Badge 
                variant="secondary" 
                className={getSyncStatusColor(connectionInfo.syncStatus)}
              >
                {getSyncStatusIcon(connectionInfo.syncStatus)}
                {connectionInfo.syncStatus}
              </Badge>
            </div>

            <Button 
              onClick={handleSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing Products' : 'Sync Products'}
            </Button>
          </div>

          <div className="flex gap-4 mt-4">
            <Button 
              variant="outline" 
              onClick={() => onViewProducts(marketplace)}
              className="flex-1"
            >
              <Eye className="w-4 h-4 mr-2" />
              View All Products
            </Button>
            <Button 
              variant="outline" 
              onClick={() => onViewAnalytics(marketplace)}
              className="flex-1"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              View Analytics
            </Button>
          </div>
        </CardContent>
      </Card>

      {connectionInfo.syncStatus === 'failed' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            The last synchronization failed. Please check your connection settings or try syncing again.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}