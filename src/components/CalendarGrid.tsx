"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { taskHref } from "@/lib/taskBoard";

type CalTask = {
  id: string;
  title: string;
  dueDate: string; // ISO
  client: { name: string } | null;
  status: string;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarGrid({ tasks }: { tasks: CalTask[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  const tasksByDay = useMemo(() => {
    const map: Record<number, CalTask[]> = {};
    for (const t of tasks) {
      const d = new Date(t.dueDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        (map[day] ??= []).push(t);
      }
    }
    return map;
  }, [tasks, year, month]);

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); } else { setMonth((m) => m - 1); }
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); } else { setMonth((m) => m + 1); }
  }

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div className="border border-line rounded-xl bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="text-sm text-gray-500 px-2">←</button>
        <div className="font-bold text-sm">{MONTH_NAMES[month]} {year}</div>
        <button onClick={nextMonth} className="text-sm text-gray-500 px-2">→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs text-gray-400 mb-1">
        {WEEKDAYS.map((d) => <div key={d} className="text-center py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => (
          <div
            key={idx}
            className={`min-h-[70px] border rounded-md p-1 text-xs ${
              day && isToday(day) ? "border-accent bg-accent-light" : "border-line"
            }`}
          >
            {day && (
              <>
                <div className="font-medium mb-1">{day}</div>
                <div className="space-y-0.5">
                  {(tasksByDay[day] ?? []).slice(0, 3).map((t) => (
                    <Link
                      key={t.id}
                      href={taskHref(t.id)}
                      title={`${t.title} — ${t.client?.name ?? ""}`}
                      className={`block truncate rounded px-1 hover:underline ${
                        t.status === "DONE" ? "bg-green-100 text-green-800" : "bg-paper-dim text-charcoal"
                      }`}
                    >
                      {t.title}
                    </Link>
                  ))}
                  {(tasksByDay[day]?.length ?? 0) > 3 && (
                    <div className="text-gray-400">+{(tasksByDay[day]?.length ?? 0) - 3} more</div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
