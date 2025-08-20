import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  History, 
  Clock, 
  AlertCircle, 
  Loader2,
  Package,
  RefreshCw,
  Settings,
  Upload,
  Download,
  Edit,
  Trash2
} from "lucide-react"

const platformColors = {
  shopify: 'bg-green-100 text-green-800',
  amazon: 'bg-orange-100 text-orange-800',
  mercadolibre: 'bg-yellow-100 text-yellow-800',
  woocommerce: 'bg-purple-100 text-purple-800',
  vtex: 'bg-red-100 text-red-800',
  facebook_shop: 'bg-blue-100 text-blue-800',
  google_shopping: 'bg-red-100 text-red-800'
}

const actionIcons: Record<string, any> = {
  'Product Created': Package,
  'Product Updated': Edit,
  'Product Synced': RefreshCw,
  'Inventory Updated': Settings,
  'Price Updated': Settings,
  'Description Updated': Edit,
  'Images Updated': Upload,
  'Product Published': Upload,
  'Product Unpublished': Download,
  'Product Archived': Trash2,
  'Status Changed': Settings,
  'Optimization Applied': RefreshCw,
  'AI Suggestion Generated': RefreshCw,
  'Sync Completed': RefreshCw,
  'Sync Failed': AlertCircle
}

interface ProductHistoryItem {
  action: string;
  details: string;
  platform?: string;
  timestamp: string;
  user?: string;
  metadata?: any;
}

interface ProductHistoryProps {
  productId: string;
}

export function ProductHistory({ productId }: ProductHistoryProps) {
  const [historyItems, setHistoryItems] = useState<ProductHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    loadHistory()
  }, [productId])

  const loadHistory = async () => {
    setLoading(true)
    setError("")
    
    try {
      // For now, we'll generate mock history data
      // In a real implementation, this would fetch from an API
      const mockHistory: ProductHistoryItem[] = [
        {
          action: "Product Created",
          details: "Product was initially created and imported from Shopify store",
          platform: "shopify",
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          user: "System Import"
        },
        {
          action: "Inventory Updated",
          details: "Inventory quantity changed from 15 to 12 units during routine sync",
          platform: "shopify",
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          user: "Auto Sync"
        },
        {
          action: "AI Suggestion Generated",
          details: "AI-optimized description suggestion created for Amazon marketplace",
          platform: "amazon",
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          user: "AI Assistant"
        },
        {
          action: "Price Updated",
          details: "Product price adjusted from $29.99 to $27.99 based on market analysis",
          platform: "shopify",
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          user: "John Doe"
        },
        {
          action: "Optimization Applied",
          details: "Accepted AI-generated description optimization for Amazon marketplace",
          platform: "amazon",
          timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
          user: "John Doe"
        },
        {
          action: "Sync Completed",
          details: "Successfully synchronized product data across all connected platforms",
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          user: "Auto Sync"
        },
        {
          action: "Images Updated",
          details: "Product image gallery updated with 3 new high-resolution images",
          platform: "shopify",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          user: "Jane Smith"
        },
        {
          action: "Description Updated",
          details: "Product description manually edited to include new feature highlights and benefits",
          platform: "shopify",
          timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          user: "John Doe"
        }
      ]
      
      setHistoryItems(mockHistory)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load product history")
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60)
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours)
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`
    } else if (diffInHours < 24 * 7) {
      const days = Math.floor(diffInHours / 24)
      return `${days} day${days !== 1 ? 's' : ''} ago`
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Product History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Product History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Product History ({historyItems.length} events)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Complete audit trail of all changes and activities for this product
        </p>
      </CardHeader>
      <CardContent>
        {historyItems.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No History Available</h3>
            <p className="text-muted-foreground">
              Product history will appear here as changes are made.
            </p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 border-b-2 border-slate-200">
                  <TableHead className="text-slate-900 font-semibold py-4 px-6 min-w-[140px]">
                    Action
                  </TableHead>
                  <TableHead className="text-slate-900 font-semibold py-4 px-6 min-w-[300px]">
                    Details
                  </TableHead>
                  <TableHead className="text-slate-900 font-semibold py-4 px-6">
                    Platform
                  </TableHead>
                  <TableHead className="text-slate-900 font-semibold py-4 px-6">
                    User
                  </TableHead>
                  <TableHead className="text-slate-900 font-semibold py-4 px-6 min-w-[120px]">
                    Time
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyItems.map((item, index) => {
                  const IconComponent = actionIcons[item.action] || Settings
                  
                  return (
                    <TableRow key={index} className="hover:bg-slate-25">
                      <TableCell className="py-4 px-6 align-top">
                        <div className="flex items-center gap-2">
                          <IconComponent className="w-4 h-4 text-slate-600 flex-shrink-0" />
                          <span className="font-medium text-sm">{item.action}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6 align-top">
                        <p className="whitespace-normal break-words max-w-md leading-relaxed text-sm">
                          {item.details}
                        </p>
                      </TableCell>
                      <TableCell className="py-4 px-6 align-top">
                        {item.platform && (
                          <Badge className={platformColors[item.platform as keyof typeof platformColors] || 'bg-gray-100 text-gray-800'}>
                            {item.platform}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4 px-6 align-top text-sm text-slate-600">
                        {item.user || 'System'}
                      </TableCell>
                      <TableCell className="py-4 px-6 align-top">
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimestamp(item.timestamp)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}