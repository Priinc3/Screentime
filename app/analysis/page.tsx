"use client"

import { createClient } from "@/utils/supabase/client"
import { Sidebar } from "@/components/Sidebar"
import { Header } from "@/components/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useEffect, useState } from "react"
import { CalendarIcon, Trophy, Clock, ArrowUpDown } from "lucide-react"
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from "date-fns"

type ViewMode = "daily" | "weekly" | "monthly"

interface EmployeeStats {
    id: string
    name: string
    totalHours: number
    startTime: string | null
    endTime: string | null
    sessionCount: number
}

export default function AnalysisPage() {
    const [viewMode, setViewMode] = useState<ViewMode>("daily")
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    // Calculate date range based on view mode
    const getDateRange = () => {
        switch (viewMode) {
            case "daily":
                return {
                    start: startOfDay(selectedDate),
                    end: endOfDay(selectedDate)
                }
            case "weekly":
                return {
                    start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
                    end: endOfWeek(selectedDate, { weekStartsOn: 1 })
                }
            case "monthly":
                return {
                    start: startOfMonth(selectedDate),
                    end: endOfMonth(selectedDate)
                }
        }
    }

    // Navigate to previous/next period
    const navigatePeriod = (direction: "prev" | "next") => {
        const modifier = direction === "prev" ? -1 : 1
        switch (viewMode) {
            case "daily":
                setSelectedDate(prev => subDays(prev, -modifier))
                break
            case "weekly":
                setSelectedDate(prev => subWeeks(prev, -modifier))
                break
            case "monthly":
                setSelectedDate(prev => subMonths(prev, -modifier))
                break
        }
    }

    // Fetch and analyze data
    useEffect(() => {
        const fetchAnalysis = async () => {
            setLoading(true)
            const { start, end } = getDateRange()

            // Fetch activity logs within date range
            const { data: logs } = await supabase
                .from('activity_logs')
                .select('employee_id, duration_seconds, start_time, end_time')
                .gte('start_time', start.toISOString())
                .lte('start_time', end.toISOString())

            if (!logs || logs.length === 0) {
                setEmployeeStats([])
                setLoading(false)
                return
            }

            // Get unique employee IDs
            const uniqueEmpIds = Array.from(new Set(logs.map(l => l.employee_id)))

            // Fetch employee names
            const { data: employees } = await supabase
                .from('employees')
                .select('id, full_name')
                .in('id', uniqueEmpIds)

            const empNameMap = new Map<string, string>()
            if (employees) {
                employees.forEach(e => empNameMap.set(e.id, e.full_name))
            }

            // Aggregate by employee
            const empStatsMap = new Map<string, {
                totalSeconds: number
                startTime: Date | null
                endTime: Date | null
                sessionCount: number
            }>()

            logs.forEach(log => {
                const existing = empStatsMap.get(log.employee_id) || {
                    totalSeconds: 0,
                    startTime: null,
                    endTime: null,
                    sessionCount: 0
                }

                existing.totalSeconds += log.duration_seconds || 0
                existing.sessionCount += 1

                const logStart = new Date(log.start_time)
                const logEnd = log.end_time ? new Date(log.end_time) : logStart

                if (!existing.startTime || logStart < existing.startTime) {
                    existing.startTime = logStart
                }
                if (!existing.endTime || logEnd > existing.endTime) {
                    existing.endTime = logEnd
                }

                empStatsMap.set(log.employee_id, existing)
            })

            // Convert to array and sort by total hours
            const statsArray: EmployeeStats[] = Array.from(empStatsMap.entries())
                .map(([id, stats]) => ({
                    id,
                    name: empNameMap.get(id) || `Employee ${id.slice(0, 8)}`,
                    totalHours: Math.round((stats.totalSeconds / 3600) * 100) / 100,
                    startTime: stats.startTime ? format(stats.startTime, "hh:mm a") : null,
                    endTime: stats.endTime ? format(stats.endTime, "hh:mm a") : null,
                    sessionCount: stats.sessionCount
                }))
                .sort((a, b) => b.totalHours - a.totalHours)

            setEmployeeStats(statsArray)
            setLoading(false)
        }

        fetchAnalysis()
    }, [viewMode, selectedDate])

    const formatDateRange = () => {
        const { start, end } = getDateRange()
        switch (viewMode) {
            case "daily":
                return format(selectedDate, "EEEE, MMMM d, yyyy")
            case "weekly":
                return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`
            case "monthly":
                return format(selectedDate, "MMMM yyyy")
        }
    }

    return (
        <div className="flex min-h-screen bg-background">
            <aside className="w-64 hidden md:block fixed inset-y-0 z-50">
                <Sidebar />
            </aside>
            <main className="flex-1 md:pl-64 flex flex-col">
                <Header />
                <div className="flex-1 space-y-4 p-8 pt-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-3xl font-bold tracking-tight">Work Analysis</h2>
                    </div>

                    {/* Filters */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex flex-wrap items-center gap-4">
                                {/* View Mode Buttons */}
                                <div className="flex gap-2">
                                    {(["daily", "weekly", "monthly"] as ViewMode[]).map((mode) => (
                                        <Button
                                            key={mode}
                                            variant={viewMode === mode ? "default" : "outline"}
                                            onClick={() => setViewMode(mode)}
                                            className="capitalize"
                                        >
                                            {mode}
                                        </Button>
                                    ))}
                                </div>

                                {/* Date Navigation */}
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" onClick={() => navigatePeriod("prev")}>
                                        ←
                                    </Button>

                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="min-w-[200px]">
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {formatDateRange()}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={selectedDate}
                                                onSelect={(date) => date && setSelectedDate(date)}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>

                                    <Button variant="outline" size="icon" onClick={() => navigatePeriod("next")}>
                                        →
                                    </Button>

                                    <Button variant="ghost" onClick={() => setSelectedDate(new Date())}>
                                        Today
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stats Summary */}
                    {employeeStats.length > 0 && (
                        <div className="grid gap-4 md:grid-cols-3">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
                                    <Trophy className="h-4 w-4 text-yellow-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{employeeStats[0]?.name}</div>
                                    <p className="text-xs text-muted-foreground">
                                        {employeeStats[0]?.totalHours}h worked
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Total Employees Active</CardTitle>
                                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{employeeStats.length}</div>
                                    <p className="text-xs text-muted-foreground">for this period</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Total Hours Logged</CardTitle>
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {employeeStats.reduce((sum, e) => sum + e.totalHours, 0).toFixed(1)}h
                                    </div>
                                    <p className="text-xs text-muted-foreground">across all employees</p>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Employee Ranking Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Employee Work Analysis</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="text-center py-8 text-muted-foreground">Loading...</div>
                            ) : employeeStats.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No activity data for this period
                                </div>
                            ) : (
                                <div className="relative overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs uppercase bg-muted/50">
                                            <tr>
                                                <th className="px-6 py-3">Rank</th>
                                                <th className="px-6 py-3">Employee</th>
                                                <th className="px-6 py-3">Total Hours</th>
                                                <th className="px-6 py-3">First Activity</th>
                                                <th className="px-6 py-3">Last Activity</th>
                                                <th className="px-6 py-3">Sessions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {employeeStats.map((emp, index) => (
                                                <tr key={emp.id} className="border-b hover:bg-muted/25">
                                                    <td className="px-6 py-4">
                                                        {index === 0 && <span className="text-yellow-500">🥇</span>}
                                                        {index === 1 && <span className="text-gray-400">🥈</span>}
                                                        {index === 2 && <span className="text-orange-400">🥉</span>}
                                                        {index > 2 && <span className="text-muted-foreground">#{index + 1}</span>}
                                                    </td>
                                                    <td className="px-6 py-4 font-medium">{emp.name}</td>
                                                    <td className="px-6 py-4">
                                                        <span className="font-semibold">{emp.totalHours}h</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-muted-foreground">
                                                        {emp.startTime || "-"}
                                                    </td>
                                                    <td className="px-6 py-4 text-muted-foreground">
                                                        {emp.endTime || "-"}
                                                    </td>
                                                    <td className="px-6 py-4 text-muted-foreground">
                                                        {emp.sessionCount}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    )
}
