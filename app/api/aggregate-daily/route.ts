import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This API route aggregates activity_logs into daily_summary
// Call this at 11:59 PM daily via cron service (e.g., Vercel Cron, GitHub Actions, external cron)

const MAX_DURATION_SECONDS = 7200 // 2 hour cap per activity

export async function POST(request: Request) {
    try {
        // Get date from request body, or use today
        const body = await request.json().catch(() => ({}))
        const targetDate = body.date || new Date().toISOString().split('T')[0]

        // Create Supabase client with service role for write access
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
            return NextResponse.json({ message: 'No employees found' }, { status: 200 })
        }

        // 2. For each employee, aggregate their activity_logs for the target date
        const results = []

        for (const emp of employees) {
            // Fetch all activity logs for this employee on target date
            const startOfDay = `${targetDate}T00:00:00.000Z`
            const endOfDay = `${targetDate}T23:59:59.999Z`

            const { data: logs, error: logError } = await supabase
                .from('activity_logs')
                .select('duration_seconds, start_time, end_time, app_name')
                .eq('employee_id', emp.id)
                .gte('start_time', startOfDay)
                .lte('start_time', endOfDay)

            if (logError) {
                console.error(`Error fetching logs for ${emp.id}:`, logError)
                continue
            }

            if (!logs || logs.length === 0) {
                // No activity for this employee on this date
                continue
            }

            // Aggregate with 2hr cap per activity
            let totalSeconds = 0
            let firstActivityTime: string | null = null
            let lastActivityTime: string | null = null
            const appMap = new Map<string, number>()

            for (const log of logs) {
                const cappedDuration = Math.min(log.duration_seconds || 0, MAX_DURATION_SECONDS)
                totalSeconds += cappedDuration

                const logStartStr = log.start_time
                const logEndStr = log.end_time || log.start_time

                if (!firstActivityTime || logStartStr < firstActivityTime) firstActivityTime = logStartStr
                if (!lastActivityTime || logEndStr > lastActivityTime) lastActivityTime = logEndStr

                if (log.app_name) {
                    appMap.set(log.app_name, (appMap.get(log.app_name) || 0) + cappedDuration)
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

            // Upsert into daily_summary
            const { error: upsertError } = await supabase
                .from('daily_summary')
                .upsert({
                    employee_id: emp.id,
                    date: targetDate,
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

            if (upsertError) {
                console.error(`Error upserting summary for ${emp.id}:`, upsertError)
            } else {
                results.push({
                    employee: emp.full_name,
                    date: targetDate,
                    totalHours: Math.round((totalSeconds / 3600) * 100) / 100,
                    sessions: logs.length
                })
            }
        }

        return NextResponse.json({
            success: true,
            date: targetDate,
            processed: results.length,
            results
        })

    } catch (error: any) {
        console.error('Aggregation error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// GET endpoint to trigger for today
export async function GET() {
    const today = new Date().toISOString().split('T')[0]
    const mockRequest = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ date: today })
    })
    return POST(mockRequest)
}
