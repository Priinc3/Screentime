"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
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
            // 1. Fetch Logs
            const { data: logsData } = await supabase
                .from('activity_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(parseInt(limit))

            if (!logsData) return

            // 2. Extract unique employee IDs
            const employeeIds = Array.from(new Set(logsData.map((log: any) => log.employee_id)))

            // 3. Fetch Employees
            let empMap: Record<string, string> = {}
            if (employeeIds.length > 0) {
                const { data: empData } = await supabase
                    .from('employees')
                    .select('id, full_name')
                    .in('id', employeeIds)

                if (empData) {
                    empData.forEach((e: any) => {
                        empMap[e.id] = e.full_name
                    })
                }
            }

            // 4. Merge Data
            const combinedData = logsData.map((log: any) => ({
                ...log,
                employees: {
                    full_name: empMap[log.employee_id] || "Unknown"
                }
            }))

            setActivities(combinedData)
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

                // Fetch employee name for the new log immediately
                const { data: emp } = await supabase
                    .from('employees')
                    .select('full_name')
                    .eq('id', newLog.employee_id)
                    .single()

                const mergedLog = {
                    ...newLog,
                    employees: emp || { full_name: "Unknown" }
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
