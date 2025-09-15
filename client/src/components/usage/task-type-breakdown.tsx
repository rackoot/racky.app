import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  PieChart,
  BarChart3,
  Zap,
  Hash,
  TrendingUp,
  Activity
} from "lucide-react"
import type { TaskTypeUsageBreakdown } from "@/api/tasks"

interface TaskTypeBreakdownProps {
  breakdown: TaskTypeUsageBreakdown[]
  totalUnits: number
  isLoading?: boolean
  className?: string
}

export function TaskTypeBreakdown({
  breakdown,
  totalUnits,
  isLoading = false,
  className = ""
}: TaskTypeBreakdownProps) {
  // Color palette for different task types
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-indigo-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500'
  ]

  const getTaskTypeColor = (index: number) => {
    return colors[index % colors.length]
  }

  const getPercentage = (units: number) => {
    return totalUnits > 0 ? Math.round((units / totalUnits) * 100) : 0
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-600" />
            Desglose por Tipo de Tarea
          </CardTitle>
          <CardDescription>Distribución del uso por categoría</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-gray-300 rounded"></div>
                  <div className="h-4 bg-gray-300 rounded w-24"></div>
                </div>
                <div className="h-4 bg-gray-300 rounded w-16"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (breakdown.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-600" />
            Desglose por Tipo de Tarea
          </CardTitle>
          <CardDescription>Distribución del uso por categoría</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sin datos disponibles</h3>
            <p>No hay tareas completadas en el período seleccionado</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Sort breakdown by total units descending
  const sortedBreakdown = [...breakdown].sort((a, b) => b.totalUnits - a.totalUnits)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChart className="w-5 h-5 text-purple-600" />
          Desglose por Tipo de Tarea
        </CardTitle>
        <CardDescription>
          Distribución del uso de {totalUnits.toLocaleString()} unidades totales
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Visual breakdown bars */}
        <div className="space-y-4">
          {sortedBreakdown.map((item, index) => {
            const percentage = getPercentage(item.totalUnits)
            const colorClass = getTaskTypeColor(index)

            return (
              <div key={item._id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded ${colorClass}`}></div>
                    <div>
                      <h4 className="font-medium text-sm">{item.taskTypeName}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {item.totalTasks} tareas
                        </span>
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {item.unitCost} {item.unitType || 'unidades'} c/u
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-sm">
                      {item.totalUnits.toLocaleString()}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {percentage}%
                    </Badge>
                  </div>
                </div>

                <Progress
                  value={percentage}
                  className="h-2"
                />
              </div>
            )
          })}
        </div>

        {/* Summary stats */}
        <div className="pt-4 border-t space-y-3">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-2xl font-bold text-blue-600">
                {sortedBreakdown.length}
              </div>
              <div className="text-xs text-muted-foreground">Tipos únicos</div>
            </div>

            <div className="space-y-1">
              <div className="text-2xl font-bold text-green-600">
                {sortedBreakdown.reduce((sum, item) => sum + item.totalTasks, 0)}
              </div>
              <div className="text-xs text-muted-foreground">Total tareas</div>
            </div>

            <div className="space-y-1">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(sortedBreakdown.reduce((sum, item) => sum + item.totalUnits, 0) / sortedBreakdown.reduce((sum, item) => sum + item.totalTasks, 0) || 0)}
              </div>
              <div className="text-xs text-muted-foreground">Promedio/tarea</div>
            </div>
          </div>

          {/* Top performer */}
          {sortedBreakdown.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <div className="flex-1">
                <div className="text-sm font-medium">
                  Tipo más utilizado: <span className="text-green-600">{sortedBreakdown[0].taskTypeName}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {sortedBreakdown[0].totalUnits} unidades ({getPercentage(sortedBreakdown[0].totalUnits)}% del total)
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Simplified version for dashboard usage
export function TaskTypeBreakdownCompact({
  breakdown,
  totalUnits,
  maxItems = 5
}: {
  breakdown: TaskTypeUsageBreakdown[]
  totalUnits: number
  maxItems?: number
}) {
  const sortedBreakdown = [...breakdown]
    .sort((a, b) => b.totalUnits - a.totalUnits)
    .slice(0, maxItems)

  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-yellow-500',
    'bg-red-500'
  ]

  return (
    <div className="space-y-3">
      {sortedBreakdown.map((item, index) => {
        const percentage = totalUnits > 0 ? Math.round((item.totalUnits / totalUnits) * 100) : 0
        const colorClass = colors[index % colors.length]

        return (
          <div key={item._id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${colorClass}`}></div>
              <span className="text-sm font-medium">{item.taskTypeName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {item.totalUnits}
              </span>
              <Badge variant="outline" className="text-xs">
                {percentage}%
              </Badge>
            </div>
          </div>
        )
      })}
    </div>
  )
}