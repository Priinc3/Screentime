"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DataPoint {
    name: string
    value: number
    [key: string]: any
}

interface AppUsagePieChartProps {
    data: DataPoint[]
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function AppUsagePieChart({ data }: AppUsagePieChartProps) {
    return (
        <Card className="col-span-3">
            <CardHeader>
                <CardTitle>Top Applications</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                            itemStyle={{ color: 'var(--foreground)' }}
                            formatter={(value: number, name: string) => [`${value}h`, name]}
                        />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
