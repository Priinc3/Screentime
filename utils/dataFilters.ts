/**
 * Data Filtering Utilities
 * 
 * These utilities help filter out unrealistic activity data:
 * 1. Cap activity duration to prevent inflated times from background apps
 * 2. Exclude specific user IDs from all reports
 */

// Maximum duration per activity session (2 hours)
export const MAX_ACTIVITY_DURATION_SECONDS = 2 * 60 * 60

// LocalStorage key for excluded users
const EXCLUDED_USERS_KEY = "excluded_user_ids"

/**
 * Get list of excluded user IDs from localStorage
 */
export const getExcludedUserIds = (): string[] => {
    if (typeof window === 'undefined') return []
    try {
        const stored = localStorage.getItem(EXCLUDED_USERS_KEY)
        return stored ? JSON.parse(stored) : []
    } catch {
        return []
    }
}

/**
 * Cap a duration value to the maximum allowed
 */
export const capDuration = (seconds: number): number => {
    return Math.min(seconds, MAX_ACTIVITY_DURATION_SECONDS)
}

/**
 * Check if an employee ID should be excluded
 */
export const isExcludedUser = (employeeId: string): boolean => {
    return getExcludedUserIds().includes(employeeId)
}

/**
 * Filter and process activity logs
 * - Caps duration to MAX_ACTIVITY_DURATION_SECONDS
 * - Filters out excluded user IDs
 */
export const filterActivityLogs = <T extends { employee_id: string; duration_seconds: number }>(
    logs: T[]
): T[] => {
    const excludedIds = getExcludedUserIds()

    return logs
        .filter(log => !excludedIds.includes(log.employee_id))
        .map(log => ({
            ...log,
            duration_seconds: capDuration(log.duration_seconds)
        }))
}

/**
 * Get filter info for display
 */
export const getFilterInfo = () => ({
    maxDurationHours: MAX_ACTIVITY_DURATION_SECONDS / 3600,
    excludedCount: getExcludedUserIds().length
})
