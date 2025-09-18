import { useState, useEffect, useMemo } from "react"
import { useWorkspace } from "@/components/workspace/workspace-context"
import { tasksApi, type TaskAnalytics, type PaginatedTaskResponse, type TaskQueryParams } from "@/api/tasks"
import type { TaskUsageChartData, DailyUsagePoint, TaskTypeStats } from "@/api/types"

interface UseTaskAnalyticsOptions {
  dateRange?: {
    startDate: Date
    endDate: Date
  }
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseTaskAnalyticsReturn {
  // Raw analytics data
  analytics: TaskAnalytics | null

  // Processed chart data
  chartData: TaskUsageChartData | null

  // Task list data
  tasks: PaginatedTaskResponse | null

  // Loading states
  isLoading: boolean
  isLoadingTasks: boolean
  isRefreshing: boolean

  // Error handling
  error: string | null
  tasksError: string | null

  // Actions
  refresh: () => Promise<void>
  loadTasks: (params?: TaskQueryParams) => Promise<void>

  // Date range management
  dateRange: { startDate: Date; endDate: Date }
  setDateRange: (range: { startDate: Date; endDate: Date }) => void

  // Computed values
  totalUnitsConsumed: number
  averageUnitsPerDay: number
  mostUsedTaskType: TaskTypeStats | null
  completionRate: number
  dailyAverage: number
}

export function useTaskAnalytics(options: UseTaskAnalyticsOptions = {}): UseTaskAnalyticsReturn {
  const {
    dateRange: initialDateRange,
    autoRefresh = false,
    refreshInterval = 60000
  } = options

  const { currentWorkspace } = useWorkspace()

  // Default to current month if no date range provided
  const defaultDateRange = useMemo(() => {
    if (initialDateRange) return initialDateRange

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    return { startDate: startOfMonth, endDate: endOfMonth }
  }, [initialDateRange])

  const [dateRange, setDateRange] = useState(defaultDateRange)
  const [analytics, setAnalytics] = useState<TaskAnalytics | null>(null)
  const [tasks, setTasks] = useState<PaginatedTaskResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tasksError, setTasksError] = useState<string | null>(null)

  // Process analytics data into chart-friendly format
  const chartData = useMemo((): TaskUsageChartData | null => {
    if (!analytics) return null

    // Process daily usage data
    const dailyUsage: DailyUsagePoint[] = analytics.usageByDay.map(day => {
      const date = new Date(day.date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      date.setHours(0, 0, 0, 0)

      return {
        date: day.date,
        taskCount: day.taskCount,
        unitsConsumed: day.unitsConsumed,
        dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday: date.getTime() === today.getTime()
      }
    })

    // Process task type breakdown with colors and percentages
    const totalUnits = analytics.totalUnitsConsumed
    const taskTypeBreakdown: TaskTypeStats[] = analytics.tasksByType.map((type, index) => {
      const colors = [
        'text-blue-500',
        'text-green-500',
        'text-purple-500',
        'text-yellow-500',
        'text-red-500',
        'text-indigo-500',
        'text-pink-500',
        'text-teal-500',
        'text-orange-500',
        'text-cyan-500'
      ]

      const icons = [
        'zap',
        'database',
        'settings',
        'send',
        'download',
        'upload',
        'refresh-cw',
        'search',
        'file-text',
        'users'
      ]

      return {
        taskTypeId: type.taskTypeId,
        name: type.taskTypeName,
        unitCost: Math.round(type.totalUnits / type.count), // Calculate average cost
        tasksCount: type.count,
        unitsConsumed: type.totalUnits,
        percentageOfTotal: totalUnits > 0 ? Math.round((type.totalUnits / totalUnits) * 100) : 0,
        color: colors[index % colors.length],
        icon: icons[index % icons.length]
      }
    }).sort((a, b) => b.unitsConsumed - a.unitsConsumed)

    // Calculate weekly trend (compare this week vs previous week)
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const currentWeekUnits = dailyUsage
      .filter(day => new Date(day.date) > weekAgo)
      .reduce((sum, day) => sum + day.unitsConsumed, 0)

    const previousWeekUnits = dailyUsage
      .filter(day => {
        const date = new Date(day.date)
        const twoWeeksAgo = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000)
        return date > twoWeeksAgo && date <= weekAgo
      })
      .reduce((sum, day) => sum + day.unitsConsumed, 0)

    const weeklyTrend = {
      current: currentWeekUnits,
      previous: previousWeekUnits,
      change: previousWeekUnits > 0
        ? Math.round(((currentWeekUnits - previousWeekUnits) / previousWeekUnits) * 100)
        : 0
    }

    return {
      dailyUsage,
      taskTypeBreakdown,
      weeklyTrend
    }
  }, [analytics])

