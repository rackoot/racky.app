import { useEffect, useState } from "react"
import { adminApi } from '@/api'
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
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
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
  Shield, 
  User, 
  UserCheck, 
  UserX, 
  CreditCard,
  Trash2,
  AlertTriangle
} from "lucide-react"
import { getAuthHeaders } from "@/lib/utils"
import { getCurrentUser } from "@/lib/auth"

interface AdminUser {
  _id: string
  email: string
  firstName: string
  lastName: string
  role: 'USER' | 'SUPERADMIN'
  isActive: boolean
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'
  subscriptionPlan: 'BASIC' | 'PRO' | 'ENTERPRISE'
  createdAt: string
  stats: {
    storeCount: number
    productCount: number
    currentUsage: Record<string, number>
  }
  subscriptionInfo: {
    status: string
    plan: string
    hasActiveSubscription: boolean
    isTrialExpired: boolean
    trialEndsAt?: string
  }
}

interface UsersResponse {
  success: boolean
  data: {
    users: AdminUser[]
    pagination: {
      currentPage: number
      totalPages: number
      totalCount: number
      hasNext: boolean
      hasPrev: boolean
    }
    stats: {
      totalUsers: number
      activeUsers: number
      trialUsers: number
      activeSubscriptions: number
      superAdmins: number
    }
  }
}

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [actionDialog, setActionDialog] = useState<{
    type: 'status' | 'role' | 'delete' | null
    user: AdminUser | null
  }>({ type: null, user: null })
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0
  })

  const currentUser = getCurrentUser()

  useEffect(() => {
    loadUsers()
  }, [search, roleFilter, statusFilter])

  const loadUsers = async (page = 1) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(roleFilter !== 'all' && { role: roleFilter }),
        ...(statusFilter !== 'all' && { subscriptionStatus: statusFilter })
      })

      console.log('Loading users with headers:', getAuthHeaders())
      const response = await fetch(`/api/admin/users?${params}`, {
        headers: getAuthHeaders()
      })

      console.log('Response status:', response.status)
      
      if (response.ok) {
        const data: UsersResponse = await response.json()
        console.log('Response data:', data)
        if (data.success) {
          setUsers(data.data.users)
          setPagination({
            currentPage: data.data.pagination.currentPage,
            totalPages: data.data.pagination.totalPages,
            totalCount: data.data.pagination.totalCount
          })
        } else {
          throw new Error('Failed to load users')
        }
      } else {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      console.error('Error loading users:', err)
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleUserAction = async (action: 'activate' | 'deactivate' | 'role' | 'delete', user: AdminUser, newValue?: string) => {
    try {
      let endpoint = ''
      let body = {}

      switch (action) {
        case 'activate':
        case 'deactivate':
          endpoint = `http://localhost:5000/api/admin/users/${user._id}/status`
          body = { isActive: action === 'activate' }
          break
        case 'role':
          endpoint = `http://localhost:5000/api/admin/users/${user._id}/role`
          body = { role: newValue }
          break
        case 'delete':
          endpoint = `http://localhost:5000/api/admin/users/${user._id}?force=true`
          break
      }

      const method = action === 'delete' ? 'DELETE' : 'PUT'
      const response = await fetch(endpoint, {
        method,
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        ...(method !== 'DELETE' && { body: JSON.stringify(body) })
      })

      if (response.ok) {
        await loadUsers(pagination.currentPage)
        setActionDialog({ type: null, user: null })
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Action failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    }
  }

  const getStatusBadge = (user: AdminUser) => {
    if (!user.isActive) {
      return <Badge variant="destructive">Deactivated</Badge>
    }
    
    switch (user.subscriptionStatus) {
      case 'ACTIVE':
        return <Badge variant="default">Active</Badge>
      case 'TRIAL':
        return <Badge variant="secondary">Trial</Badge>
      case 'SUSPENDED':
        return <Badge variant="destructive">Suspended</Badge>
      case 'CANCELLED':
        return <Badge variant="outline">Cancelled</Badge>
      default:
        return <Badge variant="outline">{user.subscriptionStatus}</Badge>
    }
  }

  const getRoleBadge = (role: string) => {
    return role === 'SUPERADMIN' ? (
      <Badge variant="destructive">
        <Shield className="w-3 h-3 mr-1" />
        Super Admin
      </Badge>
    ) : (
      <Badge variant="outline">
        <User className="w-3 h-3 mr-1" />
        User
      </Badge>
    )
  }

  if (loading && users.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage user accounts and subscriptions</p>
        </div>
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">Manage user accounts and subscriptions</p>
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
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="USER">Users</SelectItem>
                <SelectItem value="SUPERADMIN">Admins</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-32">
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

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({pagination.totalCount})</CardTitle>
          <CardDescription>
            Showing {users.length} of {pagination.totalCount} users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user._id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {user.role === 'SUPERADMIN' ? (
                      <Shield className="w-5 h-5 text-primary" />
                    ) : (
                      <User className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">
                        {user.firstName} {user.lastName}
                      </h3>
                      {getRoleBadge(user.role)}
                      {getStatusBadge(user)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>{user.subscriptionPlan} plan</span>
                      <span>{user.stats.storeCount} stores</span>
                      <span>{user.stats.productCount} products</span>
                      <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
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
                    
                    {user.isActive ? (
                      <DropdownMenuItem 
                        onClick={() => setActionDialog({ type: 'status', user })}
                        className="text-yellow-600"
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        Deactivate
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem 
                        onClick={() => setActionDialog({ type: 'status', user })}
                        className="text-green-600"
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        Activate
                      </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuItem onClick={() => setActionDialog({ type: 'role', user })}>
                      <Shield className="mr-2 h-4 w-4" />
                      Change Role
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Manage Subscription
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    {user._id !== currentUser?._id && (
                      <DropdownMenuItem 
                        onClick={() => setActionDialog({ type: 'delete', user })}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete User
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>

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
                  onClick={() => loadUsers(pagination.currentPage - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.currentPage === pagination.totalPages}
                  onClick={() => loadUsers(pagination.currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Dialogs */}
      <Dialog open={actionDialog.type === 'status'} onOpenChange={() => setActionDialog({ type: null, user: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.user?.isActive ? 'Deactivate' : 'Activate'} User
            </DialogTitle>
            <DialogDescription>
              {actionDialog.user?.isActive 
                ? 'This will prevent the user from accessing their account.'
                : 'This will restore the user\'s access to their account.'
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ type: null, user: null })}>
              Cancel
            </Button>
            <Button
              variant={actionDialog.user?.isActive ? 'destructive' : 'default'}
              onClick={() => actionDialog.user && handleUserAction(
                actionDialog.user.isActive ? 'deactivate' : 'activate',
                actionDialog.user
              )}
            >
              {actionDialog.user?.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialog.type === 'delete'} onOpenChange={() => setActionDialog({ type: null, user: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete User Account</DialogTitle>
            <DialogDescription>
              This will permanently delete the user and all their data including stores, products, and usage history. 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ type: null, user: null })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => actionDialog.user && handleUserAction('delete', actionDialog.user)}
            >
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}