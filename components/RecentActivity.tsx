"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { getExcludedUserIds } from "@/utils/dataFilters"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

type ActivityLog = {
    id: number
    window_title: string
    app_name: string
    created_at: string
    employee_id: string
    employees?: {
        full_name: string
    }
}

export function RecentActivity() {
    const [activities, setActivities] = useState<ActivityLog[]>([])
    const [limit, setLimit] = useState("20")
    const supabase = createClient()

    useEffect(() => {
        const fetchActivities = async () => {
            // 1. First fetch valid employees (only show activity for employees that exist)
            const { data: employees } = await supabase
                .from('employees')
                .select('id, full_name')

            // Create a map and set of valid employees
            const empMap: Record<string, string> = {}
            const validEmployeeIds = new Set<string>()
            if (employees) {
                employees.forEach(e => {
                    empMap[e.id] = e.full_name
                    validEmployeeIds.add(e.id)
                })
            }

            // Get excluded user IDs from settings
            const excludedIds = getExcludedUserIds()

            // 2. Fetch Logs (fetch more than limit since we'll filter some out)
            const { data: logsData } = await supabase
                .from('activity_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(parseInt(limit) * 3) // Fetch extra since we filter

            if (!logsData) {
                setActivities([])
                return
            }

            // 3. Apply STRICT filtering and merge data
            // - Only include if employee exists in employees table
            // - Exclude if employee ID is in excluded list
            const filteredData = logsData
                .filter(log => {
                    // Must exist in employees table
                    if (!validEmployeeIds.has(log.employee_id)) return false
                    // Must not be excluded
                    if (excludedIds.includes(log.employee_id)) return false
                    return true
                })
                .slice(0, parseInt(limit)) // Limit after filtering
                .map(log => ({
                    ...log,
                    employees: {
                        full_name: empMap[log.employee_id] || "Unknown"
                    }
                }))

            setActivities(filteredData)
        }

        fetchActivities()

        // Realtime subscription
        const channel = supabase
            .channel('realtime_activity')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'activity_logs'
            }, async (payload) => {
                const newLog = payload.new as any
                const excludedIds = getExcludedUserIds()

                // Skip if excluded
                if (excludedIds.includes(newLog.employee_id)) return

                // Fetch employee name for the new log
                const { data: emp } = await supabase
                    .from('employees')
                    .select('full_name')
                    .eq('id', newLog.employee_id)
                    .single()

                // Skip if employee doesn't exist in employees table
                if (!emp) return

                const mergedLog = {
                    ...newLog,
                    employees: emp
                }

                setActivities((current) => [mergedLog, ...current].slice(0, parseInt(limit)))
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [limit])

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Select value={limit} onValueChange={setLimit}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select limit" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="20">20 Records</SelectItem>
                        <SelectItem value="50">50 Records</SelectItem>
                        <SelectItem value="100">100 Records</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-8 max-h-[600px] overflow-y-auto pr-2">
                {activities.length === 0 && (
                    <div className="text-center text-muted-foreground">
                        No recent activity found.
                    </div>
                )}
                {activities.map((activity: any) => (
                    <div key={activity.id} className="flex items-center">
                        <Avatar className="h-9 w-9">
                            <AvatarImage src={`https://avatar.vercel.sh/${activity.employee_id}`} alt="Avatar" />
                            <AvatarFallback>EM</AvatarFallback>
                        </Avatar>
                        <div className="ml-4 space-y-1">
                            <p className="text-sm font-medium leading-none">
                                {activity.employees?.full_name || "Unknown"} <span className="text-muted-foreground">- {activity.app_name}</span>
                            </p>
                            <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                                {activity.window_title}
                            </p>
                        </div>
                        <div className="ml-auto font-medium text-xs text-muted-foreground whitespace-nowrap pl-2">
                            {new Date(activity.created_at).toLocaleString()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
