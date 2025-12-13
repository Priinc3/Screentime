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
import { useEffect, useState, useRef } from "react"
import { CalendarIcon, Trophy, Clock, ArrowUpDown, Download, FileText, Printer } from "lucide-react"
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, eachDayOfInterval } from "date-fns"

type ViewMode = "daily" | "weekly" | "monthly"

interface DayBreakdown {
    date: string
    dateFormatted: string
    hours: number
}

interface EmployeeStats {
    id: string
    name: string
    totalHours: number
    startTime: string | null
    endTime: string | null
    sessionCount: number
    dailyBreakdown: DayBreakdown[]
    topApps: { name: string; hours: number }[]
}

export default function AnalysisPage() {
    const [viewMode, setViewMode] = useState<ViewMode>("daily")
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([])
    const [loading, setLoading] = useState(true)

    // Export dialog state
    const [showExportDialog, setShowExportDialog] = useState(false)
    const [exportData, setExportData] = useState<EmployeeStats | null>(null)
    const printRef = useRef<HTMLDivElement>(null)

    const supabase = createClient()

    // Get date range based on view mode
    const getDateRange = () => {
        switch (viewMode) {
            case "daily":
                return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) }
            case "weekly":
                return { start: startOfWeek(selectedDate, { weekStartsOn: 1 }), end: endOfWeek(selectedDate, { weekStartsOn: 1 }) }
            case "monthly":
                return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) }
        }
    }

    // Navigate periods
    const navigatePeriod = (direction: "prev" | "next") => {
        const modifier = direction === "prev" ? -1 : 1
        switch (viewMode) {
            case "daily": setSelectedDate(prev => subDays(prev, -modifier)); break
            case "weekly": setSelectedDate(prev => subWeeks(prev, -modifier)); break
            case "monthly": setSelectedDate(prev => subMonths(prev, -modifier)); break
        }
    }

    // Local date key helper
    const getLocalDateKey = (date: Date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }

    // Fetch and analyze data
    useEffect(() => {
        const fetchAnalysis = async () => {
            setLoading(true)
            const { start, end } = getDateRange()

            // Fetch valid employees
            const { data: employees } = await supabase.from('employees').select('id, full_name')
            const empNameMap = new Map<string, string>()
            const validEmployeeIds = new Set<string>()
            employees?.forEach(emp => {
                empNameMap.set(emp.id, emp.full_name)
                validEmployeeIds.add(emp.id)
            })

            const excludedIds = getExcludedUserIds()

            // Fetch ALL activity logs in the date range
            const { data: rawLogs } = await supabase
                .from('activity_logs')
                .select('employee_id, duration_seconds, start_time, end_time, app_name')
                .gte('start_time', start.toISOString())
                .lte('start_time', end.toISOString())

            // Filter logs
            const filteredLogs = (rawLogs || []).filter(log =>
                validEmployeeIds.has(log.employee_id) && !excludedIds.includes(log.employee_id)
            )

            if (filteredLogs.length === 0) {
                setEmployeeStats([])
                setLoading(false)
                return
            }

            // Get all days in the period
            const daysInRange = eachDayOfInterval({ start, end })

            // Aggregate by employee
            const empData = new Map<string, {
                totalSeconds: number
                startTime: Date | null
                endTime: Date | null
                sessionCount: number
                dailySeconds: Map<string, number>
                appSeconds: Map<string, number>
            }>()

            filteredLogs.forEach(log => {
                const emp = empData.get(log.employee_id) || {
                    totalSeconds: 0,
                    startTime: null,
                    endTime: null,
                    sessionCount: 0,
                    dailySeconds: new Map(),
                    appSeconds: new Map()
                }

                // CAP DURATION TO 2 HOURS (7200 seconds)
                const cappedDuration = capDuration(log.duration_seconds || 0)
                emp.totalSeconds += cappedDuration
                emp.sessionCount++

                const logStart = new Date(log.start_time)
                const logEnd = log.end_time ? new Date(log.end_time) : logStart
                const dateKey = getLocalDateKey(logStart)

                // Daily breakdown
                emp.dailySeconds.set(dateKey, (emp.dailySeconds.get(dateKey) || 0) + cappedDuration)

                // App breakdown
                if (log.app_name) {
                    emp.appSeconds.set(log.app_name, (emp.appSeconds.get(log.app_name) || 0) + cappedDuration)
                }

                if (!emp.startTime || logStart < emp.startTime) emp.startTime = logStart
                if (!emp.endTime || logEnd > emp.endTime) emp.endTime = logEnd

                empData.set(log.employee_id, emp)
            })

            // Build stats array
            const statsArray: EmployeeStats[] = Array.from(empData.entries())
                .map(([id, data]) => {
                    const dailyBreakdown = daysInRange.map(day => {
                        const key = getLocalDateKey(day)
                        const seconds = data.dailySeconds.get(key) || 0
                        return {
                            date: key,
                            dateFormatted: format(day, "EEE MM/dd"),
                            hours: Math.round((seconds / 3600) * 100) / 100
                        }
                    })

                    // WEEKLY/MONTHLY TOTAL = SUM OF DAILY HOURS
                    const totalHours = dailyBreakdown.reduce((sum, d) => sum + d.hours, 0)

                    const topApps = Array.from(data.appSeconds.entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([name, sec]) => ({ name, hours: Math.round((sec / 3600) * 100) / 100 }))

                    return {
                        id,
                        name: empNameMap.get(id) || `Employee ${id.slice(0, 8)}`,
                        totalHours: Math.round(totalHours * 100) / 100,
                        startTime: data.startTime ? format(data.startTime, "hh:mm a") : null,
                        endTime: data.endTime ? format(data.endTime, "hh:mm a") : null,
                        sessionCount: data.sessionCount,
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
            case "daily": return format(selectedDate, "EEEE, MMMM d, yyyy")
            case "weekly": return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`
            case "monthly": return format(selectedDate, "MMMM yyyy")
        }
    }

    // Export functions
    const openExportDialog = (employeeId: string) => {
        const emp = employeeStats.find(e => e.id === employeeId)
        setExportData(emp || null)
        setShowExportDialog(true)
    }

    const printReport = () => {
        if (!printRef.current) return
        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        const { start, end } = getDateRange()
        const periodLabel = viewMode === 'daily'
            ? format(selectedDate, "MMMM d, yyyy")
            : viewMode === 'weekly'
                ? `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`
                : format(selectedDate, "MMMM yyyy")

        // Generate chart SVG
        const maxHours = Math.max(...(exportData?.dailyBreakdown.map(d => d.hours) || [1]), 0.1)
        const barWidth = 40
        const chartWidth = (exportData?.dailyBreakdown.length || 1) * (barWidth + 10)
        const chartHeight = 150

        const chartBars = exportData?.dailyBreakdown.map((d, i) => {
            const barHeight = Math.max((d.hours / maxHours) * chartHeight, 5)
            const x = i * (barWidth + 10) + 5
            const y = chartHeight - barHeight
            return `
                <g>
                    <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="#3b82f6" rx="4"/>
                    <text x="${x + barWidth / 2}" y="${chartHeight + 15}" text-anchor="middle" font-size="10">${d.dateFormatted.split(' ')[0]}</text>
                    <text x="${x + barWidth / 2}" y="${chartHeight + 28}" text-anchor="middle" font-size="9" fill="#666">${d.hours}h</text>
                </g>
            `
        }).join('') || ''

        const appsTable = exportData?.topApps.map(a => `
            <tr><td style="padding:8px;border:1px solid #ddd">${a.name}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">${a.hours}h</td></tr>
        `).join('') || ''

        const dailyTable = exportData?.dailyBreakdown.map(d => `
            <tr><td style="padding:8px;border:1px solid #ddd">${d.dateFormatted}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">${d.hours}h</td></tr>
        `).join('') || ''

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Employee Report - ${exportData?.name}</title>
                <style>
                    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                    h1 { color: #1f2937; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
                    h2 { color: #374151; margin-top: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
                    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
                    .stat-card { background: linear-gradient(135deg, #f3f4f6, #e5e7eb); padding: 20px; border-radius: 12px; text-align: center; }
                    .stat-value { font-size: 32px; font-weight: bold; color: #3b82f6; }
                    .stat-label { font-size: 14px; color: #6b7280; margin-top: 5px; }
                    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    th { background: #f3f4f6; padding: 12px 8px; border: 1px solid #ddd; text-align: left; font-weight: 600; }
                    .chart-container { background: #f9fafb; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center; }
                    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #6b7280; font-size: 12px; text-align: center; }
                    .badge { display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
                </style>
            </head>
            <body>
                <h1>📊 Employee Activity Report</h1>
                
                <p><strong>Employee:</strong> ${exportData?.name} <span class="badge">${viewMode.toUpperCase()}</span></p>
                <p><strong>Period:</strong> ${periodLabel}</p>
                <p><strong>Generated:</strong> ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</p>
                
                <h2>📈 Summary</h2>
                <div class="summary">
                    <div class="stat-card">
                        <div class="stat-value">${exportData?.totalHours}h</div>
                        <div class="stat-label">Total Hours</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${exportData?.sessionCount}</div>
                        <div class="stat-label">Sessions</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${exportData?.startTime || '-'}</div>
                        <div class="stat-label">First Activity</div>
                    </div>
                </div>

                ${viewMode !== 'daily' ? `
                <h2>📅 Daily Breakdown</h2>
                <div class="chart-container">
                    <svg width="${chartWidth + 20}" height="${chartHeight + 40}" style="max-width:100%">
                        ${chartBars}
                    </svg>
                </div>
                <table>
                    <thead><tr><th>Date</th><th style="text-align:right">Hours</th></tr></thead>
                    <tbody>${dailyTable}</tbody>
                </table>
                ` : ''}

                <h2>🖥️ Top Applications</h2>
                <table>
                    <thead><tr><th>Application</th><th style="text-align:right">Hours</th></tr></thead>
                    <tbody>${appsTable || '<tr><td colspan="2" style="text-align:center;padding:20px;color:#666">No app data</td></tr>'}</tbody>
                </table>

                <div class="footer">
                    <p>Generated by Employee Monitor Dashboard • ${format(new Date(), "yyyy")}</p>
                </div>
            </body>
            </html>
        `)

        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
            printWindow.print()
        }, 500)
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
                                    <Button variant="outline" size="icon" onClick={() => navigatePeriod("prev")}>←</Button>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="min-w-[200px]">
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {formatDateRange()}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                    <Button variant="outline" size="icon" onClick={() => navigatePeriod("next")}>→</Button>
                                    <Button variant="ghost" onClick={() => setSelectedDate(new Date())}>Today</Button>
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
                                    <p className="text-xs text-muted-foreground">{employeeStats[0]?.totalHours}h worked</p>
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

                    {/* Employee Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Employee Work Analysis</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="text-center py-8 text-muted-foreground">Loading...</div>
                            ) : employeeStats.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">No activity data for this period</div>
                            ) : (
                                <div className="relative overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs uppercase bg-muted/50">
                                            <tr>
                                                <th className="px-4 py-3">Rank</th>
                                                <th className="px-4 py-3">Employee</th>
                                                <th className="px-4 py-3">Total Hours</th>
                                                {viewMode !== 'daily' && <th className="px-4 py-3">Daily Chart</th>}
                                                <th className="px-4 py-3">First</th>
                                                <th className="px-4 py-3">Last</th>
                                                <th className="px-4 py-3">Sessions</th>
                                                <th className="px-4 py-3">Report</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {employeeStats.map((emp, index) => (
                                                <tr key={emp.id} className="border-b hover:bg-muted/25">
                                                    <td className="px-4 py-4">
                                                        {index === 0 && "🥇"}
                                                        {index === 1 && "🥈"}
                                                        {index === 2 && "🥉"}
                                                        {index > 2 && <span className="text-muted-foreground">#{index + 1}</span>}
                                                    </td>
                                                    <td className="px-4 py-4 font-medium">{emp.name}</td>
                                                    <td className="px-4 py-4">
                                                        <span className="font-bold text-lg">{emp.totalHours}h</span>
                                                    </td>
                                                    {viewMode !== 'daily' && (
                                                        <td className="px-4 py-4">
                                                            <div className="flex gap-0.5 items-end h-6">
                                                                {emp.dailyBreakdown.slice(0, 7).map((d, i) => {
                                                                    const max = Math.max(...emp.dailyBreakdown.map(x => x.hours), 0.1)
                                                                    const h = Math.max((d.hours / max) * 100, 8)
                                                                    return (
                                                                        <div key={i} title={`${d.dateFormatted}: ${d.hours}h`}
                                                                            className="bg-primary rounded-t w-2" style={{ height: `${h}%` }} />
                                                                    )
                                                                })}
                                                            </div>
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-4 text-muted-foreground">{emp.startTime || "-"}</td>
                                                    <td className="px-4 py-4 text-muted-foreground">{emp.endTime || "-"}</td>
                                                    <td className="px-4 py-4 text-muted-foreground">{emp.sessionCount}</td>
                                                    <td className="px-4 py-4">
                                                        <Button variant="outline" size="sm" onClick={() => openExportDialog(emp.id)}>
                                                            <FileText className="h-4 w-4 mr-1" /> PDF
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
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" /> Report Preview - {exportData?.name}
                        </DialogTitle>
                        <DialogDescription>{viewMode.toUpperCase()} report for {formatDateRange()}</DialogDescription>
                    </DialogHeader>

                    {exportData && (
                        <div ref={printRef} className="space-y-4">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-3 gap-3">
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

                            {/* Daily Breakdown */}
                            {viewMode !== 'daily' && (
                                <div>
                                    <h4 className="font-semibold mb-2">Daily Breakdown</h4>
                                    <div className="bg-muted p-4 rounded-lg">
                                        <div className="flex items-end justify-around h-28 gap-1">
                                            {exportData.dailyBreakdown.map((d, i) => {
                                                const max = Math.max(...exportData.dailyBreakdown.map(x => x.hours), 0.1)
                                                const h = Math.max((d.hours / max) * 100, 5)
                                                return (
                                                    <div key={i} className="flex flex-col items-center flex-1 max-w-10">
                                                        <div className="bg-primary rounded-t w-full" style={{ height: `${h}%` }} />
                                                        <div className="text-[9px] mt-1">{d.dateFormatted.split(' ')[0]}</div>
                                                        <div className="text-[8px] text-muted-foreground">{d.hours}h</div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Top Apps */}
                            {exportData.topApps.length > 0 && (
                                <div>
                                    <h4 className="font-semibold mb-2">Top Applications</h4>
                                    <div className="space-y-1">
                                        {exportData.topApps.map((app, i) => (
                                            <div key={i} className="flex justify-between bg-muted p-2 rounded">
                                                <span className="truncate">{app.name}</span>
                                                <span className="font-semibold ml-2">{app.hours}h</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <Button onClick={printReport} className="w-full mt-4" size="lg">
                                <Printer className="h-4 w-4 mr-2" /> Print / Save as PDF
                            </Button>
                            <p className="text-xs text-center text-muted-foreground">
                                Use "Save as PDF" in the print dialog for a PDF file
                            </p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
