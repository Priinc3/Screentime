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
import { CalendarIcon, Trophy, Clock, ArrowUpDown, FileText, Printer, RefreshCw } from "lucide-react"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, eachDayOfInterval, isToday } from "date-fns"

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
    sessionCount: number
    dailyBreakdown: DayBreakdown[]
    topApp: string
}

export default function AnalysisPage() {
    const [viewMode, setViewMode] = useState<ViewMode>("daily")
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)

    const [showExportDialog, setShowExportDialog] = useState(false)
    const [exportData, setExportData] = useState<EmployeeStats | null>(null)
    const printRef = useRef<HTMLDivElement>(null)

    const supabase = createClient()

    // LOCAL timezone date string (not UTC!)
    const getLocalDateStr = (d: Date) => {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }
    const getTodayStr = () => getLocalDateStr(new Date())

    // Get date range based on view mode
    const getDateRange = () => {
        switch (viewMode) {
            case "daily":
                const dayStr = getLocalDateStr(selectedDate)
                return { startStr: dayStr, endStr: dayStr }
            case "weekly":
                const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
                const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })
                return { startStr: getLocalDateStr(weekStart), endStr: getLocalDateStr(weekEnd) }
            case "monthly":
                const monthStart = startOfMonth(selectedDate)
                const monthEnd = endOfMonth(selectedDate)
                return { startStr: getLocalDateStr(monthStart), endStr: getLocalDateStr(monthEnd) }
        }
    }

    const navigatePeriod = (direction: "prev" | "next") => {
        const modifier = direction === "prev" ? -1 : 1
        switch (viewMode) {
            case "daily": setSelectedDate(prev => subDays(prev, -modifier)); break
            case "weekly": setSelectedDate(prev => subWeeks(prev, -modifier)); break
            case "monthly": setSelectedDate(prev => subMonths(prev, -modifier)); break
        }
    }

    // Sync today's data to daily_summary
    const syncToday = async () => {
        setSyncing(true)
        try {
            await fetch('/api/aggregate-daily', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: getTodayStr() })
            })
            fetchAnalysis()
        } catch (e) {
            console.error('Sync error:', e)
        }
        setSyncing(false)
    }

    // FETCH TODAY'S DATA LIVE FROM activity_logs
    const fetchTodayLive = async (employeeIds: Set<string>, excludedIds: string[], empNameMap: Map<string, string>) => {
        const todayStr = getTodayStr()
        // Use IST timezone offset (+05:30) for correct date filtering
        const startOfDay = `${todayStr}T00:00:00+05:30`
        const endOfDay = `${todayStr}T23:59:59+05:30`

        const { data: logs } = await supabase
            .from('activity_logs')
            .select('employee_id, duration_seconds, app_name')
            .gte('start_time', startOfDay)
            .lte('start_time', endOfDay)

        if (!logs || logs.length === 0) return []

        // Aggregate by employee
        const empData = new Map<string, { seconds: number, sessions: number, apps: Map<string, number> }>()

        for (const log of logs) {
            if (!employeeIds.has(log.employee_id)) continue
            if (excludedIds.includes(log.employee_id)) continue

            const emp = empData.get(log.employee_id) || { seconds: 0, sessions: 0, apps: new Map() }
            const cappedDuration = capDuration(log.duration_seconds || 0)
            emp.seconds += cappedDuration
            emp.sessions++
            if (log.app_name) {
                emp.apps.set(log.app_name, (emp.apps.get(log.app_name) || 0) + cappedDuration)
            }
            empData.set(log.employee_id, emp)
        }

        // Build stats array for today
        const statsArray: EmployeeStats[] = Array.from(empData.entries()).map(([id, data]) => {
            let topApp = ''
            let topAppSec = 0
            for (const [app, sec] of data.apps) {
                if (sec > topAppSec) { topApp = app; topAppSec = sec }
            }

            return {
                id,
                name: empNameMap.get(id) || `Employee ${id.slice(0, 8)}`,
                totalHours: Math.round((data.seconds / 3600) * 100) / 100,
                sessionCount: data.sessions,
                dailyBreakdown: [{ date: todayStr, dateFormatted: format(new Date(), "EEE MM/dd"), hours: Math.round((data.seconds / 3600) * 100) / 100 }],
                topApp
            }
        }).sort((a, b) => b.totalHours - a.totalHours)

        return statsArray
    }

    // FETCH DATA - Uses activity_logs for today, daily_summary for historical
    const fetchAnalysis = async () => {
        setLoading(true)
        const { startStr, endStr } = getDateRange()
        const todayStr = getTodayStr()

        // Fetch employees
        const { data: employees } = await supabase.from('employees').select('id, full_name')
        const empNameMap = new Map<string, string>()
        const validEmployeeIds = new Set<string>()
        employees?.forEach(emp => {
            empNameMap.set(emp.id, emp.full_name)
            validEmployeeIds.add(emp.id)
        })

        const excludedIds = getExcludedUserIds()

        // Check if we need today's live data
        const needsTodayLive = startStr <= todayStr && endStr >= todayStr

        // For daily view of today - use LIVE activity_logs
        if (viewMode === 'daily' && startStr === todayStr) {
            const liveStats = await fetchTodayLive(validEmployeeIds, excludedIds, empNameMap)
            setEmployeeStats(liveStats)
            setLoading(false)
            return
        }

        // For weekly/monthly or historical dates - use daily_summary
        // But if range includes today, we need to merge live data with historical
        let allStats: EmployeeStats[] = []

        // Fetch historical data from daily_summary (excluding today)
        const historicalEndStr = needsTodayLive ?
            getLocalDateStr(subDays(new Date(todayStr), 1)) : endStr

        if (startStr <= historicalEndStr) {
            const { data: summaries } = await supabase
                .from('daily_summary')
                .select('employee_id, date, total_seconds, session_count, top_app')
                .gte('date', startStr)
                .lte('date', historicalEndStr)

            // Process historical summaries
            if (summaries && summaries.length > 0) {
                const empData = new Map<string, { seconds: number, sessions: number, topApp: string, dailyData: Map<string, number> }>()

                for (const s of summaries) {
                    if (!validEmployeeIds.has(s.employee_id)) continue
                    if (excludedIds.includes(s.employee_id)) continue

                    const emp = empData.get(s.employee_id) || { seconds: 0, sessions: 0, topApp: '', dailyData: new Map() }
                    emp.seconds += s.total_seconds || 0
                    emp.sessions += s.session_count || 0
                    emp.dailyData.set(s.date, s.total_seconds || 0)
                    if (s.top_app) emp.topApp = s.top_app
                    empData.set(s.employee_id, emp)
                }

                // Convert to stats
                for (const [id, data] of empData) {
                    allStats.push({
                        id,
                        name: empNameMap.get(id) || `Employee ${id.slice(0, 8)}`,
                        totalHours: Math.round((data.seconds / 3600) * 100) / 100,
                        sessionCount: data.sessions,
                        dailyBreakdown: [], // Will fill later
                        topApp: data.topApp
                    })
                }
            }
        }

        // If range includes today, add live data
        if (needsTodayLive) {
            const liveStats = await fetchTodayLive(validEmployeeIds, excludedIds, empNameMap)

            // Merge live data with historical
            for (const live of liveStats) {
                const existing = allStats.find(s => s.id === live.id)
                if (existing) {
                    existing.totalHours = Math.round((existing.totalHours + live.totalHours) * 100) / 100
                    existing.sessionCount += live.sessionCount
                    if (live.topApp) existing.topApp = live.topApp
                } else {
                    allStats.push(live)
                }
            }
        }

        // Build daily breakdown for all stats
        const startDate = new Date(startStr + 'T00:00:00')
        const endDate = new Date(endStr + 'T00:00:00')
        const daysInRange = eachDayOfInterval({ start: startDate, end: endDate })

        // We need to refetch to get per-day data for breakdown
        // For simplicity, let's just show the totals correctly
        allStats = allStats.map(emp => ({
            ...emp,
            dailyBreakdown: daysInRange.map(day => ({
                date: getLocalDateStr(day),
                dateFormatted: format(day, "EEE MM/dd"),
                hours: 0 // Simplified - would need more complex logic for per-day breakdown
            }))
        })).sort((a, b) => b.totalHours - a.totalHours)

        setEmployeeStats(allStats)
        setLoading(false)
    }

    useEffect(() => {
        fetchAnalysis()

        // Auto-refresh every 30 seconds for today's data
        const interval = setInterval(() => {
            if (viewMode === 'daily' && getLocalDateStr(selectedDate) === getTodayStr()) {
                fetchAnalysis()
            }
        }, 30000)

        return () => clearInterval(interval)
    }, [viewMode, selectedDate])

    const formatDateRange = () => {
        const { startStr, endStr } = getDateRange()
        switch (viewMode) {
            case "daily": return format(selectedDate, "EEEE, MMMM d, yyyy")
            case "weekly": return `${format(new Date(startStr), "MMM d")} - ${format(new Date(endStr), "MMM d, yyyy")}`
            case "monthly": return format(selectedDate, "MMMM yyyy")
        }
    }

    const isViewingToday = viewMode === 'daily' && getLocalDateStr(selectedDate) === getTodayStr()

    const openExportDialog = (employeeId: string) => {
        const emp = employeeStats.find(e => e.id === employeeId)
        setExportData(emp || null)
        setShowExportDialog(true)
    }

    const printReport = () => {
        if (!exportData) return
        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        const { startStr, endStr } = getDateRange()
        const periodLabel = viewMode === 'daily'
            ? format(selectedDate, "MMMM d, yyyy")
            : viewMode === 'weekly'
                ? `${format(new Date(startStr), "MMM d")} - ${format(new Date(endStr), "MMM d, yyyy")}`
                : format(selectedDate, "MMMM yyyy")

        printWindow.document.write(`<!DOCTYPE html><html><head><title>Report - ${exportData.name}</title>
            <style>@media print{body{-webkit-print-color-adjust:exact}}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:40px;max-width:800px;margin:0 auto}
            h1{color:#1f2937;border-bottom:3px solid #3b82f6;padding-bottom:10px}h2{color:#374151;margin-top:30px}
            .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin:20px 0}.stat-card{background:linear-gradient(135deg,#f3f4f6,#e5e7eb);padding:20px;border-radius:12px;text-align:center}
            .stat-value{font-size:32px;font-weight:bold;color:#3b82f6}.stat-label{font-size:14px;color:#6b7280;margin-top:5px}
            .footer{margin-top:40px;padding-top:20px;border-top:1px solid #ddd;color:#6b7280;font-size:12px;text-align:center}</style></head>
            <body><h1>📊 Employee Activity Report</h1>
            <p><strong>Employee:</strong> ${exportData.name}</p>
            <p><strong>Period:</strong> ${periodLabel} (${viewMode})</p>
            <p><strong>Generated:</strong> ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</p>
            <h2>📈 Summary</h2>
            <div class="summary">
                <div class="stat-card"><div class="stat-value">${exportData.totalHours}h</div><div class="stat-label">Total Hours</div></div>
                <div class="stat-card"><div class="stat-value">${exportData.sessionCount}</div><div class="stat-label">Sessions</div></div>
                <div class="stat-card"><div class="stat-value">${exportData.topApp || 'N/A'}</div><div class="stat-label">Top App</div></div>
            </div>
            <div class="footer"><p>Generated by Employee Monitor Dashboard</p></div></body></html>`)

        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => printWindow.print(), 500)
    }

    return (
        <div className="flex min-h-screen bg-background">
            <aside className="w-64 hidden md:block fixed inset-y-0 z-50"><Sidebar /></aside>
            <main className="flex-1 md:pl-64 flex flex-col">
                <Header />
                <div className="flex-1 space-y-4 p-8 pt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight">Work Analysis</h2>
                            {isViewingToday && (
                                <p className="text-sm text-green-600 mt-1">🔴 Live data (auto-refreshes every 30s)</p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={fetchAnalysis} disabled={loading}>
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            <Button variant="secondary" onClick={syncToday} disabled={syncing}>
                                {syncing ? 'Syncing...' : 'Sync to DB'}
                            </Button>
                        </div>
                    </div>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex gap-2">
                                    {(["daily", "weekly", "monthly"] as ViewMode[]).map((mode) => (
                                        <Button key={mode} variant={viewMode === mode ? "default" : "outline"}
                                            onClick={() => setViewMode(mode)} className="capitalize">{mode}</Button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" onClick={() => navigatePeriod("prev")}>←</Button>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="min-w-[200px]">
                                                <CalendarIcon className="mr-2 h-4 w-4" />{formatDateRange()}
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
                                    <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{employeeStats.length}</div>
                                    <p className="text-xs text-muted-foreground">for this period</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{employeeStats.reduce((s, e) => s + e.totalHours, 0).toFixed(1)}h</div>
                                    <p className="text-xs text-muted-foreground">across all employees</p>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>
                                Employee Work Analysis
                                {isViewingToday ? ' (Live from activity_logs)' : ' (from daily_summary)'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (<div className="text-center py-8 text-muted-foreground">Loading...</div>
                            ) : employeeStats.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No activity data for this period.
                                </div>
                            ) : (
                                <div className="relative overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs uppercase bg-muted/50">
                                            <tr>
                                                <th className="px-4 py-3">Rank</th>
                                                <th className="px-4 py-3">Employee</th>
                                                <th className="px-4 py-3">Total Hours</th>
                                                <th className="px-4 py-3">Sessions</th>
                                                <th className="px-4 py-3">Top App</th>
                                                <th className="px-4 py-3">Report</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {employeeStats.map((emp, index) => (
                                                <tr key={emp.id} className="border-b hover:bg-muted/25">
                                                    <td className="px-4 py-4">
                                                        {index === 0 && "🥇"}{index === 1 && "🥈"}{index === 2 && "🥉"}
                                                        {index > 2 && <span className="text-muted-foreground">#{index + 1}</span>}
                                                    </td>
                                                    <td className="px-4 py-4 font-medium">{emp.name}</td>
                                                    <td className="px-4 py-4"><span className="font-bold text-lg">{emp.totalHours}h</span></td>
                                                    <td className="px-4 py-4 text-muted-foreground">{emp.sessionCount}</td>
                                                    <td className="px-4 py-4 text-muted-foreground truncate max-w-[120px]" title={emp.topApp}>{emp.topApp || '-'}</td>
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

            <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Report - {exportData?.name}</DialogTitle>
                        <DialogDescription>{viewMode.toUpperCase()} report for {formatDateRange()}</DialogDescription>
                    </DialogHeader>
                    {exportData && (
                        <div ref={printRef} className="space-y-4">
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
                                    <div className="text-lg font-bold truncate">{exportData.topApp || '-'}</div>
                                    <div className="text-sm text-muted-foreground">Top App</div>
                                </div>
                            </div>
                            <Button onClick={printReport} className="w-full mt-4" size="lg">
                                <Printer className="h-4 w-4 mr-2" /> Print / Save as PDF
                            </Button>
                            <p className="text-xs text-center text-muted-foreground">Use "Save as PDF" in print dialog</p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
