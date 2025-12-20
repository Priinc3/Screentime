import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This API seeds sample daily_summary data for testing
// Also aggregates existing activity_logs for the last 30 days

export async function POST() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        // 1. Get all employees
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('id, full_name')

        if (empError) throw empError
        if (!employees || employees.length === 0) {
            return NextResponse.json({ error: 'No employees found' }, { status: 400 })
        }

        const results: any[] = []
        const MAX_DURATION = 7200 // 2hr cap

        // 2. For each day in the last 30 days, aggregate existing activity_logs
        for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
            const date = new Date()
            date.setDate(date.getDate() - daysAgo)
            // Use local date format
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            const dateStr = `${year}-${month}-${day}`
            // Use IST timezone offset (+05:30) for correct date filtering
            const startOfDay = `${dateStr}T00:00:00+05:30`
            const endOfDay = `${dateStr}T23:59:59+05:30`

            for (const emp of employees) {
                // Fetch logs for this day
                const { data: logs } = await supabase
                    .from('activity_logs')
                    .select('duration_seconds, start_time, end_time, app_name')
                    .eq('employee_id', emp.id)
                    .gte('start_time', startOfDay)
                    .lte('start_time', endOfDay)

                if (!logs || logs.length === 0) continue

                // Aggregate
                let totalSeconds = 0
                let firstActivityTime: string | null = null
                let lastActivityTime: string | null = null
                const appMap = new Map<string, number>()

                for (const log of logs) {
                    // IGNORE activities over 2 hours completely (not cap)
                    const duration = log.duration_seconds || 0
                    if (duration > MAX_DURATION) continue // Skip this log entirely
                    totalSeconds += duration

                    const logStartStr = log.start_time
                    const logEndStr = log.end_time || log.start_time

                    if (!firstActivityTime || logStartStr < firstActivityTime) firstActivityTime = logStartStr
                    if (!lastActivityTime || logEndStr > lastActivityTime) lastActivityTime = logEndStr

                    if (log.app_name) {
                        appMap.set(log.app_name, (appMap.get(log.app_name) || 0) + duration)
                    }
                }

                // Find top app
                let topApp = ''
                let topAppSeconds = 0
                for (const [app, seconds] of appMap.entries()) {
                    if (seconds > topAppSeconds) {
                        topApp = app
                        topAppSeconds = seconds
                    }
                }

                // Upsert
                const { error: upsertError } = await supabase
                    .from('daily_summary')
                    .upsert({
                        employee_id: emp.id,
                        date: dateStr,
                        total_seconds: totalSeconds,
                        session_count: logs.length,
                        first_activity: firstActivityTime,
                        last_activity: lastActivityTime,
                        top_app: topApp,
                        top_app_seconds: topAppSeconds,
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'employee_id,date'
                    })

                if (!upsertError) {
                    results.push({
                        employee: emp.full_name,
                        date: dateStr,
                        hours: Math.round((totalSeconds / 3600) * 100) / 100
                    })
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Aggregated activity_logs for last 30 days',
            recordsCreated: results.length,
            samples: results.slice(0, 10)
        })

    } catch (error: any) {
        console.error('Seed error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function GET() {
    return POST()
}
