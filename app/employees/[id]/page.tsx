"use client"

import { createClient } from "@/utils/supabase/client"
import { Sidebar } from "@/components/Sidebar"
import { Header } from "@/components/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { Clock, Activity, Calendar, RefreshCw } from "lucide-react"
import { useParams } from "next/navigation"

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
    percentage: number
}

import { HourlyActivityChart } from "@/components/charts/HourlyActivityChart"
import { AppUsagePieChart } from "@/components/charts/AppUsagePieChart"

export default function EmployeeDetailsPage() {
    const params = useParams()
    const id = params?.id as string
    const [employee, setEmployee] = useState<Employee | null>(null)
    const [logs, setLogs] = useState<ActivityLog[]>([])
    const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today')
    const [stats, setStats] = useState({ totalTime: 0, topApps: [] as AppUsage[] })
    const [hourlyData, setHourlyData] = useState<{ hour: string; activity: number }[]>([])
    const [appUsageData, setAppUsageData] = useState<{ name: string; value: number }[]>([])
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    const fetchData = async () => {
        setLoading(true)
        // Fetch Employee
        const { data: empData } = await supabase.from('employees').select('*').eq('id', id).single()
        if (empData) setEmployee(empData)

        // Fetch Logs
        let query = supabase
            .from('activity_logs')
            .select('*')
            .eq('employee_id', id)
            .order('start_time', { ascending: false })

        const now = new Date()
        if (timeRange === 'today') {
            const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString()
            query = query.gte('start_time', startOfDay)
        } else if (timeRange === 'week') {
            const startOfWeek = new Date(now.setDate(now.getDate() - 7)).toISOString()
            query = query.gte('start_time', startOfWeek)
        } else if (timeRange === 'month') {
            const startOfMonth = new Date(now.setDate(now.getDate() - 30)).toISOString()
            query = query.gte('start_time', startOfMonth)
        }

        const { data: logData } = await query
        if (logData) {
            setLogs(logData)
            calculateStats(logData)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [id, timeRange])

    const calculateStats = (data: ActivityLog[]) => {
        const totalSeconds = data.reduce((acc, log) => acc + log.duration_seconds, 0)

        const appMap = new Map<string, number>()
        const hourMap = new Map<number, number>()

        data.forEach(log => {
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
                totalSeconds: seconds,
                percentage: totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0
            }))
            .sort((a, b) => b.totalSeconds - a.totalSeconds)
            .slice(0, 5)

        // App Usage Chart Data
        const appChartData = Array.from(appMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6) // Top 6 for pie chart
        setAppUsageData(appChartData)

        // Hourly Activity Chart Data
        const hourlyChartData = Array.from({ length: 24 }, (_, i) => {
            const seconds = hourMap.get(i) || 0
            // Calculate percentage of activity relative to total time (or just raw seconds/minutes?)
            // Let's show percentage of total activity for that day/period
            const percentage = totalSeconds > 0 ? Math.round((seconds / totalSeconds) * 100) : 0
            return {
                hour: `${i}:00`,
                activity: percentage
            }
        })
        setHourlyData(hourlyChartData)

        setStats({ totalTime: totalSeconds, topApps })
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
                                {isOnline(employee.last_heartbeat) && employee.current_app && (
                                    <p className="text-xs text-green-600 mt-1">
                                        Currently using: <strong>{employee.current_app}</strong>
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex space-x-2">
                            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} title="Refresh Data">
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                            <Button variant={timeRange === 'today' ? 'default' : 'outline'} onClick={() => setTimeRange('today')}>Today</Button>
                            <Button variant={timeRange === 'week' ? 'default' : 'outline'} onClick={() => setTimeRange('week')}>This Week</Button>
                            <Button variant={timeRange === 'month' ? 'default' : 'outline'} onClick={() => setTimeRange('month')}>Last Month</Button>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Active Time</CardTitle>
                                <Clock className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatDuration(stats.totalTime)}</div>
                                <p className="text-xs text-muted-foreground">in selected period</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Top App</CardTitle>
                                <Activity className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.topApps[0]?.appName || "N/A"}</div>
                                <p className="text-xs text-muted-foreground">
                                    {stats.topApps[0] ? `${formatDuration(stats.topApps[0].totalSeconds)} usage` : "No data"}
                                </p>
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
                                <CardTitle>Recent Activity Logs</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                                    {logs.slice(0, 20).map((log) => (
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
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    )
}
