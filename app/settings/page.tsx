"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/client"
import { Sidebar } from "@/components/Sidebar"
import { Header } from "@/components/Header"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Trash2 } from "lucide-react"

interface Employee {
    id: string
    full_name: string
    email: string
    department: string
    created_at: string
}

export default function SettingsPage() {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const supabase = createClient()

    useEffect(() => {
        fetchEmployees()
    }, [])

    const fetchEmployees = async () => {
        setLoading(true)
        const { data } = await supabase.from('employees').select('*').order('created_at', { ascending: false })
        if (data) setEmployees(data)
        setLoading(false)
    }

    const handleDelete = async () => {
        if (password !== "JOY123") {
            setError("Incorrect password")
            return
        }

        if (deleteId) {
            const { error } = await supabase.from('employees').delete().eq('id', deleteId)
            if (error) {
                setError(error.message)
            } else {
                setEmployees(employees.filter(e => e.id !== deleteId))
                setDeleteId(null)
                setPassword("")
                setError("")
            }
        }
    }

    return (
        <div className="flex min-h-screen bg-background">
            <aside className="w-64 hidden md:block fixed inset-y-0 z-50">
                <Sidebar />
            </aside>
            <main className="flex-1 md:pl-64 flex flex-col">
                <Header />
                <div className="flex-1 space-y-8 p-8 pt-6">
                    <h2 className="text-3xl font-bold tracking-tight">Settings</h2>

                    {/* Appearance */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Appearance</CardTitle>
                            <CardDescription>Customize the look and feel of the dashboard.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label>Theme</Label>
                                <p className="text-sm text-muted-foreground">Select your preferred theme.</p>
                            </div>
                            <ThemeToggle />
                        </CardContent>
                    </Card>

                    {/* Employee Management */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Employee Management</CardTitle>
                            <CardDescription>Manage registered employees. Deleting an employee requires admin password.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {employees.map((employee) => (
                                        <TableRow key={employee.id}>
                                            <TableCell className="font-medium">{employee.full_name}</TableCell>
                                            <TableCell>{employee.email}</TableCell>
                                            <TableCell>{employee.department}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => setDeleteId(employee.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {employees.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground">No employees found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Delete Confirmation Dialog */}
                    <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Confirm Deletion</DialogTitle>
                                <DialogDescription>
                                    Are you sure you want to delete this employee? This action cannot be undone.
                                    Please enter the admin password to confirm.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="password" className="text-right">
                                        Password
                                    </Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="col-span-3"
                                    />
                                </div>
                                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
                                <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </main>
        </div>
    )
}
