import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useWorkspace } from "@/components/workspace/workspace-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { videosApi, type AIVideo, type VideosQuery } from "@/api/videos"
import { VideoUsageProgress } from "@/components/videos/VideoUsageProgress"
import { Loader2, Search, Plus, Brain, Video, Calendar, Clock, AlertCircle, CheckCircle, X } from "lucide-react"

// Utility function to format dates
const formatDate = (date: string | Date) => {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function Videos() {
  const { currentWorkspace } = useWorkspace()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [videos, setVideos] = useState<AIVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFlashMessage, setShowFlashMessage] = useState(false)
  const [query, setQuery] = useState<VideosQuery>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  useEffect(() => {
    if (currentWorkspace) {
      loadVideos()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace, query])

  useEffect(() => {
    // Check for flash message from URL parameter
    if (searchParams.get('generated') === 'true') {
      setShowFlashMessage(true)
      // Remove the parameter from URL
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.delete('generated')
      setSearchParams(newSearchParams, { replace: true })

      // Auto-hide after 10 seconds
      const timer = setTimeout(() => {
        setShowFlashMessage(false)
      }, 10000)

      return () => clearTimeout(timer)
    }
  }, [searchParams, setSearchParams])

  const loadVideos = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await videosApi.getVideos(query)
      setVideos(response.videos)
      setPagination(response.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load videos")
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (search: string) => {
    setQuery(prev => ({ ...prev, search, page: 1 }))
  }

  const handleStatusFilter = (status: string) => {
    setQuery(prev => ({
      ...prev,
      status: status === 'all' ? undefined : status,
      page: 1
    }))
  }

  const handlePageChange = (newPage: number) => {
    setQuery(prev => ({ ...prev, page: newPage }))
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: "secondary" as const, icon: Clock, label: "Pending" },
      generating: { variant: "default" as const, icon: Loader2, label: "Generating" },
      completed: { variant: "success" as const, icon: CheckCircle, label: "Completed" },
      failed: { variant: "destructive" as const, icon: AlertCircle, label: "Failed" }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${status === 'generating' ? 'animate-spin' : ''}`} />
        {config.label}
      </Badge>
    )
  }

  if (loading && videos.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Videos</h1>
          <p className="text-muted-foreground">
            Manage and generate AI-powered product videos
          </p>
        </div>
        <Button onClick={() => navigate('/videos/generate')} size="lg">
          <Brain className="mr-2 h-5 w-5" />
          Generate Video
        </Button>
      </div>

      {/* Flash Message */}
      {showFlashMessage && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-900">Video Generation Started</h3>
              <p className="text-sm text-blue-700 mt-1">
                Your AI video is being generated. This typically takes up to 2 minutes. The video will appear in the list below once it's ready.
              </p>
            </div>
            <button
              onClick={() => setShowFlashMessage(false)}
              className="flex-shrink-0 text-blue-400 hover:text-blue-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Video Usage Progress */}
      <VideoUsageProgress />

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search videos..."
                  className="pl-9"
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>
            <Select
              value={query.status || 'all'}
              onValueChange={handleStatusFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="generating">Generating</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Videos Table */}
      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-destructive">{error}</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="p-12 text-center">
              <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No videos yet</h3>
              <p className="text-muted-foreground mb-4">
                Get started by generating your first AI video
              </p>
              <Button onClick={() => navigate('/videos/generate')}>
                <Plus className="mr-2 h-4 w-4" />
                Generate First Video
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Video</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videos.map((video) => (
                  <TableRow key={video._id}>
                    <TableCell className="font-medium">
                      <div>
                        <p className="font-medium">
                          {video.metadata?.title || `${video.template.replace('_', ' ')} Video`}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {video.metadata?.description || video.customInstructions}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {video.product ? (
                        <div className="flex items-center gap-2">
                          {video.product.imageUrl && (
                            <img
                              src={video.product.imageUrl}
                              alt={video.product.title}
                              className="h-8 w-8 rounded object-cover"
                            />
                          )}
                          <div>
                            <p className="text-sm font-medium line-clamp-1">
                              {video.product.title}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {video.product.marketplace}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {video.template.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(video.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {formatDate(video.generatedDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {video.metadata?.duration ? (
                        <span className="text-sm">{video.metadata.duration}s</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {video.status === 'completed' && video.metadata?.videoUrl && (
                          <Button size="sm" variant="outline">
                            View
                          </Button>
                        )}
                        {video.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => videosApi.generateVideo(video._id).then(loadVideos)}
                          >
                            Generate
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} videos
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}