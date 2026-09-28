"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export function DailyChart({ data }: { data: { day: string; envoyes: number; reponses: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="day" fontSize={12} />
        <YAxis fontSize={12} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="envoyes" fill="#6366f1" radius={[4, 4, 0, 0]} name="Emails envoyés" />
        <Bar dataKey="reponses" fill="#22c55e" radius={[4, 4, 0, 0]} name="Réponses" />
      </BarChart>
    </ResponsiveContainer>
  );
}
