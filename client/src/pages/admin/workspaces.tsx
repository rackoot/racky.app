import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  Briefcase,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  User,
  Package,
  Store,
  Video,
  FileText,
  CreditCard
} from "lucide-react"
import { getAuthHeaders } from "@/lib/utils"

interface WorkspaceOwner {
  email: string
  firstName: string
  lastName: string
  fullName: string
}

interface WorkspaceSubscription {
  _id: string
  status: string
  planName: string
  contributorsHired: number
  amount: number
  currency: string
  startsAt: string
  endsAt: string
  nextBillingDate: string
  stripeSubscriptionId?: string
}

interface AdminWorkspace {
  _id: string
  name: string
  ownerId: string
  owner: WorkspaceOwner | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  subscription: WorkspaceSubscription | null
  stats: {
    storeCount: number
    productCount: number
    videosGenerated: number
    descriptionsGenerated: number
  }
}

interface WorkspacesResponse {
  success: boolean
  data: {
    workspaces: AdminWorkspace[]
    pagination: {
      currentPage: number
      totalPages: number
      totalCount: number
      hasNext: boolean
      hasPrev: boolean
    }
  }
}

export function AdminWorkspaces() {
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0
  })

  useEffect(() => {
    loadWorkspaces()
  }, [search])

  const loadWorkspaces = async (page = 1) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search })
      })

      const response = await fetch(`/api/admin/workspaces?${params}`, {
        headers: getAuthHeaders()
      })

      if (response.ok) {
        const data: WorkspacesResponse = await response.json()
        if (data.success) {
          setWorkspaces(data.data.workspaces)
          setPagination({
            currentPage: data.data.pagination.currentPage,
            totalPages: data.data.pagination.totalPages,
            totalCount: data.data.pagination.totalCount
          })
        } else {
          throw new Error('Failed to load workspaces')
        }
      } else {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      console.error('Error loading workspaces:', err)
      setError(err instanceof Error ? err.message : 'Failed to load workspaces')
    } finally {
      setLoading(false)
    }
  }

  if (loading && workspaces.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Workspace Management</h1>
          <p className="text-muted-foreground">View all workspaces and their resources</p>
        </div>
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading workspaces...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Workspace Management</h1>
        <p className="text-muted-foreground">View all workspaces and their resources</p>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Workspaces</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by workspace name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
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

      {/* Workspaces Table */}
      <Card>
        <CardHeader>
          <CardTitle>Workspaces ({pagination.totalCount})</CardTitle>
          <CardDescription>
            Showing {workspaces.length} of {pagination.totalCount} workspaces
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workspaces.length === 0 ? (
            <div className="text-center py-8">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Workspaces Found</h3>
              <p className="text-muted-foreground">
                {search ? "Try adjusting your search." : "No workspaces have been created yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Subscription</TableHead>
                    <TableHead className="text-center">Contributors</TableHead>
                    <TableHead className="text-center">Stores</TableHead>
                    <TableHead className="text-center">Products</TableHead>
                    <TableHead className="text-center">Videos</TableHead>
                    <TableHead className="text-center">Descriptions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspaces.map((workspace) => (
                    <TableRow key={workspace._id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{workspace.name}</div>
                            <div className="text-xs text-muted-foreground">
                              ID: {workspace._id.slice(-8)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {workspace.owner ? (
                          <div>
                            <div className="font-medium flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {workspace.owner.fullName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {workspace.owner.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No owner</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {workspace.subscription ? (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <CreditCard className="w-3 h-3 text-muted-foreground" />
                              <Badge
                                variant={
                                  workspace.subscription.status === 'ACTIVE'
                                    ? 'default'
                                    : workspace.subscription.status === 'TRIAL'
                                    ? 'secondary'
                                    : 'destructive'
                                }
                                className="text-xs"
                              >
                                {workspace.subscription.status}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              <div className="font-medium">{workspace.subscription.planName}</div>
                              <div>
                                {workspace.subscription.currency === 'USD' ? '$' : workspace.subscription.currency}
                                {workspace.subscription.amount.toFixed(2)}/mo
                              </div>
                              {workspace.subscription.nextBillingDate && (
                                <div>
                                  Renews: {new Date(workspace.subscription.nextBillingDate).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No subscription</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {workspace.subscription ? (
                          <span className="font-medium">{workspace.subscription.contributorsHired}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Store className="w-3 h-3 text-muted-foreground" />
                          <span className="font-medium">{workspace.stats.storeCount}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Package className="w-3 h-3 text-muted-foreground" />
                          <span className="font-medium">{workspace.stats.productCount}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Video className="w-3 h-3 text-blue-600" />
                          <span className="font-medium text-blue-600">
                            {workspace.stats.videosGenerated}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <FileText className="w-3 h-3 text-green-600" />
                          <span className="font-medium text-green-600">
                            {workspace.stats.descriptionsGenerated}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={workspace.isActive ? 'default' : 'secondary'}>
                          {workspace.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(workspace.createdAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

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
                      onClick={() => loadWorkspaces(pagination.currentPage - 1)}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.currentPage === pagination.totalPages}
                      onClick={() => loadWorkspaces(pagination.currentPage + 1)}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
