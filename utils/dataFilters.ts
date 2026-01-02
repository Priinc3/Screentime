/**
 * Data Filtering Utilities
 * 
 * These utilities help filter out unrealistic activity data:
 * 1. Cap activity duration to prevent inflated times from background apps
 * 2. Exclude specific user IDs from all reports
 * 3. Only show employees that exist in the employees table
 */

// Maximum duration per activity session (2 hours = 7200 seconds)
export const MAX_ACTIVITY_DURATION_SECONDS = 2 * 60 * 60

// LocalStorage key for excluded users
const EXCLUDED_USERS_KEY = "excluded_user_ids"

/**
 * Get list of excluded user IDs from localStorage
 */
export function getExcludedUserIds(): string[] {
    if (typeof window === 'undefined') return []
    try {
        const stored = localStorage.getItem(EXCLUDED_USERS_KEY)
        if (!stored) return []
        const parsed = JSON.parse(stored)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

/**
 * Save excluded user IDs to localStorage
 */
export function saveExcludedUserIds(ids: string[]): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(EXCLUDED_USERS_KEY, JSON.stringify(ids))
}

/**
 * Add a user ID to excluded list
 */
export function addExcludedUserId(id: string): void {
    const current = getExcludedUserIds()
    if (!current.includes(id)) {
        saveExcludedUserIds([...current, id])
    }
}

/**
 * Remove a user ID from excluded list
 */
export function removeExcludedUserId(id: string): void {
    const current = getExcludedUserIds()
    saveExcludedUserIds(current.filter(i => i !== id))
}

/**
 * Check if activity duration is valid (under 2 hours)
 * Activities over 2 hours are IGNORED completely (return 0)
 */
export function capDuration(seconds: number | null | undefined): number {
    if (!seconds || seconds < 0) return 0
    // IGNORE activities over 2 hours completely
    if (seconds > MAX_ACTIVITY_DURATION_SECONDS) return 0
    return seconds
}

/**
 * Check if an employee ID should be excluded
 */
export function isExcludedUser(employeeId: string): boolean {
    return getExcludedUserIds().includes(employeeId)
}

/**
 * Filter activity logs:
 * - Remove excluded users
 * - Cap duration to MAX_ACTIVITY_DURATION_SECONDS
 * - Only include employees that exist in the validEmployeeIds set
 */
export function filterActivityLogs<T extends { employee_id: string; duration_seconds: number }>(
    logs: T[],
    validEmployeeIds?: Set<string>
): (T & { duration_seconds: number })[] {
    const excludedIds = getExcludedUserIds()

    return logs
        .filter(log => {
            // Filter out excluded users
            if (excludedIds.includes(log.employee_id)) return false

            // Filter out users not in valid employee list (if provided)
            if (validEmployeeIds && !validEmployeeIds.has(log.employee_id)) return false

            return true
        })
        .map(log => ({
            ...log,
            duration_seconds: capDuration(log.duration_seconds)
        }))
}

/**
 * Get filter info for display
 */
export function getFilterInfo() {
    return {
        maxDurationHours: MAX_ACTIVITY_DURATION_SECONDS / 3600,
        excludedCount: getExcludedUserIds().length,
        excludedIds: getExcludedUserIds()
    }
}
