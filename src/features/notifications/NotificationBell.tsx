import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useNotifications } from "./useNotifications";

export function NotificationBell({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const { items, unread, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const color = tone === "light" ? "text-white/70 hover:text-white" : "text-muted-foreground hover:text-foreground";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Benachrichtigungen"
        onClick={() => { setOpen((v) => !v); if (!open && unread > 0) void markAllRead(); }}
        className={`relative flex h-8 w-8 items-center justify-center ${color}`}
      >
        <Bell className="h-4 w-4" strokeWidth={1.4} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.55rem] font-medium text-accent-foreground">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-[0.62rem] uppercase tracking-[0.32em] text-muted-foreground">Meldungen</p>
            <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{items.length}</span>
          </div>
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">Noch keine Meldungen.</li>
            )}
            {items.map((n) => {
              const Body = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[0.85rem] font-medium">{n.title}</p>
                    {!n.read_at && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                  </div>
                  {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("de-DE")}
                  </p>
                </>
              );
              return (
                <li key={n.id} className="px-4 py-3 hover:bg-muted/40">
                  {n.link
                    ? <Link to={n.link} onClick={() => setOpen(false)} className="block">{Body}</Link>
                    : Body}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
