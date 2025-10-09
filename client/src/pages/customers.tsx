import { useState, useEffect } from "react"
import { useWorkspace } from "@/components/workspace/workspace-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  ShoppingBag
} from "lucide-react"
import { customersApi, type Customer } from "@/api"

export function Customers() {
  const { currentWorkspace } = useWorkspace()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState("")
  const [syncSuccess, setSyncSuccess] = useState("")

  const loadCustomers = async () => {
    if (!currentWorkspace) return

    setLoading(true)
    setError("")

    try {
      const data = await customersApi.getAllCustomers()
      setCustomers(data.customers)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentWorkspace) {
      loadCustomers()
    }
  }, [currentWorkspace])

  const handleSyncCustomers = async () => {
    setSyncing(true)
    setError("")
    setSyncSuccess("")

    try {
      const result = await customersApi.syncAllStores()
      setSyncSuccess(`Successfully synced ${result.syncedCustomers} customers (${result.newCustomers} new, ${result.updatedCustomers} updated)`)

      if (result.errors.length > 0) {
        setError(`Some stores had issues: ${result.errors.join(', ')}`)
      }

      // Reload customers after sync
      await loadCustomers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync customers")
    } finally {
      setSyncing(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getMarketplaceBadgeColor = (marketplace: string) => {
    const colors: Record<string, string> = {
      shopify: 'bg-green-100 text-green-800',
      amazon: 'bg-orange-100 text-orange-800',
      vtex: 'bg-blue-100 text-blue-800',
      mercadolibre: 'bg-yellow-100 text-yellow-800',
      woocommerce: 'bg-purple-100 text-purple-800',
      facebook_shop: 'bg-blue-100 text-blue-800',
      google_shopping: 'bg-red-100 text-red-800'
    }
    return colors[marketplace] || 'bg-gray-100 text-gray-800'
  }

  if (!currentWorkspace) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No workspace selected</h3>
          <p className="text-muted-foreground">
            Please select a workspace to view customers.
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
            <Users className="h-8 w-8" />
            Customers
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and sync customers from your connected marketplaces
          </p>
        </div>

        <Button
          onClick={handleSyncCustomers}
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
              Sync Customers
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
            {customers.length > 0 ? `${customers.length} Customers` : 'Customers'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2 text-muted-foreground">Loading customers...</span>
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No customers found</h3>
              <p className="text-muted-foreground mb-4">
                Connect your stores and sync to see customers here
              </p>
              <p className="text-sm text-muted-foreground">
                Current workspace: <span className="font-medium">{currentWorkspace.name}</span>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Showing {customers.length} customers from your connected stores
              </div>
              <div className="grid gap-4">
                {customers.slice(0, 10).map((customer) => (
                  <div key={customer._id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium truncate">
                            {customer.firstName && customer.lastName
                              ? `${customer.firstName} ${customer.lastName}`
                              : customer.email || 'Unknown Customer'}
                          </h4>
                          <Badge className={getMarketplaceBadgeColor(customer.marketplace)}>
                            {customer.marketplace}
                          </Badge>
                          {customer.acceptsMarketing && (
                            <Badge variant="outline" className="text-xs">
                              Marketing
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-muted-foreground">
                          {customer.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <span className="truncate">{customer.email}</span>
                            </div>
                          )}

                          {customer.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              <span className="truncate">{customer.phone}</span>
                            </div>
                          )}

                          {customer.defaultAddress && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">
                                {customer.defaultAddress.city}, {customer.defaultAddress.country}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span className="truncate">
                              {new Date(customer.createdDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right ml-4 flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(customer.totalSpent)}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <ShoppingBag className="h-3 w-3" />
                          {customer.totalOrders} orders
                        </div>
                        {customer.lastOrderDate && (
                          <div className="text-xs text-muted-foreground">
                            Last: {new Date(customer.lastOrderDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {customers.length > 10 && (
                <p className="text-sm text-muted-foreground text-center">
                  Showing first 10 customers. Full table view coming soon!
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}