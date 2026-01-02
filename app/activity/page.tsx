import { Sidebar } from "@/components/Sidebar"
import { Header } from "@/components/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RecentActivity } from "@/components/RecentActivity"

export default function ActivityPage() {
    return (
        <div className="flex min-h-screen bg-background">
            <aside className="w-64 hidden md:block fixed inset-y-0 z-50">
                <Sidebar />
            </aside>
            <main className="flex-1 md:pl-64 flex flex-col">
                <Header />
                <div className="flex-1 space-y-4 p-8 pt-6">
                    <div className="flex items-center justify-between space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight">Live Activity</h2>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Real-time Logs</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <RecentActivity />
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    )
}
