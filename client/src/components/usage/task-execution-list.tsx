import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Search,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PlayCircle,
  Calendar,
  User,
  Hash,
  Zap,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import type { TaskWithDetails, TaskStatus, PaginatedTaskResponse } from "@/api/tasks"

interface TaskExecutionListProps {
  tasks: TaskWithDetails[]
  isLoading: boolean
  error?: string | null
  pagination?: PaginatedTaskResponse['pagination']
  onPageChange?: (page: number) => void
  onFilterChange?: (filters: TaskListFilters) => void
  className?: string
}

export interface TaskListFilters {
  search?: string
  status?: TaskStatus | 'all'
  taskTypeId?: string | 'all'
  startDate?: string
  endDate?: string
}

export function TaskExecutionList({
  tasks,
  isLoading,
  error,
  pagination,
  onPageChange,
  onFilterChange,
  className = ""
}: TaskExecutionListProps) {
  const [filters, setFilters] = useState<TaskListFilters>({
    search: "",
    status: "all",
    taskTypeId: "all"
  })

  // Get unique task types for filter dropdown
  const taskTypes = useMemo(() => {
    const types = new Map()
    tasks.forEach(task => {
      if (!types.has(task.taskType._id)) {
        types.set(task.taskType._id, {
          id: task.taskType._id,
          name: task.taskType.name
        })
      }
    })
    return Array.from(types.values())
  }, [tasks])

  const handleFilterChange = (key: keyof TaskListFilters, value: string) => {
    const newFilters = { ...filters, [key]: value === 'all' ? undefined : value }
    setFilters(newFilters)
    onFilterChange?.(newFilters)
  }

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'in_progress':
        return <PlayCircle className="w-4 h-4 text-blue-500" />
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-gray-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: TaskStatus) => {
    const statusConfig = {
      completed: { text: "Completada", variant: "default" as const },
      in_progress: { text: "En Progreso", variant: "secondary" as const },
      pending: { text: "Pendiente", variant: "outline" as const },
      failed: { text: "Fallida", variant: "destructive" as const },
      cancelled: { text: "Cancelada", variant: "secondary" as const },
    }
    return statusConfig[status] || { text: status, variant: "outline" as const }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString('es-ES', {
        weekday: 'short',
        day: 'numeric'
      })
    } else {
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit'
      })
    }
  }

  const formatDuration = (duration?: number) => {
    if (!duration) return null
    if (duration < 60) return `${duration}s`
    if (duration < 3600) return `${Math.floor(duration / 60)}m`
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            <XCircle className="w-12 h-12 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error al cargar tareas</h3>
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-blue-600" />
              Tareas Ejecutadas
            </CardTitle>
            <CardDescription>
              {pagination ? `${pagination.totalItems} tareas en total` : 'Historial de tareas del período'}
            </CardDescription>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tareas..."
              value={filters.search || ""}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            value={filters.status || "all"}
            onValueChange={(value) => handleFilterChange('status', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="completed">Completadas</SelectItem>
              <SelectItem value="in_progress">En progreso</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="failed">Fallidas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.taskTypeId || "all"}
            onValueChange={(value) => handleFilterChange('taskTypeId', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tipo de tarea" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {taskTypes.map(type => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-4 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4 flex-1">
                  <Skeleton className="w-4 h-4 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Hash className="w-12 h-12 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay tareas</h3>
            <p>No se encontraron tareas para los filtros seleccionados</p>
          </div>
        ) : (
          <>
            <div className="max-h-96 overflow-y-auto">
              <div className="space-y-2 p-6">
                {tasks.map((task) => (
                  <div
                    key={task._id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {getStatusIcon(task.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">
                            {task.taskType.name}
                          </h4>
                          <Badge {...getStatusBadge(task.status)} />
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(task.date)}
                          </span>
                          {task.user && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {task.user.firstName} {task.user.lastName}
                            </span>
                          )}
                          {task.duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(task.duration)}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="flex items-center gap-1 font-semibold text-sm">
                          <Zap className="w-3 h-3 text-blue-500" />
                          {task.totalUnits}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {task.quantity}x {task.taskType.unitCost}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Página {pagination.currentPage} de {pagination.totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange?.(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevPage}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange?.(pagination.currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                  >
                    Siguiente
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}