import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "@/components/workspace/workspace-context"
import {
  Zap,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Activity,
  BarChart3,
  Target,
  Info
} from "lucide-react"

// Import our new components and hooks
import {
  UnitsConsumedCard,
  TasksExecutedCard,
  BillingPeriodCard,
  SubscriptionStatusCard
} from "@/components/usage/task-usage-card"
import { TaskExecutionList, type TaskListFilters } from "@/components/usage/task-execution-list"
import { TaskTypeBreakdown } from "@/components/usage/task-type-breakdown"
import { useTaskUsage } from "@/hooks/use-task-usage"
import { useTaskAnalytics } from "@/hooks/use-task-analytics"
import { getBillingPeriodInfo, getUsageAlert, formatRenewalDate } from "@/lib/task-utils"

export function Usage() {
  const { currentWorkspace } = useWorkspace()
  const [currentPage, setCurrentPage] = useState(1)
  const [taskFilters, setTaskFilters] = useState<TaskListFilters>({})

  // Use our custom hooks
  const {
    usage,
    subscription,
    metrics,
    isLoading: isLoadingUsage,
    isRefreshing,
    error: usageError,
    refresh: refreshUsage,
    unitsRemaining,
    percentageUsed,
    daysRemainingInPeriod,
    isNearLimit,
    isOverLimit
  } = useTaskUsage({
    autoRefresh: true,
    refreshInterval: 60000 // 1 minute
  })

  const {
    analytics,
    tasks,
    isLoading: isLoadingAnalytics,
    isLoadingTasks,
    error: analyticsError,
    loadTasks,
    totalUnitsConsumed,
    completionRate,
    mostUsedTaskType
  } = useTaskAnalytics({
    autoRefresh: false
  })

  // Calculate billing period info
  const billingPeriod = getBillingPeriodInfo()
  const renewalInfo = formatRenewalDate(billingPeriod.renewalDate)

  // Get usage alert information
  const usageAlert = getUsageAlert(percentageUsed)

  // Handle task list pagination and filtering
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    loadTasks({ ...taskFilters, page, limit: 20 })
  }

  const handleFilterChange = (filters: TaskListFilters) => {
    setTaskFilters(filters)
    setCurrentPage(1)
    loadTasks({ ...filters, page: 1, limit: 20 })
  }

  const handleRefresh = async () => {
    await Promise.all([
      refreshUsage(),
      loadTasks(taskFilters)
    ])
  }

  // Loading state
  if (isLoadingUsage || isLoadingAnalytics) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Panel de Uso</h1>
          <p className="text-muted-foreground">Monitorea el consumo de tareas y límites de tu suscripción</p>
        </div>
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Cargando datos de uso...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (usageError || analyticsError) {
    const error = usageError || analyticsError
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Panel de Uso</h1>
          <p className="text-muted-foreground">Monitorea el consumo de tareas y límites de tu suscripción</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-destructive">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error al cargar los datos</h3>
              <p className="mb-4">{error}</p>
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Panel de Uso</h1>
          <p className="text-muted-foreground">
            Workspace: <span className="font-medium">{currentWorkspace?.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRefreshing && (
            <Badge variant="outline" className="animate-pulse">
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              Actualizando...
            </Badge>
          )}
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={isRefreshing}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Usage Alert */}
      {(isNearLimit || isOverLimit) && (
        <Alert className={`${usageAlert.borderColor} ${usageAlert.bgColor}`}>
          <AlertTriangle className={`h-4 w-4 ${usageAlert.color}`} />
          <AlertDescription className={usageAlert.color}>
            <strong>{usageAlert.title}:</strong> {usageAlert.message}
            {isOverLimit && (
              <div className="mt-2">
                <Badge variant="destructive" className="mr-2">
                  Límite excedido
                </Badge>
                <span className="text-sm">Considera actualizar tu plan para continuar ejecutando tareas.</span>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Units Consumed */}
        <UnitsConsumedCard
          unitsUsed={usage?.totalUnitsConsumed || 0}
          unitsLimit={subscription?.limits?.apiCallsPerMonth || 1000}
          description="Unidades utilizadas este período de facturación"
        />

        {/* Tasks Executed */}
        <TasksExecutedCard
          totalTasks={analytics?.totalTasks || 0}
          completedTasks={analytics?.completedTasks || 0}
          pendingTasks={analytics?.pendingTasks || 0}
        />

        {/* Billing Period */}
        <BillingPeriodCard
          daysRemaining={daysRemainingInPeriod}
          renewalDate={billingPeriod.renewalDate.toISOString()}
        />

        {/* Subscription Status */}
        <SubscriptionStatusCard
          planName={metrics?.subscription.planName || "Plan Básico"}
          status={metrics?.subscription.status || "ACTIVE"}
          isActive={metrics?.subscription.isActive || false}
          monthlyUnits={subscription?.limits?.apiCallsPerMonth || 1000}
        />
      </div>

      {/* Detailed Usage Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Usage Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Resumen del Período
            </CardTitle>
            <CardDescription>Estadísticas del período de facturación actual</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(percentageUsed)}%
                </div>
                <div className="text-sm text-muted-foreground">Límite usado</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {completionRate}%
                </div>
                <div className="text-sm text-muted-foreground">Tareas completadas</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Días transcurridos
                </span>
                <span className="font-medium">{billingPeriod.elapsedDays} de {billingPeriod.totalDays}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Renovación
                </span>
                <Badge variant={renewalInfo.urgency === 'high' ? 'destructive' : 'outline'}>
                  {renewalInfo.text}
                </Badge>
              </div>

              {mostUsedTaskType && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Tipo más usado
                  </span>
                  <span className="font-medium">{mostUsedTaskType.name}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Task Type Breakdown */}
        <Card className="lg:col-span-2">
          <TaskTypeBreakdown
            breakdown={usage?.taskTypeBreakdown || []}
            totalUnits={usage?.totalUnitsConsumed || 0}
            isLoading={isLoadingUsage}
          />
        </Card>
      </div>

      {/* Task Execution List */}
      <TaskExecutionList
        tasks={tasks?.tasks || []}
        isLoading={isLoadingTasks}
        error={analyticsError}
        pagination={tasks?.pagination}
        onPageChange={handlePageChange}
        onFilterChange={handleFilterChange}
      />

      {/* Additional Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            Información Adicional
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Unidades</h4>
              <p className="text-muted-foreground">
                Las unidades representan el costo de ejecutar diferentes tipos de tareas.
                Cada tipo de tarea tiene un costo específico en unidades.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Renovación</h4>
              <p className="text-muted-foreground">
                Tu límite de unidades se renueva automáticamente cada período de facturación.
                Las unidades no utilizadas no se acumulan.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Límites</h4>
              <p className="text-muted-foreground">
                Cuando alcances tu límite mensual, las nuevas tareas quedarán en espera
                hasta la próxima renovación o actualización de plan.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}