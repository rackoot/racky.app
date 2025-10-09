import { useState, useEffect } from "react"
import { useWorkspace } from "@/components/workspace/workspace-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { videosApi, type VideoUsageStats } from "@/api"
import { Video, AlertTriangle } from "lucide-react"

interface VideoUsageProgressProps {
  showTitle?: boolean
  className?: string
}

export function VideoUsageProgress({ showTitle = true, className = "" }: VideoUsageProgressProps) {
  const { currentWorkspace } = useWorkspace()
  const [stats, setStats] = useState<VideoUsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (currentWorkspace) {
      loadUsageStats()
    }
  }, [currentWorkspace])

  const loadUsageStats = async () => {
    setLoading(true)
    setError(null)

    try {
      const usageStats = await videosApi.getUsageStats()
      setStats(usageStats)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load usage stats")
    } finally {
      setLoading(false)
    }
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500"
    if (percentage >= 75) return "bg-yellow-500"
    return "bg-blue-500"
  }

  const getStatusBadge = (percentage: number) => {
    if (percentage >= 100) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Limit Reached
        </Badge>
      )
    }
    if (percentage >= 90) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Almost Full
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <Video className="h-3 w-3" />
        Available
      </Badge>
    )
  }

  if (loading) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Video Usage</CardTitle>
          </CardHeader>
        )}
        <CardContent className={showTitle ? "pt-2" : "p-4"}>
          <div className="space-y-2">
            <div className="h-2 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Video Usage</CardTitle>
          </CardHeader>
        )}
        <CardContent className={showTitle ? "pt-2" : "p-4"}>
          <p className="text-sm text-red-500">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!stats) return null

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Video Usage</CardTitle>
        </CardHeader>
      )}
      <CardContent className={showTitle ? "pt-2" : "p-4"}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {stats.used} / {stats.limit} videos used
            </span>
            {getStatusBadge(stats.percentage)}
          </div>

          <Progress
            value={stats.percentage}
            className="h-2"
            aria-label={`${stats.percentage}% of video limit used`}
          />

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{stats.remaining} remaining</span>
            <span>{stats.percentage}% used</span>
          </div>

          {stats.percentage >= 90 && (
            <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-200">
              {stats.percentage >= 100
                ? "You've reached your monthly video limit. Your subscription will renew next month."
                : "You're approaching your monthly video limit. Consider upgrading your plan for more videos."}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}