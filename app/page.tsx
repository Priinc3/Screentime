"use client"

import { createClient } from "@/utils/supabase/client"
import { capDuration, getExcludedUserIds } from "@/utils/dataFilters"
import { Sidebar } from "@/components/Sidebar"
import { Header } from "@/components/Header"
import { RecentActivity } from "@/components/RecentActivity"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Users, Clock } from "lucide-react"
import { useEffect, useState } from "react"

import { DailyActivityChart } from "@/components/charts/DailyActivityChart"
import { TopAppsBarChart } from "@/components/charts/TopAppsBarChart"

export default function Home() {
  const [stats, setStats] = useState({
    activeEmployees: 0,
    totalActiveTime: "0h 0m",
    topApp: "Loading...",
    topAppUsage: ""
  })
  const [dailyActivityData, setDailyActivityData] = useState<{ date: string; hours: number }[]>([])
  const [topAppsData, setTopAppsData] = useState<{ name: string; hours: number }[]>([])
  const supabase = createClient()

  useEffect(() => {
    const fetchStats = async () => {
      // STEP 1: Fetch ALL valid employees from employees table
      const { data: employees } = await supabase
        .from('employees')
        .select('id, full_name')

      // Create a Set of valid employee IDs (only those in employees table)
      const validEmployeeIds = new Set<string>()
      if (employees) {
        employees.forEach(emp => validEmployeeIds.add(emp.id))
      }

      // Get excluded user IDs from settings
      const excludedIds = getExcludedUserIds()

      // STEP 2: Active Employees (only count non-excluded)
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data: activeEmps } = await supabase
        .from('employees')
        .select('id')
        .gte('last_heartbeat', fiveMinsAgo)

      const activeCount = activeEmps?.filter(e => !excludedIds.includes(e.id)).length || 0

      // STEP 3: Fetch ALL activity logs
      const { data: rawLogs } = await supabase
        .from('activity_logs')
        .select('employee_id, duration_seconds, app_name, start_time')

      // STEP 4: Apply STRICT filtering
      // - Only include if employee exists in employees table
      // - Exclude if employee ID is in excluded list
      const filteredLogs = (rawLogs || []).filter(log => {
        // Must exist in employees table
        if (!validEmployeeIds.has(log.employee_id)) return false
        // Must not be excluded
        if (excludedIds.includes(log.employee_id)) return false
        return true
      })

      // Helper to get LOCAL date key (YYYY-MM-DD)
      const getLocalDateKey = (date: Date) => {
        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, '0')
        const d = String(date.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
      }

      let totalSeconds = 0
      const appMap = new Map<string, number>()
      const dateMap = new Map<string, number>()

      filteredLogs.forEach(log => {
        // Cap duration to prevent inflated times (max 2 hours per activity)
        const cappedDuration = capDuration(log.duration_seconds)
        totalSeconds += cappedDuration

        // App Stats
        const currentApp = appMap.get(log.app_name) || 0
        appMap.set(log.app_name, currentApp + cappedDuration)

        // Daily Stats - use LOCAL date for grouping
        const logDate = new Date(log.start_time)
        const dateKey = getLocalDateKey(logDate)
        const currentDate = dateMap.get(dateKey) || 0
        dateMap.set(dateKey, currentDate + cappedDuration)
      })

      // STEP 5: Daily Activity Chart Data (Last 7 Days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - i)
        return getLocalDateKey(d)
      }).reverse()

      const dailyData = last7Days.map(dateKey => {
        const [, month, day] = dateKey.split('-')
        return {
          date: `${month}/${day}`,
          hours: Math.round(((dateMap.get(dateKey) || 0) / 3600) * 10) / 10
        }
      })
      setDailyActivityData(dailyData)

      // STEP 6: Global Top Apps Chart
      const sortedApps = Array.from(appMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, seconds]) => ({
          name,
          hours: Math.round((seconds / 3600) * 10) / 10
        }))
      setTopAppsData(sortedApps)

      // STEP 7: Calculate Stats Details
      let topApp = "None"
      let topAppSeconds = 0
      if (sortedApps.length > 0) {
        topApp = sortedApps[0].name
        topAppSeconds = appMap.get(topApp) || 0
      }

      const h = Math.floor(totalSeconds / 3600)
      const m = Math.floor((totalSeconds % 3600) / 60)

      setStats({
        activeEmployees: activeCount,
        totalActiveTime: `${h}h ${m}m`,
        topApp: topApp,
        topAppUsage: topAppSeconds > 0 ? `${Math.floor(topAppSeconds / 60)}m` : ""
      })
    }

    fetchStats()
    const interval = setInterval(fetchStats, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 hidden md:block fixed inset-y-0 z-50">
        <Sidebar />
      </aside>
      <main className="flex-1 md:pl-64 flex flex-col">
        <Header />
        <div className="flex-1 space-y-4 p-8 pt-6">
          <div className="flex items-center justify-between space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeEmployees}</div>
                <p className="text-xs text-muted-foreground">Online now</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Active Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalActiveTime}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Top App</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold truncate" title={stats.topApp}>{stats.topApp}</div>
                <p className="text-xs text-muted-foreground">{stats.topAppUsage} usage</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <DailyActivityChart data={dailyActivityData} />
            <TopAppsBarChart data={topAppsData} />
          </div>

          {/* Recent Activity */}
          <div className="grid gap-4 md:grid-cols-1">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <RecentActivity />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
