import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle
} from "lucide-react"

interface TaskUsageCardProps {
  title: string
  icon: React.ReactNode
  value: number | string
  description?: string
  progress?: {
    current: number
    max: number
    variant?: "default" | "destructive" | "warning"
  }
  trend?: {
    value: number
    direction: "up" | "down" | "neutral"
    label: string
  }
  badge?: {
    text: string
    variant?: "default" | "secondary" | "destructive" | "outline"
  }
  className?: string
}

export function TaskUsageCard({
  title,
  icon,
  value,
  description,
  progress,
  trend,
  badge,
  className = ""
}: TaskUsageCardProps) {
  const formatValue = (val: number | string) => {
    if (typeof val === 'number') {
      return val.toLocaleString()
    }
    return val
  }

  const getProgressVariant = (percentage: number) => {
    if (percentage >= 90) return "destructive"
    if (percentage >= 75) return "warning"
    return "default"
  }

  const getTrendIcon = (direction: "up" | "down" | "neutral") => {
    switch (direction) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-green-600" />
      case "down":
        return <TrendingDown className="w-4 h-4 text-red-600" />
      default:
        return <Target className="w-4 h-4 text-gray-600" />
    }
  }

  const getTrendColor = (direction: "up" | "down" | "neutral") => {
    switch (direction) {
      case "up":
        return "text-green-600"
      case "down":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {badge && (
            <Badge variant={badge.variant || "default"} className="text-xs">
              {badge.text}
            </Badge>
          )}
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-2">
          {formatValue(value)}
        </div>

        {description && (
          <CardDescription className="text-xs mb-3">
            {description}
          </CardDescription>
        )}

        {trend && (
          <div className="flex items-center gap-2 mb-3">
            {getTrendIcon(trend.direction)}
            <p className={`text-xs ${getTrendColor(trend.direction)}`}>
              {trend.direction === "up" ? "+" : trend.direction === "down" ? "-" : ""}
              {Math.abs(trend.value)}% {trend.label}
            </p>
          </div>
        )}

        {progress && (
          <div>
            <Progress
              value={(progress.current / progress.max) * 100}
              variant={progress.variant || getProgressVariant((progress.current / progress.max) * 100)}
              className="h-2 mb-1"
            />
            <p className="text-xs text-muted-foreground">
              {formatValue(progress.current)} of {formatValue(progress.max)}
              {progress.current > 0 && (
                <span className="ml-1">
                  ({Math.round((progress.current / progress.max) * 100)}%)
                </span>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Specialized usage cards for common metrics
export function UnitsConsumedCard({ unitsUsed, unitsLimit, description }: {
  unitsUsed: number
  unitsLimit: number
  description?: string
}) {
  return (
    <TaskUsageCard
      title="Unidades Consumidas"
      icon={<Zap className="h-4 w-4 text-blue-500" />}
      value={unitsUsed}
      description={description || "Unidades utilizadas este período"}
      progress={{
        current: unitsUsed,
        max: unitsLimit,
      }}
      badge={{
        text: `${unitsLimit - unitsUsed} restantes`,
        variant: unitsUsed / unitsLimit >= 0.9 ? "destructive" : "outline"
      }}
    />
  )
}

export function TasksExecutedCard({ totalTasks, completedTasks, pendingTasks }: {
  totalTasks: number
  completedTasks: number
  pendingTasks: number
}) {
  return (
    <TaskUsageCard
      title="Tareas Ejecutadas"
      icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
      value={totalTasks}
      description="Total de tareas en el período"
      trend={
        completedTasks > 0 ? {
          value: Math.round((completedTasks / totalTasks) * 100),
          direction: "up",
          label: "completadas"
        } : undefined
      }
      badge={
        pendingTasks > 0 ? {
          text: `${pendingTasks} pendientes`,
          variant: "outline"
        } : {
          text: "Todo completado",
          variant: "default"
        }
      }
    />
  )
}

export function BillingPeriodCard({ daysRemaining, renewalDate }: {
  daysRemaining: number
  renewalDate: string
}) {
  const renewalFormatted = new Date(renewalDate).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })

  return (
    <TaskUsageCard
      title="Período de Facturación"
      icon={<Calendar className="h-4 w-4 text-purple-500" />}
      value={`${daysRemaining} días`}
      description={`Se renueva el ${renewalFormatted}`}
      badge={{
        text: daysRemaining <= 7 ? "Próximo a vencer" : "Activo",
        variant: daysRemaining <= 7 ? "destructive" : "outline"
      }}
    />
  )
}

export function SubscriptionStatusCard({
  planName,
  status,
  isActive,
  monthlyUnits
}: {
  planName: string
  status: string
  isActive: boolean
  monthlyUnits: number
}) {
  const getStatusIcon = () => {
    if (!isActive) return <XCircle className="h-4 w-4 text-red-500" />
    if (status === 'ACTIVE') return <CheckCircle2 className="h-4 w-4 text-green-500" />
    return <AlertCircle className="h-4 w-4 text-yellow-500" />
  }

  const getStatusBadge = () => {
    if (!isActive) return { text: "Inactiva", variant: "destructive" as const }
    if (status === 'ACTIVE') return { text: "Activa", variant: "default" as const }
    return { text: "Pendiente", variant: "outline" as const }
  }

  return (
    <TaskUsageCard
      title="Suscripción"
      icon={getStatusIcon()}
      value={planName}
      description={`${monthlyUnits.toLocaleString()} unidades mensuales`}
      badge={getStatusBadge()}
    />
  )
}