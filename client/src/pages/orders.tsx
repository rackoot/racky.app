import { useState, useEffect } from "react"
import { useWorkspace } from "@/components/workspace/workspace-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ShoppingCart,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle
} from "lucide-react"
import { ordersApi, type Order } from "@/api/orders"

export function Orders() {
  const { currentWorkspace } = useWorkspace()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState("")
  const [syncSuccess, setSyncSuccess] = useState("")

  const loadOrders = async () => {
    if (!currentWorkspace) return

    setLoading(true)
    setError("")

    try {
      const data = await ordersApi.getAllOrders()
      setOrders(data.orders)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentWorkspace) {
      loadOrders()
    }
  }, [currentWorkspace])

  const handleSyncOrders = async () => {
    setSyncing(true)
    setError("")
    setSyncSuccess("")

    try {
      const result = await ordersApi.syncAllStores()
      setSyncSuccess(`Successfully synced ${result.syncedOrders} orders (${result.newOrders} new, ${result.updatedOrders} updated)`)

      if (result.errors.length > 0) {
        setError(`Some stores had issues: ${result.errors.join(', ')}`)
      }

      // Reload orders after sync
      await loadOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync orders")
    } finally {
      setSyncing(false)
    }
  }

  if (!currentWorkspace) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No workspace selected</h3>
          <p className="text-muted-foreground">
            Please select a workspace to view orders.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-8 w-8" />
            Orders
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and sync orders from your connected marketplaces
          </p>
        </div>

        <Button
          onClick={handleSyncOrders}
          disabled={syncing}
          className="flex items-center gap-2"
        >
          {syncing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Sync Orders
            </>
          )}
        </Button>
      </div>

      {/* Success/Error Messages */}
      {syncSuccess && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {syncSuccess}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {orders.length > 0 ? `${orders.length} Orders` : 'Orders'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2 text-muted-foreground">Loading orders...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No orders found</h3>
              <p className="text-muted-foreground mb-4">
                Connect your stores and sync to see orders here
              </p>
              <p className="text-sm text-muted-foreground">
                Current workspace: <span className="font-medium">{currentWorkspace.name}</span>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Showing {orders.length} orders from your connected stores
              </div>
              <div className="grid gap-4">
                {orders.slice(0, 10).map((order) => (
                  <div key={order._id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">Order #{order.orderNumber}</h4>
                        <p className="text-sm text-muted-foreground">
                          {order.marketplace} • {order.items.length} items
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.orderDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${order.total}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {order.status}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {orders.length > 10 && (
                <p className="text-sm text-muted-foreground text-center">
                  Showing first 10 orders. Full table view coming soon!
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}