import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useWorkspace } from "@/components/workspace/workspace-context"
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
  Trash2,
  Bot,
  AlertTriangle,
  CheckCircle2
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
  // Sync operations
  'SYNC_FROM_MARKETPLACE': Download,
  'SYNC_TO_MARKETPLACE': Upload,
  'BULK_SYNC': RefreshCw,
  
  // AI optimization actions
  'AI_OPTIMIZATION_GENERATED': Bot,
  'AI_OPTIMIZATION_ACCEPTED': CheckCircle2,
  'AI_OPTIMIZATION_REJECTED': AlertTriangle,
  'AI_OPTIMIZATION_APPLIED': Bot,
  'AI_BULK_SCAN_STARTED': Bot,
  'AI_BULK_SCAN_COMPLETED': CheckCircle2,
  
  // Product modifications
  'PRODUCT_CREATED': Package,
  'PRODUCT_UPDATED': Edit,
  'PRODUCT_DELETED': Trash2,
  'DESCRIPTION_UPDATED': Edit,
  'PRICE_UPDATED': Settings,
  'INVENTORY_UPDATED': Package,
  'STATUS_CHANGED': Settings,
  
  // Store operations
  'MARKETPLACE_CONNECTED': Upload,
  'MARKETPLACE_DISCONNECTED': Download,
  'STORE_CONFIGURATION_CHANGED': Settings,
  
  // Error tracking
  'SYNC_FAILED': AlertCircle,
  'API_ERROR': AlertCircle,
  'VALIDATION_ERROR': AlertTriangle
}

const statusColors: Record<string, string> = {
  'PENDING': 'bg-yellow-100 text-yellow-800',
  'IN_PROGRESS': 'bg-blue-100 text-blue-800',
  'SUCCESS': 'bg-green-100 text-green-800',
  'FAILED': 'bg-red-100 text-red-800',
  'CANCELLED': 'bg-gray-100 text-gray-800'
}

interface ProductHistoryItem {
  id: string;
  actionType: string;
  actionStatus: string;
  actionSource: string;
  title: string;
  description: string;
  metadata: {
    marketplace?: string;
    platform?: string;
    aiModel?: string;
    confidence?: number;
    tokensUsed?: number;
    originalContent?: string;
    newContent?: string;
    keywords?: string[];
    oldValue?: any;
    newValue?: any;
    fieldChanged?: string;
    errorCode?: string;
    errorMessage?: string;
    stackTrace?: string;
    apiEndpoint?: string;
    httpStatus?: number;
    responseTime?: number;
    ipAddress?: string;
    userAgent?: string;
    syncDirection?: string;
    recordsProcessed?: number;
    recordsTotal?: number;
    [key: string]: any;
  };
  startedAt: string;
  completedAt?: string;
  duration?: number;
  relatedJobId?: string;
  relatedBatchId?: string;
  parentHistoryId?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
  };
  storeConnection?: {
    id: string;
  };
}

interface ProductHistoryProps {
  productId: string;
}

export function ProductHistory({ productId }: ProductHistoryProps) {
  const [historyItems, setHistoryItems] = useState<ProductHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const { currentWorkspace } = useWorkspace()

  useEffect(() => {
    if (currentWorkspace && productId) {
      loadHistory()
    }
  }, [productId, currentWorkspace])

  const loadHistory = async () => {
    setLoading(true)
    setError("")
    
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`/api/products/${productId}/history?limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Workspace-ID': currentWorkspace!._id
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load product history')
      }

      const data = await response.json()
      setHistoryItems(data.data?.history || [])
    } catch (err) {
      console.error('Error loading product history:', err)
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
                {historyItems.map((item) => {
                  const IconComponent = actionIcons[item.actionType] || Settings
                  const platform = item.metadata.marketplace || item.metadata.platform
                  
                  return (
                    <TableRow key={item.id} className="hover:bg-slate-25">
                      <TableCell className="py-4 px-6 align-top">
                        <div className="flex items-center gap-2">
                          <IconComponent className="w-4 h-4 text-slate-600 flex-shrink-0" />
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-sm">{item.title}</span>
                            <Badge className={`w-fit ${statusColors[item.actionStatus] || 'bg-gray-100 text-gray-800'}`}>
                              {item.actionStatus.toLowerCase()}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6 align-top">
                        <p className="whitespace-normal break-words max-w-md leading-relaxed text-sm">
                          {item.description}
                        </p>
                        {/* Show additional metadata for relevant actions */}
                        {item.metadata.confidence && (
                          <div className="mt-1 text-xs text-slate-500">
                            Confidence: {Math.round(item.metadata.confidence * 100)}%
                          </div>
                        )}
                        {item.metadata.tokensUsed && (
                          <div className="mt-1 text-xs text-slate-500">
                            Tokens: {item.metadata.tokensUsed}
                          </div>
                        )}
                        {item.metadata.errorMessage && (
                          <div className="mt-1 text-xs text-red-600">
                            Error: {item.metadata.errorMessage}
                          </div>
                        )}
                        {item.duration && (
                          <div className="mt-1 text-xs text-slate-500">
                            Duration: {(item.duration / 1000).toFixed(1)}s
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-4 px-6 align-top">
                        {platform && (
                          <Badge className={platformColors[platform as keyof typeof platformColors] || 'bg-gray-100 text-gray-800'}>
                            {platform}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4 px-6 align-top text-sm text-slate-600">
                        <div className="capitalize">
                          {item.actionSource.toLowerCase().replace('_', ' ')}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6 align-top">
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimestamp(item.createdAt)}</span>
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