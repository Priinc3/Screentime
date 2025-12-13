"use client"

import { createClient } from "@/utils/supabase/client"
import { capDuration, getExcludedUserIds } from "@/utils/dataFilters"
import { Sidebar } from "@/components/Sidebar"
import { Header } from "@/components/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useEffect, useState, useRef } from "react"
import { CalendarIcon, Trophy, Clock, ArrowUpDown, Download, FileText } from "lucide-react"
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, eachDayOfInterval, addDays } from "date-fns"

type ViewMode = "daily" | "weekly" | "monthly"

interface EmployeeStats {
    id: string
    name: string
    totalHours: number
    startTime: string | null
    endTime: string | null
    sessionCount: number
    dailyBreakdown?: { date: string; hours: number }[]
    topApps?: { name: string; hours: number }[]
}

interface DayData {
    date: string
    hours: number
}

export default function AnalysisPage() {
    const [viewMode, setViewMode] = useState<ViewMode>("daily")
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([])
    const [loading, setLoading] = useState(true)

    // Export dialog state
    const [showExportDialog, setShowExportDialog] = useState(false)
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("")
    const [exportData, setExportData] = useState<EmployeeStats | null>(null)
    const reportRef = useRef<HTMLDivElement>(null)

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

    // Helper to get local date key
    const getLocalDateKey = (date: Date) => {
        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, '0')
        const d = String(date.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
    }

    // Fetch and analyze data
    useEffect(() => {
        const fetchAnalysis = async () => {
            setLoading(true)
            const { start, end } = getDateRange()

            // STEP 1: Fetch ALL valid employees
            const { data: employees } = await supabase
                .from('employees')
                .select('id, full_name')

            const empNameMap = new Map<string, string>()
            const validEmployeeIds = new Set<string>()
            if (employees) {
                employees.forEach(emp => {
                    empNameMap.set(emp.id, emp.full_name)
                    validEmployeeIds.add(emp.id)
                })
            }

            const excludedIds = getExcludedUserIds()

            // STEP 2: Fetch activity logs within date range
            // Use local date comparison for accuracy
            const { data: rawLogs } = await supabase
                .from('activity_logs')
                .select('employee_id, duration_seconds, start_time, end_time, app_name')
                .gte('start_time', start.toISOString())
                .lte('start_time', end.toISOString())

            // Filter logs
            const filteredLogs = (rawLogs || []).filter(log => {
                if (!validEmployeeIds.has(log.employee_id)) return false
                if (excludedIds.includes(log.employee_id)) return false
                return true
            })

            if (filteredLogs.length === 0) {
                setEmployeeStats([])
                setLoading(false)
                return
            }

            // STEP 3: Generate days for daily breakdown (for weekly/monthly)
            const daysInRange = eachDayOfInterval({ start, end })

            // STEP 4: Aggregate by employee with daily breakdown
            const empStatsMap = new Map<string, {
                totalSeconds: number
                startTime: Date | null
                endTime: Date | null
                sessionCount: number
                dailySeconds: Map<string, number>
                appSeconds: Map<string, number>
            }>()

            filteredLogs.forEach(log => {
                const existing = empStatsMap.get(log.employee_id) || {
                    totalSeconds: 0,
                    startTime: null,
                    endTime: null,
                    sessionCount: 0,
                    dailySeconds: new Map<string, number>(),
                    appSeconds: new Map<string, number>()
                }

                const cappedDuration = capDuration(log.duration_seconds || 0)
                existing.totalSeconds += cappedDuration
                existing.sessionCount += 1

                const logStart = new Date(log.start_time)
                const logEnd = log.end_time ? new Date(log.end_time) : logStart
                const dateKey = getLocalDateKey(logStart)

                // Daily breakdown
                const currentDaily = existing.dailySeconds.get(dateKey) || 0
                existing.dailySeconds.set(dateKey, currentDaily + cappedDuration)

                // App breakdown
                if (log.app_name) {
                    const currentApp = existing.appSeconds.get(log.app_name) || 0
                    existing.appSeconds.set(log.app_name, currentApp + cappedDuration)
                }

                if (!existing.startTime || logStart < existing.startTime) {
                    existing.startTime = logStart
                }
                if (!existing.endTime || logEnd > existing.endTime) {
                    existing.endTime = logEnd
                }

                empStatsMap.set(log.employee_id, existing)
            })

            // STEP 5: Convert to array with daily breakdown
            const statsArray: EmployeeStats[] = Array.from(empStatsMap.entries())
                .map(([id, stats]) => {
                    // Build daily breakdown
                    const dailyBreakdown = daysInRange.map(day => {
                        const key = getLocalDateKey(day)
                        return {
                            date: format(day, "EEE MM/dd"),
                            hours: Math.round(((stats.dailySeconds.get(key) || 0) / 3600) * 100) / 100
                        }
                    })

                    // Build top apps
                    const topApps = Array.from(stats.appSeconds.entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([name, seconds]) => ({
                            name,
                            hours: Math.round((seconds / 3600) * 100) / 100
                        }))

                    return {
                        id,
                        name: empNameMap.get(id) || `Employee ${id.slice(0, 8)}`,
                        totalHours: Math.round((stats.totalSeconds / 3600) * 100) / 100,
                        startTime: stats.startTime ? format(stats.startTime, "hh:mm a") : null,
                        endTime: stats.endTime ? format(stats.endTime, "hh:mm a") : null,
                        sessionCount: stats.sessionCount,
                        dailyBreakdown,
                        topApps
                    }
                })
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

    // Export report functions
    const openExportDialog = (employeeId: string) => {
        setSelectedEmployeeId(employeeId)
        const empData = employeeStats.find(e => e.id === employeeId)
        setExportData(empData || null)
        setShowExportDialog(true)
    }

    const downloadReport = () => {
        if (!exportData) return

        const { start, end } = getDateRange()
        const reportContent = generateReportHTML(exportData, viewMode, start, end)

        const blob = new Blob([reportContent], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${exportData.name.replace(/\s+/g, '_')}_${viewMode}_report_${format(selectedDate, 'yyyy-MM-dd')}.html`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const generateReportHTML = (data: EmployeeStats, mode: ViewMode, start: Date, end: Date) => {
        const periodLabel = mode === 'daily'
            ? format(selectedDate, "MMMM d, yyyy")
            : mode === 'weekly'
                ? `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`
                : format(selectedDate, "MMMM yyyy")

        const dailyTableRows = data.dailyBreakdown?.map(d => `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${d.date}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${d.hours}h</td>
            </tr>
        `).join('') || ''

        const appsTableRows = data.topApps?.map(a => `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${a.name}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${a.hours}h</td>
            </tr>
        `).join('') || ''

        // Generate simple bar chart using CSS
        const maxHours = Math.max(...(data.dailyBreakdown?.map(d => d.hours) || [1]), 1)
        const chartBars = data.dailyBreakdown?.map(d => {
            const height = Math.max((d.hours / maxHours) * 150, 5)
            return `
                <div style="display: flex; flex-direction: column; align-items: center; margin: 0 4px;">
                    <div style="height: ${height}px; width: 30px; background: linear-gradient(180deg, #3b82f6, #1d4ed8); border-radius: 4px 4px 0 0;"></div>
                    <div style="font-size: 10px; margin-top: 4px;">${d.date.split(' ')[0]}</div>
                    <div style="font-size: 9px; color: #666;">${d.hours}h</div>
                </div>
            `
        }).join('') || ''

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Employee Report - ${data.name}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
        h1 { color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
        h2 { color: #374151; margin-top: 30px; }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 28px; font-weight: bold; color: #3b82f6; }
        .stat-label { font-size: 14px; color: #6b7280; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { background: #f3f4f6; padding: 10px 8px; border: 1px solid #ddd; text-align: left; }
        .chart-container { display: flex; align-items: flex-end; justify-content: center; height: 200px; padding: 20px; background: #f9fafb; border-radius: 8px; margin: 20px 0; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <h1>📊 Employee Activity Report</h1>
    
    <p><strong>Employee:</strong> ${data.name}</p>
    <p><strong>Period:</strong> ${periodLabel} (${mode})</p>
    <p><strong>Generated:</strong> ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</p>
    
    <h2>Summary</h2>
    <div class="summary">
        <div class="stat-card">
            <div class="stat-value">${data.totalHours}h</div>
            <div class="stat-label">Total Hours</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.sessionCount}</div>
            <div class="stat-label">Sessions</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.startTime || '-'}</div>
            <div class="stat-label">First Activity</div>
        </div>
    </div>

    ${mode !== 'daily' ? `
    <h2>Daily Breakdown</h2>
    <div class="chart-container">
        ${chartBars}
    </div>
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th style="text-align: right;">Hours</th>
            </tr>
        </thead>
        <tbody>
            ${dailyTableRows}
        </tbody>
    </table>
    ` : ''}

    <h2>Top Applications</h2>
    <table>
        <thead>
            <tr>
                <th>Application</th>
                <th style="text-align: right;">Hours</th>
            </tr>
        </thead>
        <tbody>
            ${appsTableRows || '<tr><td colspan="2" style="text-align: center; padding: 20px;">No app data available</td></tr>'}
        </tbody>
    </table>

    <div class="footer">
        <p>This report was generated by Employee Monitor Dashboard.</p>
    </div>
</body>
</html>
        `
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
                                                <th className="px-4 py-3">Rank</th>
                                                <th className="px-4 py-3">Employee</th>
                                                <th className="px-4 py-3">Total Hours</th>
                                                {viewMode !== 'daily' && <th className="px-4 py-3">Daily Breakdown</th>}
                                                <th className="px-4 py-3">First Activity</th>
                                                <th className="px-4 py-3">Last Activity</th>
                                                <th className="px-4 py-3">Sessions</th>
                                                <th className="px-4 py-3">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {employeeStats.map((emp, index) => (
                                                <tr key={emp.id} className="border-b hover:bg-muted/25">
                                                    <td className="px-4 py-4">
                                                        {index === 0 && <span className="text-yellow-500">🥇</span>}
                                                        {index === 1 && <span className="text-gray-400">🥈</span>}
                                                        {index === 2 && <span className="text-orange-400">🥉</span>}
                                                        {index > 2 && <span className="text-muted-foreground">#{index + 1}</span>}
                                                    </td>
                                                    <td className="px-4 py-4 font-medium">{emp.name}</td>
                                                    <td className="px-4 py-4">
                                                        <span className="font-semibold">{emp.totalHours}h</span>
                                                    </td>
                                                    {viewMode !== 'daily' && (
                                                        <td className="px-4 py-4">
                                                            <div className="flex gap-1 items-end h-8">
                                                                {emp.dailyBreakdown?.slice(0, 7).map((d, i) => {
                                                                    const maxH = Math.max(...(emp.dailyBreakdown?.map(x => x.hours) || [1]), 0.1)
                                                                    const height = Math.max((d.hours / maxH) * 100, 5)
                                                                    return (
                                                                        <div
                                                                            key={i}
                                                                            className="bg-primary/80 rounded-t w-3"
                                                                            style={{ height: `${height}%` }}
                                                                            title={`${d.date}: ${d.hours}h`}
                                                                        />
                                                                    )
                                                                })}
                                                            </div>
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-4 text-muted-foreground">
                                                        {emp.startTime || "-"}
                                                    </td>
                                                    <td className="px-4 py-4 text-muted-foreground">
                                                        {emp.endTime || "-"}
                                                    </td>
                                                    <td className="px-4 py-4 text-muted-foreground">
                                                        {emp.sessionCount}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openExportDialog(emp.id)}
                                                        >
                                                            <Download className="h-4 w-4 mr-1" />
                                                            Export
                                                        </Button>
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

            {/* Export Dialog */}
            <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Export Report - {exportData?.name}
                        </DialogTitle>
                        <DialogDescription>
                            {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} report for {formatDateRange()}
                        </DialogDescription>
                    </DialogHeader>

                    {exportData && (
                        <div className="space-y-4" ref={reportRef}>
                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-muted p-4 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-primary">{exportData.totalHours}h</div>
                                    <div className="text-sm text-muted-foreground">Total Hours</div>
                                </div>
                                <div className="bg-muted p-4 rounded-lg text-center">
                                    <div className="text-2xl font-bold">{exportData.sessionCount}</div>
                                    <div className="text-sm text-muted-foreground">Sessions</div>
                                </div>
                                <div className="bg-muted p-4 rounded-lg text-center">
                                    <div className="text-lg font-bold">{exportData.startTime || '-'}</div>
                                    <div className="text-sm text-muted-foreground">First Activity</div>
                                </div>
                            </div>

                            {/* Daily Breakdown for weekly/monthly */}
                            {viewMode !== 'daily' && exportData.dailyBreakdown && (
                                <div>
                                    <h4 className="font-semibold mb-2">Daily Breakdown</h4>
                                    <div className="bg-muted p-4 rounded-lg">
                                        <div className="flex items-end justify-around h-32 gap-1">
                                            {exportData.dailyBreakdown.map((d, i) => {
                                                const maxH = Math.max(...exportData.dailyBreakdown!.map(x => x.hours), 0.1)
                                                const height = Math.max((d.hours / maxH) * 100, 5)
                                                return (
                                                    <div key={i} className="flex flex-col items-center">
                                                        <div
                                                            className="bg-primary rounded-t w-6 transition-all"
                                                            style={{ height: `${height}%` }}
                                                        />
                                                        <div className="text-[10px] mt-1">{d.date.split(' ')[0]}</div>
                                                        <div className="text-[9px] text-muted-foreground">{d.hours}h</div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Top Apps */}
                            {exportData.topApps && exportData.topApps.length > 0 && (
                                <div>
                                    <h4 className="font-semibold mb-2">Top Applications</h4>
                                    <div className="space-y-2">
                                        {exportData.topApps.map((app, i) => (
                                            <div key={i} className="flex items-center justify-between bg-muted p-2 rounded">
                                                <span>{app.name}</span>
                                                <span className="font-semibold">{app.hours}h</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <Button onClick={downloadReport} className="w-full">
                                <Download className="h-4 w-4 mr-2" />
                                Download HTML Report
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
