import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  tone?: "light" | "dark";
  className?: string;
}

export function StatCard({ label, value, delta, trend = "neutral", tone = "light", className }: StatCardProps) {
  const isDark = tone === "dark";
  return (
    <div
      className={cn(
        "border p-6",
        isDark
          ? "border-sidebar-border bg-sidebar-accent text-sidebar-foreground"
          : "border-border bg-card text-foreground",
        className,
      )}
    >
      <p
        className={cn(
          "text-[0.7rem] uppercase tracking-[0.28em]",
          isDark ? "text-sidebar-foreground/60" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p className="mt-3 font-serif text-3xl">{value}</p>
      {delta && (
        <p
          className={cn(
            "mt-2 text-xs",
            trend === "up" && "text-emerald-600",
            trend === "down" && "text-destructive",
            trend === "neutral" && (isDark ? "text-sidebar-foreground/60" : "text-muted-foreground"),
          )}
        >
          {delta}
        </p>
      )}
    </div>
  );
}
