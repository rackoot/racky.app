import type { TaskStatus, TaskWithDetails, TaskTypeUsageBreakdown } from "@/api/tasks"

// Date formatting utilities for task usage
export const formatTaskDate = (dateString: string, format: 'short' | 'long' | 'relative' = 'short') => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60)
  const diffInDays = diffInHours / 24

  switch (format) {
    case 'relative':
      if (diffInHours < 1) {
        const diffInMinutes = Math.floor(diffInHours * 60)
        return diffInMinutes < 1 ? 'Ahora mismo' : `Hace ${diffInMinutes}m`
      } else if (diffInHours < 24) {
        return `Hace ${Math.floor(diffInHours)}h`
      } else if (diffInDays < 7) {
        return `Hace ${Math.floor(diffInDays)} días`
      } else {
        return date.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit'
        })
      }

    case 'long':
      return date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

    case 'short':
    default:
      if (diffInHours < 24) {
        return date.toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      } else if (diffInDays < 7) {
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
}

// Billing period calculations
export const getBillingPeriodInfo = (startDate?: Date, endDate?: Date) => {
  const now = new Date()
  const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1)
  const end = endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const elapsedDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  const remainingDays = Math.max(0, totalDays - elapsedDays)
  const percentageElapsed = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0

  return {
    startDate: start,
    endDate: end,
    totalDays,
    elapsedDays,
    remainingDays,
    percentageElapsed: Math.round(percentageElapsed),
    renewalDate: end,
    isEndingThisWeek: remainingDays <= 7,
    isEndingToday: remainingDays <= 1
  }
}

// Format renewal date with context
export const formatRenewalDate = (renewalDate: Date | string) => {
  const date = typeof renewalDate === 'string' ? new Date(renewalDate) : renewalDate
  const now = new Date()
  const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffInDays <= 0) {
    return { text: 'Hoy', urgency: 'high' as const }
  } else if (diffInDays === 1) {
    return { text: 'Mañana', urgency: 'high' as const }
  } else if (diffInDays <= 7) {
    return { text: `En ${diffInDays} días`, urgency: 'medium' as const }
  } else {
    return {
      text: date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short'
      }),
      urgency: 'low' as const
    }
  }
}

// Task status utilities
export const getTaskStatusInfo = (status: TaskStatus) => {
  const statusInfo = {
    completed: {
      label: 'Completada',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      variant: 'default' as const,
      icon: 'check-circle-2',
      description: 'Tarea ejecutada exitosamente'
    },
    in_progress: {
      label: 'En Progreso',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      variant: 'secondary' as const,
      icon: 'play-circle',
      description: 'Tarea siendo ejecutada'
    },
    pending: {
      label: 'Pendiente',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      variant: 'outline' as const,
      icon: 'clock',
      description: 'Tarea en cola para ejecución'
    },
    failed: {
      label: 'Fallida',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      variant: 'destructive' as const,
      icon: 'x-circle',
      description: 'Tarea falló durante la ejecución'
    },
    cancelled: {
      label: 'Cancelada',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      variant: 'secondary' as const,
      icon: 'alert-circle',
      description: 'Tarea cancelada por el usuario'
    }
  }

  return statusInfo[status] || statusInfo.pending
}

// Progress variant calculation
export const getProgressVariant = (percentage: number): "default" | "destructive" | "warning" => {
  if (percentage >= 90) return "destructive"
  if (percentage >= 75) return "warning"
  return "default"
}

// Format numbers for display
export const formatNumber = (num: number, decimals: number = 0): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(decimals)}M`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(decimals)}K`
  }
  return num.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

// Format units with appropriate suffix
export const formatUnits = (units: number, unitType?: string): string => {
  const suffix = unitType || 'unidades'
  return `${formatNumber(units)} ${suffix}`
}

