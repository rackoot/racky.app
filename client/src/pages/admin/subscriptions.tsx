import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Search, 
  MoreHorizontal, 
  CreditCard, 
  User, 
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle
} from "lucide-react"
import { getAuthHeaders } from "@/lib/utils"

interface AdminSubscription {
  _id: string
  userId: string
  contributorType?: string
  status: string
  startDate?: string
  endDate?: string
  trialEndDate?: string
  amount: number
  currency: string
  paymentMethod?: string
  createdAt: string
  updatedAt: string
  user: {
    _id: string
    email: string
    firstName: string
    lastName: string
    isActive: boolean
  }
}

interface SubscriptionsResponse {
  success: boolean
  data: {
    subscriptions: AdminSubscription[]
    pagination: {
      currentPage: number
      totalPages: number
      totalCount: number
      hasNext: boolean
      hasPrev: boolean
    }
    stats: {
      totalSubscriptions: number
      activeSubscriptions: number
      trialSubscriptions: number
      suspendedSubscriptions: number
      cancelledSubscriptions: number
      basicPlan: number
      proPlan: number
      enterprisePlan: number
    }
  }
}

export function AdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [planFilter, setPlanFilter] = useState<string>("all")
  const [stats, setStats] = useState({
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    trialSubscriptions: 0,
    suspendedSubscriptions: 0,
    cancelledSubscriptions: 0,
    basicPlan: 0,
    proPlan: 0,
    enterprisePlan: 0
  })
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0
  })

  useEffect(() => {
    loadSubscriptions()
  }, [search, statusFilter, planFilter])

  const loadSubscriptions = async (page = 1) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(planFilter !== 'all' && { contributorType: planFilter })
      })

      console.log('Loading subscriptions with params:', params.toString())
      const response = await fetch(`/api/admin/subscriptions?${params}`, {
        headers: getAuthHeaders()
      })

      console.log('Subscriptions response status:', response.status)

      if (response.ok) {
        const data: SubscriptionsResponse = await response.json()
        console.log('Subscriptions data:', data)
        if (data.success) {
          setSubscriptions(data.data.subscriptions)
          setStats(data.data.stats)
          setPagination({
            currentPage: data.data.pagination.currentPage,
            totalPages: data.data.pagination.totalPages,
            totalCount: data.data.pagination.totalCount
          })
        } else {
          throw new Error('Failed to load subscriptions')
        }
      } else {
        const errorText = await response.text()
        console.error('Subscriptions error response:', errorText)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscriptions')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return <Badge variant="default">Active</Badge>
      case 'TRIAL':
        return <Badge variant="secondary">Trial</Badge>
      case 'SUSPENDED':
        return <Badge variant="destructive">Suspended</Badge>
      case 'CANCELLED':
        return <Badge variant="outline">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>
    }
  }

  const getPlanBadge = (contributorType: string | undefined) => {
    if (!contributorType) return null;
    
    const planMap: Record<string, { label: string; className: string }> = {
      // Old format
      JUNIOR: { label: 'Junior', className: 'bg-blue-100 text-blue-800' },
      SENIOR: { label: 'Senior', className: 'bg-purple-100 text-purple-800' },
      EXECUTIVE: { label: 'Executive', className: 'bg-gold-100 text-gold-800' },
      // New format
      BASIC: { label: 'Basic', className: 'bg-blue-100 text-blue-800' },
      PRO: { label: 'Pro', className: 'bg-purple-100 text-purple-800' },
      ENTERPRISE: { label: 'Enterprise', className: 'bg-gold-100 text-gold-800' }
    };
    
    const plan = planMap[contributorType] || { label: contributorType, className: '' };
    
    return (
      <Badge variant="outline" className={plan.className}>
        {plan.label}
      </Badge>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount)
  }

  if (loading && subscriptions.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Subscription Management</h1>
          <p className="text-muted-foreground">Monitor and manage user subscriptions</p>
        </div>
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading subscriptions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Subscription Management</h1>
        <p className="text-muted-foreground">Monitor and manage user subscriptions</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSubscriptions}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeSubscriptions}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.trialSubscriptions}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.suspendedSubscriptions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by email, name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="TRIAL">Trial</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="BASIC">Basic</SelectItem>
                <SelectItem value="PRO">Pro</SelectItem>
                <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Subscriptions ({pagination.totalCount})</CardTitle>
          <CardDescription>
            Showing {subscriptions.length} of {pagination.totalCount} subscriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {subscriptions.map((subscription) => (
              <div key={subscription._id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-primary" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">
                        {subscription.user.firstName} {subscription.user.lastName}
                      </h3>
                      {getPlanBadge(subscription.contributorType)}
                      {getStatusBadge(subscription.status)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{subscription.user.email}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>Started {formatDate(subscription.createdAt)}</span>
                      {subscription.trialEndDate && (
                        <span>Trial ends {formatDate(subscription.trialEndDate)}</span>
                      )}
                      {subscription.endDate && (
                        <span>Ends {formatDate(subscription.endDate)}</span>
                      )}
                      {subscription.amount > 0 && (
                        <span>{formatCurrency(subscription.amount / 100, subscription.currency || 'USD')}</span>
                      )}
                    </div>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem>
                      <User className="mr-2 h-4 w-4" />
                      View User Details
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Manage Subscription
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem>
                      <DollarSign className="mr-2 h-4 w-4" />
                      View Billing History
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    {subscription.status === 'ACTIVE' && (
                      <DropdownMenuItem className="text-yellow-600">
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        Suspend Subscription
                      </DropdownMenuItem>
                    )}
                    
                    {subscription.status === 'SUSPENDED' && (
                      <DropdownMenuItem className="text-green-600">
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Reactivate Subscription
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>

          {subscriptions.length === 0 && !loading && (
            <div className="text-center py-10">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No subscriptions found</h3>
              <p className="text-muted-foreground">
                {search || statusFilter !== 'all' || planFilter !== 'all'
                  ? 'Try adjusting your search criteria'
                  : 'No subscriptions have been created yet'
                }
              </p>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-muted-foreground">
                Page {pagination.currentPage} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.currentPage === 1}
                  onClick={() => loadSubscriptions(pagination.currentPage - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.currentPage === pagination.totalPages}
                  onClick={() => loadSubscriptions(pagination.currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}