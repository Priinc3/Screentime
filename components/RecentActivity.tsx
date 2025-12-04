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
}

export function RecentActivity() {
    const [activities, setActivities] = useState<ActivityLog[]>([])
    const [limit, setLimit] = useState("20")
    const supabase = createClient()

    useEffect(() => {
        // Initial fetch
        const fetchActivities = async () => {
            const { data } = await supabase
                .from('activity_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(parseInt(limit))

            if (data) setActivities(data)
        }

        fetchActivities()

        // Realtime subscription
        const channel = supabase
            .channel('realtime_activity')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'activity_logs'
            }, (payload) => {
                setActivities((current) => [payload.new as ActivityLog, ...current].slice(0, parseInt(limit)))
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
                {activities.map((activity) => (
                    <div key={activity.id} className="flex items-center">
                        <Avatar className="h-9 w-9">
                            <AvatarImage src={`https://avatar.vercel.sh/${activity.employee_id}`} alt="Avatar" />
                            <AvatarFallback>EM</AvatarFallback>
                        </Avatar>
                        <div className="ml-4 space-y-1">
                            <p className="text-sm font-medium leading-none">{activity.app_name}</p>
                            <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                                {activity.window_title}
                            </p>
                        </div>
                        <div className="ml-auto font-medium text-xs text-muted-foreground">
                            {new Date(activity.created_at).toLocaleTimeString()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
