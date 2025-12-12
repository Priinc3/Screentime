"use client"

import { createClient } from "@/utils/supabase/client"
import { Sidebar } from "@/components/Sidebar"
import { Header } from "@/components/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useEffect, useState } from "react"
import { Clock, Activity, Calendar as CalendarIcon, RefreshCw, Filter } from "lucide-react"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

import { HourlyActivityChart } from "@/components/charts/HourlyActivityChart"
import { AppUsagePieChart } from "@/components/charts/AppUsagePieChart"

interface Employee {
    id: string
    full_name: string
    email: string
    department: string
    created_at: string
    last_heartbeat?: string
    current_window?: string
    current_app?: string
}

interface ActivityLog {
    id: string
    window_title: string
    app_name: string
    duration_seconds: number
    start_time: string
}

interface AppUsage {
    appName: string
    totalSeconds: number
}

export default function EmployeeDetailsPage() {
    const params = useParams()
    const id = params?.id as string
    const [employee, setEmployee] = useState<Employee | null>(null)
    const [logs, setLogs] = useState<ActivityLog[]>([])
    const [date, setDate] = useState<Date>(new Date())
    const [stats, setStats] = useState({ totalTime: 0, topApps: [] as AppUsage[] })
    const [hourlyData, setHourlyData] = useState<{ hour: string; activity: number }[]>([])
    const [appUsageData, setAppUsageData] = useState<{ name: string; value: number }[]>([])
    const [loading, setLoading] = useState(false)
    const [allApps, setAllApps] = useState<string[]>([])
    const [hiddenApps, setHiddenApps] = useState<string[]>([])
    const supabase = createClient()

    const fetchData = async () => {
        setLoading(true)
        // Fetch Employee
        const { data: empData } = await supabase.from('employees').select('*').eq('id', id).single()
        if (empData) setEmployee(empData)

        // Fetch Logs for selected Date
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(date)
        endOfDay.setHours(23, 59, 59, 999)

        const { data: logData } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('employee_id', id)
            .gte('start_time', startOfDay.toISOString())
            .lte('start_time', endOfDay.toISOString())
            .order('start_time', { ascending: false })

        if (logData) {
            setLogs(logData)

            // Extract unique apps for filter
            const uniqueApps = Array.from(new Set(logData.map(l => l.app_name))).sort()
            setAllApps(uniqueApps)

            calculateStats(logData)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [id, date]) // Re-fetch when date changes

    // Re-calculate stats when hiddenApps changes (client-side filtering)
    useEffect(() => {
        if (logs.length > 0) {
            calculateStats(logs)
        }
    }, [hiddenApps])

    const calculateStats = (data: ActivityLog[]) => {
        // Filter out hidden apps
        const filteredData = data.filter(log => !hiddenApps.includes(log.app_name))

        const totalSeconds = filteredData.reduce((acc, log) => acc + log.duration_seconds, 0)
        const appMap = new Map<string, number>()
        const hourMap = new Map<number, number>()

        filteredData.forEach(log => {
            // App Usage
            const current = appMap.get(log.app_name) || 0
            appMap.set(log.app_name, current + log.duration_seconds)

            // Hourly Activity
            const hour = new Date(log.start_time).getHours()
            hourMap.set(hour, (hourMap.get(hour) || 0) + log.duration_seconds)
        })

        // Top Apps List
        const topApps = Array.from(appMap.entries())
            .map(([appName, seconds]) => ({
                appName,
                totalSeconds: seconds
            }))
            .sort((a, b) => b.totalSeconds - a.totalSeconds)
            .slice(0, 5)

        // App Usage Chart Data (Hours)
        const appChartData = Array.from(appMap.entries())
            .map(([name, seconds]) => ({
                name,
                value: Math.round((seconds / 3600) * 10) / 10
            }))
            .sort((a, b) => b.value - a.value)
        setAppUsageData(appChartData)

        // Hourly Activity Chart Data (Hours)
        const hourlyChartData = Array.from({ length: 24 }, (_, i) => {
            const seconds = hourMap.get(i) || 0
            return {
                hour: `${i}:00`,
                activity: Math.round((seconds / 3600) * 10) / 10
            }
        })
        setHourlyData(hourlyChartData)

        setStats({ totalTime: totalSeconds, topApps })
    }

    const toggleAppVisibility = (appName: string) => {
        setHiddenApps(current =>
            current.includes(appName)
                ? current.filter(a => a !== appName)
                : [...current, appName]
        )
    }

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        return `${h}h ${m}m`
    }

    const isOnline = (lastHeartbeat?: string) => {
        if (!lastHeartbeat) return false
        const diff = new Date().getTime() - new Date(lastHeartbeat).getTime()
        return diff < 2 * 60 * 1000 // 2 minutes
    }

    if (!employee) return <div className="p-8">Loading...</div>

    return (
        <div className="flex min-h-screen bg-background">
            <aside className="w-64 hidden md:block fixed inset-y-0 z-50">
                <Sidebar />
            </aside>
            <main className="flex-1 md:pl-64 flex flex-col">
                <Header />
                <div className="flex-1 space-y-4 p-8 pt-6">
                    {/* Header Section */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <Avatar className="h-16 w-16">
                                <AvatarImage src={`https://avatar.vercel.sh/${employee.id}`} />
                                <AvatarFallback>{employee.full_name.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="flex items-center space-x-2">
                                    <h2 className="text-3xl font-bold tracking-tight">{employee.full_name}</h2>
                                    {isOnline(employee.last_heartbeat) ? (
                                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">Online</span>
                                    ) : (
                                        <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">Offline</span>
                                    )}
                                </div>
                                <p className="text-muted-foreground">{employee.email} • {employee.department}</p>
                            </div>
                        </div>
                        <div className="flex space-x-2 items-center">
                            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} title="Refresh Data">
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-[240px] justify-start text-left font-normal",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={(d) => d && setDate(d)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total for {format(date, "MMM d")}</CardTitle>
                                <Clock className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatDuration(stats.totalTime)}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Top App</CardTitle>
                                <Activity className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold truncate" title={stats.topApps[0]?.appName}>
                                    {stats.topApps[0]?.appName || "N/A"}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {stats.topApps[0] ? `${formatDuration(stats.topApps[0].totalSeconds)}` : "No data"}
                                </p>
                            </CardContent>
                        </Card>

                        {/* App Visibility Filter Card */}
                        <Card className="col-span-2">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center">
                                    <Filter className="mr-2 h-4 w-4" /> Filter Apps
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[80px] overflow-y-auto">
                                <div className="flex flex-wrap gap-4">
                                    {allApps.map(app => (
                                        <div key={app} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`app-${app}`}
                                                checked={!hiddenApps.includes(app)}
                                                onCheckedChange={() => toggleAppVisibility(app)}
                                            />
                                            <Label htmlFor={`app-${app}`} className="text-sm cursor-pointer whitespace-nowrap">
                                                {app}
                                            </Label>
                                        </div>
                                    ))}
                                    {allApps.length === 0 && <span className="text-sm text-muted-foreground">No apps found for this day.</span>}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts & Logs */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        <HourlyActivityChart data={hourlyData} />
                        <AppUsagePieChart data={appUsageData} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-1">
                        <Card>
                            <CardHeader>
                                <CardTitle>Activity Logs ({format(date, "MMM d")})</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                                    {logs.filter(log => !hiddenApps.includes(log.app_name)).slice(0, 50).map((log) => (
                                        <div key={log.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium leading-none truncate w-[200px]" title={log.window_title}>
                                                    {log.window_title}
                                                </p>
                                                <p className="text-xs text-muted-foreground">{log.app_name}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium">{log.duration_seconds}s</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(log.start_time).toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {logs.length === 0 && <div className="text-center py-4 text-muted-foreground">No logs found.</div>}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    )
}
