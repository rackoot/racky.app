/**
 * Local Storage Utility for Sync Job Persistence
 *
 * Saves active sync jobs to localStorage so users can track progress
 * even after page reloads or navigation.
 */

const SYNC_STORAGE_KEY = 'racky_active_sync_jobs'

export interface StoredSyncJob {
  jobId: string
  connectionId: string
  marketplace: string
  startedAt: string
}

/**
 * Save an active sync job to localStorage
 */
export function saveSyncJob(job: StoredSyncJob): void {
  try {
    const jobs = getAllSyncJobs()

    // Remove any existing job for this connection to avoid duplicates
    const filteredJobs = jobs.filter(j => j.connectionId !== job.connectionId)

    // Add the new job
    filteredJobs.push(job)

    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(filteredJobs))
  } catch (error) {
    console.error('Failed to save sync job to localStorage:', error)
  }
}

/**
 * Get a specific sync job by connection ID
 */
export function getSyncJob(connectionId: string): StoredSyncJob | null {
  try {
    const jobs = getAllSyncJobs()
    return jobs.find(j => j.connectionId === connectionId) || null
  } catch (error) {
    console.error('Failed to get sync job from localStorage:', error)
    return null
  }
}

/**
 * Get all active sync jobs
 */
export function getAllSyncJobs(): StoredSyncJob[] {
  try {
    const stored = localStorage.getItem(SYNC_STORAGE_KEY)
    if (!stored) return []

    return JSON.parse(stored) as StoredSyncJob[]
  } catch (error) {
    console.error('Failed to parse sync jobs from localStorage:', error)
    return []
  }
}

/**
 * Clear a specific sync job (called when sync completes or fails)
 */
export function clearSyncJob(connectionId: string): void {
  try {
    const jobs = getAllSyncJobs()
    const filteredJobs = jobs.filter(j => j.connectionId !== connectionId)

    if (filteredJobs.length === 0) {
      localStorage.removeItem(SYNC_STORAGE_KEY)
    } else {
      localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(filteredJobs))
    }
  } catch (error) {
    console.error('Failed to clear sync job from localStorage:', error)
  }
}

/**
 * Clear all sync jobs (useful for cleanup)
 */
export function clearAllSyncJobs(): void {
  try {
    localStorage.removeItem(SYNC_STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear all sync jobs from localStorage:', error)
  }
}
