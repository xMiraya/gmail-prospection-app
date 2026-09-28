"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export function DashboardChart({ data }: { data: { day: string; envoyes: number; reponses: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ left: -20, right: 10, top: 10 }}>
        <defs>
          <linearGradient id="fillEnvoyes" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fillReponses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.35} />
            <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
        <YAxis fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Area type="monotone" dataKey="envoyes" name="Emails envoyés" stroke="hsl(var(--chart-1))" fill="url(#fillEnvoyes)" strokeWidth={2} />
        <Area type="monotone" dataKey="reponses" name="Réponses" stroke="hsl(var(--chart-2))" fill="url(#fillReponses)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
