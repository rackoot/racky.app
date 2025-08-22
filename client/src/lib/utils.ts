import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token')
  const workspaceId = localStorage.getItem('currentWorkspaceId')
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(workspaceId && { 'X-Workspace-ID': workspaceId })
  }
}
