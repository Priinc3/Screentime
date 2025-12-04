"use client"

import { createClient } from "@/utils/supabase/client"
import { Sidebar } from "@/components/Sidebar"
import { Header } from "@/components/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface Employee {
    id: string
    full_name: string
    email: string
    department: string
    created_at: string
    last_heartbeat?: string
}

export default function EmployeesPage() {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(false)
    const supabase = createClient()
    const router = useRouter()

    const fetchEmployees = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('employees')
            .select('*')
            .order('created_at', { ascending: false })

        if (data) setEmployees(data)
        setLoading(false)
    }

    useEffect(() => {
        fetchEmployees()

        // Realtime subscription
        const channel = supabase
            .channel('employees_realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'employees' }, (payload) => {
                setEmployees((current) => [payload.new as Employee, ...current])
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'employees' }, (payload) => {
                setEmployees((current) => current.map(e => e.id === payload.new.id ? payload.new as Employee : e))
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const isOnline = (lastHeartbeat?: string) => {
        if (!lastHeartbeat) return false
        const diff = new Date().getTime() - new Date(lastHeartbeat).getTime()
        return diff < 2 * 60 * 1000 // 2 minutes
    }

    return (
        <div className="flex min-h-screen bg-background">
            <aside className="w-64 hidden md:block fixed inset-y-0 z-50">
                <Sidebar />
            </aside>
            <main className="flex-1 md:pl-64 flex flex-col">
                <Header />
                <div className="flex-1 space-y-4 p-8 pt-6">
                    <div className="flex items-center justify-between space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight">Employees</h2>
                        <Button variant="outline" size="sm" onClick={fetchEmployees} disabled={loading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle>All Employees</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px]">Avatar</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead className="text-right">Joined</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {employees.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                                                No employees found. Run the agent installer to add one!
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        employees.map((employee) => (
                                            <TableRow
                                                key={employee.id}
                                                className="cursor-pointer hover:bg-muted/50"
                                                onClick={() => router.push(`/employees/${employee.id}`)}
                                            >
                                                <TableCell>
                                                    <Avatar>
                                                        <AvatarImage src={`https://avatar.vercel.sh/${employee.id}`} />
                                                        <AvatarFallback>{employee.full_name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                </TableCell>
                                                <TableCell className="font-medium">{employee.full_name}</TableCell>
                                                <TableCell>
                                                    {isOnline(employee.last_heartbeat) ? (
                                                        <div className="flex items-center text-green-600 text-xs font-medium">
                                                            <div className="h-2 w-2 rounded-full bg-green-600 mr-2" />
                                                            Online
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center text-muted-foreground text-xs">
                                                            <div className="h-2 w-2 rounded-full bg-gray-300 mr-2" />
                                                            Offline
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>{employee.email}</TableCell>
                                                <TableCell>{employee.department}</TableCell>
                                                <TableCell className="text-right">
                                                    {new Date(employee.created_at).toLocaleDateString()}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    )
}
