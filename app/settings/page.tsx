"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/client"
import { getExcludedUserIds, saveExcludedUserIds, addExcludedUserId, removeExcludedUserId, MAX_ACTIVITY_DURATION_SECONDS } from "@/utils/dataFilters"
import { Sidebar } from "@/components/Sidebar"
import { Header } from "@/components/Header"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Trash2, Plus, Ban, AlertTriangle, RefreshCw } from "lucide-react"

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

    // Excluded users state
    const [excludedIds, setExcludedIds] = useState<string[]>([])
    const [newExcludeId, setNewExcludeId] = useState("")
    const [excludeError, setExcludeError] = useState("")

    const supabase = createClient()

    useEffect(() => {
        fetchEmployees()
        // Load excluded IDs from localStorage
        setExcludedIds(getExcludedUserIds())
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

    // Add user to excluded list
    const handleAddExclude = () => {
        const trimmedId = newExcludeId.trim()
        if (!trimmedId) {
            setExcludeError("Please enter a user ID")
            return
        }
        if (excludedIds.includes(trimmedId)) {
            setExcludeError("This ID is already excluded")
            return
        }

        addExcludedUserId(trimmedId)
        setExcludedIds(getExcludedUserIds())
        setNewExcludeId("")
        setExcludeError("")
    }

    // Remove user from excluded list
    const handleRemoveExclude = (id: string) => {
        removeExcludedUserId(id)
        setExcludedIds(getExcludedUserIds())
    }

    // Quick exclude from employee table
    const handleQuickExclude = (employeeId: string) => {
        addExcludedUserId(employeeId)
        setExcludedIds(getExcludedUserIds())
    }

    // Find employee name by ID
    const getEmployeeName = (id: string) => {
        const emp = employees.find(e => e.id === id)
        return emp ? emp.full_name : null
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

                    {/* Data Filtering Info */}
                    <Card className="border-yellow-500/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                Activity Data Filtering
                            </CardTitle>
                            <CardDescription>
                                To prevent inflated screen time from background apps, the dashboard automatically filters data.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm">
                                <p>• <strong>Max activity duration:</strong> {MAX_ACTIVITY_DURATION_SECONDS / 3600} hours per session (activities longer than this are capped)</p>
                                <p>• <strong>Employee validation:</strong> Only employees that exist in the employees table are shown</p>
                                <p>• <strong>Excluded users:</strong> {excludedIds.length} user(s) are being ignored</p>
                                <p className="text-muted-foreground mt-4">
                                    These filters are applied across Dashboard, Analysis, Recent Activity, and all charts automatically.
                                </p>
                                <div className="pt-4">
                                    <Button variant="outline" onClick={() => window.location.reload()}>
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Refresh to Apply Changes
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Excluded Users */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Ban className="h-5 w-5" />
                                Excluded Users
                            </CardTitle>
                            <CardDescription>
                                Enter user IDs to exclude from all reports and analytics.
                                Activity from these users will be completely ignored.
                                <strong className="block mt-2">After adding/removing users, refresh the page to apply changes.</strong>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Add new excluded ID */}
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Enter User ID (UUID)"
                                    value={newExcludeId}
                                    onChange={(e) => setNewExcludeId(e.target.value)}
                                    className="flex-1"
                                />
                                <Button onClick={handleAddExclude}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Exclude
                                </Button>
                            </div>
                            {excludeError && <p className="text-red-500 text-sm">{excludeError}</p>}

                            {/* List of excluded IDs */}
                            {excludedIds.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>User ID</TableHead>
                                            <TableHead>Name (if known)</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {excludedIds.map((id) => (
                                            <TableRow key={id}>
                                                <TableCell className="font-mono text-xs">{id}</TableCell>
                                                <TableCell>{getEmployeeName(id) || <span className="text-muted-foreground">Unknown</span>}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleRemoveExclude(id)}
                                                    >
                                                        Remove
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-center text-muted-foreground py-4">No users excluded</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Employee Management */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Employee Management</CardTitle>
                            <CardDescription>Manage registered employees. Deleting an employee requires admin password. Use the 🚫 button to quickly exclude a user from reports.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead>ID</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {employees.map((employee) => (
                                        <TableRow key={employee.id} className={excludedIds.includes(employee.id) ? "opacity-50 bg-muted/30" : ""}>
                                            <TableCell className="font-medium">
                                                {employee.full_name}
                                                {excludedIds.includes(employee.id) && (
                                                    <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-600 px-2 py-0.5 rounded">Excluded</span>
                                                )}
                                            </TableCell>
                                            <TableCell>{employee.email}</TableCell>
                                            <TableCell>{employee.department}</TableCell>
                                            <TableCell className="font-mono text-xs">{employee.id.slice(0, 8)}...</TableCell>
                                            <TableCell className="text-right space-x-2">
                                                {!excludedIds.includes(employee.id) ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleQuickExclude(employee.id)}
                                                        title="Exclude from reports"
                                                    >
                                                        <Ban className="h-4 w-4" />
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleRemoveExclude(employee.id)}
                                                        title="Include in reports"
                                                    >
                                                        Include
                                                    </Button>
                                                )}
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
                                            <TableCell colSpan={5} className="text-center text-muted-foreground">No employees found.</TableCell>
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