// Task duration formatting
export const formatDuration = (seconds?: number): string | null => {
  if (!seconds || seconds <= 0) return null

  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}m ${Math.round(remainingSeconds)}s` : `${minutes}m`
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    const remainingMinutes = Math.floor((seconds % 3600) / 60)
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  } else {
    const days = Math.floor(seconds / 86400)
    const remainingHours = Math.floor((seconds % 86400) / 3600)
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }
}

// Color utilities for task types
export const getTaskTypeColor = (index: number) => {
  const colors = [
    { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50' },
    { bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-50' },
    { bg: 'bg-purple-500', text: 'text-purple-600', light: 'bg-purple-50' },
    { bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-50' },
    { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50' },
    { bg: 'bg-indigo-500', text: 'text-indigo-600', light: 'bg-indigo-50' },
    { bg: 'bg-pink-500', text: 'text-pink-600', light: 'bg-pink-50' },
    { bg: 'bg-teal-500', text: 'text-teal-600', light: 'bg-teal-50' },
    { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-50' },
    { bg: 'bg-cyan-500', text: 'text-cyan-600', light: 'bg-cyan-50' },
  ]

  return colors[index % colors.length]
}

// Icon mapping for task types (can be expanded based on task type names)
export const getTaskTypeIcon = (taskTypeName: string): string => {
  const iconMap: Record<string, string> = {
    // API related
    'api': 'zap',
    'sync': 'refresh-cw',
    'import': 'download',
    'export': 'upload',

    // Data processing
    'process': 'settings',
    'analyze': 'bar-chart-3',
    'calculate': 'calculator',
    'transform': 'shuffle',

    // Communication
    'send': 'send',
    'notify': 'bell',
    'email': 'mail',
    'message': 'message-circle',

    // Storage
    'backup': 'hard-drive',
    'store': 'database',
    'cache': 'layers',
    'clean': 'trash-2',

    // User actions
    'create': 'plus',
    'update': 'edit',
    'delete': 'x',
    'search': 'search',

    // Reports
    'report': 'file-text',
    'generate': 'file-plus',
    'compile': 'package',
    'audit': 'shield-check',
  }

  // Try to match task type name with icon keywords
  const lowerName = taskTypeName.toLowerCase()
  for (const [keyword, icon] of Object.entries(iconMap)) {
    if (lowerName.includes(keyword)) {
      return icon
    }
  }

  // Default icon
  return 'activity'
}

// Calculate percentage of total
export const calculatePercentage = (value: number, total: number): number => {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

// Sort task breakdown by different criteria
export const sortTaskBreakdown = (
  breakdown: TaskTypeUsageBreakdown[],
  sortBy: 'units' | 'tasks' | 'name' | 'cost' = 'units',
  ascending: boolean = false
) => {
  const sorted = [...breakdown].sort((a, b) => {
    let valueA: number | string
    let valueB: number | string

    switch (sortBy) {
      case 'units':
        valueA = a.totalUnits
        valueB = b.totalUnits
        break
      case 'tasks':
        valueA = a.totalTasks
        valueB = b.totalTasks
        break
      case 'cost':
        valueA = a.unitCost
        valueB = b.unitCost
        break
      case 'name':
        valueA = a.taskTypeName.toLowerCase()
        valueB = b.taskTypeName.toLowerCase()
        break
      default:
        valueA = a.totalUnits
        valueB = b.totalUnits
    }

    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return ascending ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA)
    } else {
      return ascending ? (valueA as number) - (valueB as number) : (valueB as number) - (valueA as number)
    }
  })

  return sorted
}

// Filter tasks by criteria
export const filterTasks = (
  tasks: TaskWithDetails[],
  criteria: {
    status?: TaskStatus | 'all'
    taskTypeId?: string | 'all'
    search?: string
    startDate?: Date
    endDate?: Date
  }
) => {
  return tasks.filter(task => {
    // Status filter
    if (criteria.status && criteria.status !== 'all' && task.status !== criteria.status) {
      return false
    }

    // Task type filter
    if (criteria.taskTypeId && criteria.taskTypeId !== 'all' && task.taskType._id !== criteria.taskTypeId) {
      return false
    }

    // Search filter (searches in task type name and description)
    if (criteria.search && criteria.search.trim()) {
      const searchTerm = criteria.search.toLowerCase()
      const matchesName = task.taskType.name.toLowerCase().includes(searchTerm)
      const matchesDescription = task.description?.toLowerCase().includes(searchTerm) || false
      const matchesTaskTypeDesc = task.taskType.description?.toLowerCase().includes(searchTerm) || false

      if (!matchesName && !matchesDescription && !matchesTaskTypeDesc) {
        return false
      }
    }

    // Date range filter
    const taskDate = new Date(task.date)
    if (criteria.startDate && taskDate < criteria.startDate) {
      return false
    }
    if (criteria.endDate && taskDate > criteria.endDate) {
      return false
    }

    return true
  })
}

// Usage alert utilities
export const getUsageAlert = (percentage: number) => {
  if (percentage >= 100) {
    return {
      level: 'critical' as const,
      title: 'Límite Excedido',
      message: 'Has superado tu límite de unidades mensuales',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    }
  } else if (percentage >= 90) {
    return {
      level: 'high' as const,
      title: 'Límite Casi Alcanzado',
      message: 'Estás cerca de alcanzar tu límite mensual',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    }
  } else if (percentage >= 75) {
    return {
      level: 'medium' as const,
      title: 'Uso Elevado',
      message: 'Has usado más del 75% de tu límite mensual',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    }
  } else {
    return {
      level: 'low' as const,
      title: 'Uso Normal',
      message: 'Tu uso está dentro de los límites normales',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    }
  }
}