  // Computed values
  const totalUnitsConsumed = analytics?.totalUnitsConsumed || 0
  const completionRate = analytics && analytics.totalTasks > 0
    ? Math.round((analytics.completedTasks / analytics.totalTasks) * 100)
    : 0

  const averageUnitsPerDay = useMemo(() => {
    if (!analytics || analytics.usageByDay.length === 0) return 0

    const totalDays = analytics.usageByDay.length
    return Math.round(totalUnitsConsumed / totalDays)
  }, [analytics, totalUnitsConsumed])

  const dailyAverage = useMemo(() => {
    if (!analytics || analytics.usageByDay.length === 0) return 0

    const totalTasks = analytics.usageByDay.reduce((sum, day) => sum + day.taskCount, 0)
    return Math.round(totalTasks / analytics.usageByDay.length)
  }, [analytics])

  const mostUsedTaskType = useMemo((): TaskTypeStats | null => {
    if (!chartData || chartData.taskTypeBreakdown.length === 0) return null
    return chartData.taskTypeBreakdown[0] // Already sorted by units consumed
  }, [chartData])

  // Load analytics data
  const loadAnalytics = async (showRefreshing = false) => {
    if (!currentWorkspace) return

    try {
      if (showRefreshing) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      const analyticsData = await tasksApi.getTaskAnalytics(
        dateRange.startDate.toISOString(),
        dateRange.endDate.toISOString()
      )

      setAnalytics(analyticsData)
    } catch (err) {
      console.error('Error loading task analytics:', err)
      setError(err instanceof Error ? err.message : 'Error loading analytics')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  // Load tasks data
  const loadTasks = async (params: TaskQueryParams = {}) => {
    if (!currentWorkspace) return

    try {
      setIsLoadingTasks(true)
      setTasksError(null)

      const tasksData = await tasksApi.getTasks({
        page: 1,
        limit: 20,
        startDate: dateRange.startDate.toISOString().split('T')[0],
        endDate: dateRange.endDate.toISOString().split('T')[0],
        ...params
      })

      setTasks(tasksData)
    } catch (err) {
      console.error('Error loading tasks:', err)
      setTasksError(err instanceof Error ? err.message : 'Error loading tasks')
    } finally {
      setIsLoadingTasks(false)
    }
  }

  // Refresh all data
  const refresh = async () => {
    await Promise.all([
      loadAnalytics(true),
      loadTasks()
    ])
  }

  // Load data when workspace or date range changes
  useEffect(() => {
    if (currentWorkspace) {
      loadAnalytics()
      loadTasks()
    } else {
      setAnalytics(null)
      setTasks(null)
      setIsLoading(false)
    }
  }, [currentWorkspace, dateRange])

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !currentWorkspace) return

    const interval = setInterval(() => {
      refresh()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, currentWorkspace, dateRange])

  return {
    // Raw analytics data
    analytics,

    // Processed chart data
    chartData,

    // Task list data
    tasks,

    // Loading states
    isLoading,
    isLoadingTasks,
    isRefreshing,

    // Error handling
    error,
    tasksError,

    // Actions
    refresh,
    loadTasks,

    // Date range management
    dateRange,
    setDateRange,

    // Computed values
    totalUnitsConsumed,
    averageUnitsPerDay,
    mostUsedTaskType,
    completionRate,
    dailyAverage,
  }
}

// Simplified hook for getting quick analytics
export function useTaskSummary() {
  const { currentWorkspace } = useWorkspace()
  const [summary, setSummary] = useState({
    totalTasks: 0,
    completedTasks: 0,
    totalUnits: 0,
    isLoading: true
  })

  useEffect(() => {
    if (!currentWorkspace) return

    const loadSummary = async () => {
      try {
        const analytics = await tasksApi.getCurrentMonthAnalytics()
        setSummary({
          totalTasks: analytics.totalTasks,
          completedTasks: analytics.completedTasks,
          totalUnits: analytics.totalUnitsConsumed,
          isLoading: false
        })
      } catch (err) {
        console.error('Error loading task summary:', err)
        setSummary(prev => ({ ...prev, isLoading: false }))
      }
    }

    loadSummary()
  }, [currentWorkspace])

  return summary
}