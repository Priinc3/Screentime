"use client"

import { createClient } from "@/utils/supabase/client"
import { Sidebar } from "@/components/Sidebar"
import { Header } from "@/components/Header"
import { RecentActivity } from "@/components/RecentActivity"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Users, Clock } from "lucide-react"
import { useEffect, useState } from "react"

import { ActivityTrendChart } from "@/components/charts/ActivityTrendChart"
import { DepartmentPieChart } from "@/components/charts/DepartmentPieChart"

export default function Home() {
  const [stats, setStats] = useState({
    activeEmployees: 0,
    totalActiveTime: "0h 0m",
    topApp: "Loading...",
    topAppUsage: ""
  })
  const [trendData, setTrendData] = useState<{ date: string; hours: number }[]>([])
  const [deptData, setDeptData] = useState<{ name: string; value: number }[]>([])
  const supabase = createClient()

  useEffect(() => {
    const fetchStats = async () => {
      // 1. Active Employees
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { count: activeCount } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .gte('last_heartbeat', fiveMinsAgo)

      // 2. Total Active Time & Top App
      const { data: logs } = await supabase
        .from('activity_logs')
        .select('duration_seconds, app_name, start_time')

      let totalSeconds = 0
      const appMap = new Map<string, number>()
      const dateMap = new Map<string, number>()

      if (logs) {
        logs.forEach(log => {
          totalSeconds += log.duration_seconds
          const current = appMap.get(log.app_name) || 0
          appMap.set(log.app_name, current + log.duration_seconds)

          // Trend Data (Last 7 days)
          const date = new Date(log.start_time).toLocaleDateString()
          const currentDate = dateMap.get(date) || 0
          dateMap.set(date, currentDate + log.duration_seconds)
        })
      }

      // Process Trend Data
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - i)
        return d.toLocaleDateString()
      }).reverse()

      const trend = last7Days.map(date => ({
        date: date.slice(0, 5), // MM/DD
        hours: Math.round(((dateMap.get(date) || 0) / 3600) * 10) / 10
      }))
      setTrendData(trend)

      // 3. Top App Calculation
      let topApp = "None"
      let topAppSeconds = 0
      appMap.forEach((seconds, app) => {
        if (seconds > topAppSeconds) {
          topAppSeconds = seconds
          topApp = app
        }
      })

      // 4. Department Distribution
      const { data: employees } = await supabase.from('employees').select('department')
      const deptMap = new Map<string, number>()
      if (employees) {
        employees.forEach(e => {
          const dept = e.department || "Unknown"
          deptMap.set(dept, (deptMap.get(dept) || 0) + 1)
        })
      }
      const deptChartData = Array.from(deptMap.entries()).map(([name, value]) => ({ name, value }))
      setDeptData(deptChartData)

      // Format Time
      const h = Math.floor(totalSeconds / 3600)
      const m = Math.floor((totalSeconds % 3600) / 60)

      setStats({
        activeEmployees: activeCount || 0,
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
            <ActivityTrendChart data={trendData} />
            <DepartmentPieChart data={deptData} />
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
