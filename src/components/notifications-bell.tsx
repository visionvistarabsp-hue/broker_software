"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { markReadAction, markAllReadAction } from "@/lib/actions/productivity";

interface Item { id: string; title: string; body: string | null; createdAt: Date | string; linkHref: string | null; }

export function NotificationsBell({ initialUnread, recent }: { initialUnread: number; recent: Item[] }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="relative" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="list-none cursor-pointer relative rounded-lg p-2 hover:bg-slate-100" aria-label={`Notifications, ${initialUnread} unread`}>
        <Bell className="h-5 w-5 text-slate-600" />
        {initialUnread > 0 && (<span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{initialUnread > 99 ? "99+" : initialUnread}</span>)}
      </summary>
      <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border bg-white shadow-lg z-50">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          <form action={markAllReadAction}><button type="submit" className="text-xs text-indigo-600 hover:underline">Mark all read</button></form>
        </div>
        <div className="max-h-80 overflow-auto divide-y">
          {recent.length === 0 ? (<p className="px-4 py-8 text-center text-sm text-slate-500">No notifications.</p>) :
          recent.map((n) => (
            <div key={n.id} className="px-4 py-3 text-sm flex gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{n.title}</p>
                {n.body && <p className="text-xs text-slate-500 line-clamp-2">{n.body}</p>}
                <p className="text-[11px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</p>
              </div>
              <form action={markReadAction.bind(null, n.id)}><button type="submit" className="text-xs text-indigo-600 hover:underline shrink-0">Read</button></form>
            </div>))}
        </div>
        <p className="px-4 py-2 text-[11px] text-slate-400 border-t">Auto-refreshes on navigation.</p>
      </div>
    </details>
  );
}
