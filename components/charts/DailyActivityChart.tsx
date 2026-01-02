"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DataPoint {
    date: string
    hours: number
}

interface DailyActivityChartProps {
    data: DataPoint[]
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE', '#00C49F', '#FFBB28'];

export function DailyActivityChart({ data }: DailyActivityChartProps) {
    return (
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>Daily Activity (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={data} margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
                        <XAxis
                            dataKey="date"
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value}h`}
                        />
                        <Tooltip
                            cursor={{ fill: 'var(--muted)' }}
                            contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                            itemStyle={{ color: 'var(--foreground)' }}
                            formatter={(value: number) => [`${value}h`, "Hours"]}
                        />
                        <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
