import { useState, useEffect, useMemo } from "react"
import { useWorkspace } from "@/components/workspace/workspace-context"
import { tasksApi, type WorkspaceUsageCalculation, type TaskExecutionCheck } from "@/api/tasks"
import { subscriptionApi, type SubscriptionInfo } from "@/api/subscription"
import type { TaskUsageMetrics } from "@/api/types"

interface UseTaskUsageOptions {
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseTaskUsageReturn {
  // Data
  usage: WorkspaceUsageCalculation | null
  subscription: SubscriptionInfo | null
  metrics: TaskUsageMetrics | null

  // Loading states
  isLoading: boolean
  isRefreshing: boolean

  // Error handling
  error: string | null

  // Actions
  refresh: () => Promise<void>
  checkTaskExecution: (taskTypeId: string, quantity?: number) => Promise<TaskExecutionCheck | null>

  // Computed values
  unitsRemaining: number
  percentageUsed: number
  daysRemainingInPeriod: number
  isNearLimit: boolean
  isOverLimit: boolean
}

export function useTaskUsage(options: UseTaskUsageOptions = {}): UseTaskUsageReturn {
  const { autoRefresh = true, refreshInterval = 30000 } = options
  const { currentWorkspace } = useWorkspace()

  const [usage, setUsage] = useState<WorkspaceUsageCalculation | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculate current month date range
  const currentMonthRange = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    return {
      startDate: startOfMonth.toISOString(),
      endDate: endOfMonth.toISOString(),
      startOfMonth,
      endOfMonth
    }
  }, [])

  // Calculate metrics based on usage and subscription data
  const metrics = useMemo((): TaskUsageMetrics | null => {
    if (!usage || !subscription) return null

    const subscriptionLimit = subscription.limits?.apiCallsPerMonth || 1000 // fallback
    const unitsConsumed = usage.totalUnitsConsumed
    const unitsRemaining = Math.max(0, subscriptionLimit - unitsConsumed)
    const percentageUsed = subscriptionLimit > 0 ? (unitsConsumed / subscriptionLimit) * 100 : 0

    // Calculate billing period info
    const now = new Date()
    const startDate = new Date(currentMonthRange.startOfMonth)
    const endDate = new Date(currentMonthRange.endOfMonth)
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const elapsedDays = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const remainingDays = Math.max(0, totalDays - elapsedDays)

    // Get task counts from breakdown
    const totalTasks = usage.taskTypeBreakdown.reduce((sum, item) => sum + item.totalTasks, 0)
    const completedTasks = totalTasks // All tasks in breakdown are completed

    return {
      currentPeriod: {
        unitsConsumed,
        unitsRemaining,
        totalTasks,
        completedTasks,
        pendingTasks: 0, // Would need additional API call to get pending tasks
        failedTasks: 0, // Would need additional API call to get failed tasks
      },
      limits: {
        subscriptionLimit,
        percentageUsed,
      },
      billingPeriod: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        daysRemaining: remainingDays,
        daysElapsed: elapsedDays,
        renewalDate: endDate.toISOString(),
      },
      subscription: {
        planType: subscription.currentPlan?.contributorType || 'JUNIOR',
        planName: subscription.currentPlan?.planDisplayName || 'Plan Básico',
        status: subscription.subscription.status,
        isActive: subscription.subscription.hasActiveSubscription,
      }
    }
  }, [usage, subscription, currentMonthRange])

  // Computed values
  const unitsRemaining = metrics?.currentPeriod.unitsRemaining || 0
  const percentageUsed = metrics?.limits.percentageUsed || 0
  const daysRemainingInPeriod = metrics?.billingPeriod.daysRemaining || 0
  const isNearLimit = percentageUsed >= 75 && percentageUsed < 100
  const isOverLimit = percentageUsed >= 100

  // Load data function
  const loadData = async (showRefreshing = false) => {
    if (!currentWorkspace) return

    try {
      if (showRefreshing) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      const [usageResponse, subscriptionResponse] = await Promise.all([
        tasksApi.calculateWorkspaceUsage({
          startDate: currentMonthRange.startDate,
          endDate: currentMonthRange.endDate
        }),
        subscriptionApi.getSubscription(currentWorkspace._id)
      ])

      setUsage(usageResponse)
      setSubscription(subscriptionResponse)

    } catch (err) {
      console.error('Error loading task usage data:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar datos de uso')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  // Refresh function
  const refresh = async () => {
    await loadData(true)
  }

  // Check if a task can be executed
  const checkTaskExecution = async (
    taskTypeId: string,
    quantity: number = 1
  ): Promise<TaskExecutionCheck | null> => {
    if (!subscription?.limits?.apiCallsPerMonth) return null

    try {
      return await tasksApi.checkTaskExecution({
        taskTypeId,
        quantity,
        subscriptionLimit: subscription.limits.apiCallsPerMonth
      })
    } catch (err) {
      console.error('Error checking task execution:', err)
      return null
    }
  }

  // Load data when workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      loadData()
    } else {
      setUsage(null)
      setSubscription(null)
      setIsLoading(false)
    }
  }, [currentWorkspace])

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !currentWorkspace) return

    const interval = setInterval(() => {
      loadData(true)
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, currentWorkspace])

  return {
    // Data
    usage,
    subscription,
    metrics,

    // Loading states
    isLoading,
    isRefreshing,

    // Error handling
    error,

    // Actions
    refresh,
    checkTaskExecution,

    // Computed values
    unitsRemaining,
    percentageUsed,
    daysRemainingInPeriod,
    isNearLimit,
    isOverLimit,
  }
}

// Hook for checking if user can execute tasks (simpler version)
export function useTaskExecutionCheck(taskTypeId?: string) {
  const { currentWorkspace } = useWorkspace()
  const [canExecute, setCanExecute] = useState<boolean>(true)
  const [executionInfo, setExecutionInfo] = useState<TaskExecutionCheck | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const checkExecution = async (typeId?: string, quantity: number = 1) => {
    const targetTaskTypeId = typeId || taskTypeId
    if (!targetTaskTypeId || !currentWorkspace) return

    setIsChecking(true)
    try {
      // Get subscription info first
      const subscriptionInfo = await subscriptionApi.getSubscription(currentWorkspace._id)
      const subscriptionLimit = subscriptionInfo.limits?.apiCallsPerMonth || 1000

      const result = await tasksApi.checkTaskExecution({
        taskTypeId: targetTaskTypeId,
        quantity,
        subscriptionLimit
      })

      setExecutionInfo(result)
      setCanExecute(result.canExecute)

      return result
    } catch (err) {
      console.error('Error checking task execution:', err)
      setCanExecute(false)
      return null
    } finally {
      setIsChecking(false)
    }
  }

  return {
    canExecute,
    executionInfo,
    isChecking,
    checkExecution
  }
}