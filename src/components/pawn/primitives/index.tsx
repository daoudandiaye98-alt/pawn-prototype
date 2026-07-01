/**
 * PAWN Primitive Library — one grammar for every surface.
 *
 * Rules:
 *  - Panel, not Card.
 *  - PageHeader / SectionHeader — one heading grammar.
 *  - Metric — one KPI shape (label · value · delta · rationale).
 *  - Timeline / Activity — one event stream shape.
 *  - Insight — one reasoning shape (cause → effect → confidence).
 *  - Recommendation — one suggestion shape (subject · rationale · action).
 *  - Command — the single-per-view oxblood decision.
 *  - Status — dot + label + tone.
 *  - IdentityChip — actor identity.
 *
 * These primitives compose against three surfaces: paper, ivory, bone, ink.
 * Never wrap them in shadows — hairlines only.
 */
import { forwardRef, type ReactNode, type HTMLAttributes, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { PawnMark } from "@/components/pawn/PawnMark";

/* ─────────────────────── Panel ─────────────────────── */

type Surface = "paper" | "ivory" | "bone" | "ink";
type Padding = "none" | "sm" | "md" | "lg";

const SURFACE: Record<Surface, string> = {
  paper: "bg-paper text-foreground",
  ivory: "bg-ivory text-foreground",
  bone:  "bg-bone text-foreground",
  ink:   "bg-ink text-primary-foreground",
};

const PAD: Record<Padding, string> = {
  none: "",
  sm:   "p-4 md:p-5",
  md:   "p-6 md:p-8",
  lg:   "p-8 md:p-10",
};

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  surface?: Surface;
  padding?: Padding;
  eyebrow?: string;
  title?: ReactNode;
  action?: ReactNode;
  headerBorder?: boolean;
  bare?: boolean;
}

export const Panel = forwardRef<HTMLElement, PanelProps>(function Panel(
  { surface = "paper", padding = "md", eyebrow, title, action, headerBorder = true, bare = false, className, children, ...rest },
  ref,
) {
  const isInk = surface === "ink";
  const border = bare
    ? ""
    : isInk
      ? "border border-white/[0.08]"
      : "border border-[hsl(var(--border-strong))]";
  return (
    <section
      ref={ref}
      className={cn("flex flex-col", SURFACE[surface], border, className)}
      {...rest}
    >
      {(eyebrow || title || action) && (
        <header
          className={cn(
            "flex items-baseline justify-between gap-4 px-5 py-3.5 md:px-6 md:py-4",
            headerBorder && (isInk ? "border-b border-white/[0.06]" : "border-b border-[hsl(var(--border))]"),
          )}
        >
          <div className="min-w-0">
            {eyebrow && (
              <p
                className={cn(
                  "t-eyebrow",
                  isInk && "text-[hsl(36_15%_58%)]",
                )}
              >
                {eyebrow}
              </p>
            )}
            {title && (
              <h3 className={cn("mt-1 t-display-sm", isInk && "text-[hsl(36_28%_94%)]")}>{title}</h3>
            )}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn(padding !== "none" && !title && !eyebrow ? PAD[padding] : padding !== "none" && (title || eyebrow) ? PAD[padding] : "", "flex-1")}>
        {children}
      </div>
    </section>
  );
});

/* ─────────────────────── PageHeader ─────────────────────── */

export function PageHeader({
  eyebrow,
  index,
  title,
  lede,
  action,
  align = "left",
  className,
}: {
  eyebrow?: string;
  index?: string;
  title: ReactNode;
  lede?: ReactNode;
  action?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  const centered = align === "center";
  return (
    <header className={cn("flex flex-col gap-6 md:flex-row md:items-end md:justify-between", centered && "md:flex-col md:items-center md:text-center", className)}>
      <div className={cn("max-w-3xl", centered && "mx-auto")}>
        {(eyebrow || index) && (
          <p className={cn("flex items-center gap-3 t-eyebrow", centered && "justify-center")}>
            {index && <span className="t-num text-[0.85rem] not-italic">{index}</span>}
            {index && <span className="inline-block h-px w-6 bg-current opacity-40" />}
            {eyebrow && <span>{eyebrow}</span>}
          </p>
        )}
        <h1 className="mt-4 t-display-lg">{title}</h1>
        {lede && <p className="mt-4 t-body-lg text-foreground/65 font-cormorant italic">{lede}</p>}
      </div>
      {action && <div className={cn("flex shrink-0 items-center gap-3", centered && "justify-center")}>{action}</div>}
    </header>
  );
}

/* ─────────────────────── SectionHeader ─────────────────────── */

export function SectionHeader({
  eyebrow,
  index,
  title,
  description,
  action,
  align = "left",
  className,
}: {
  eyebrow?: string;
  index?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  const centered = align === "center";
  return (
    <div className={cn("flex flex-col gap-6 md:flex-row md:items-end md:justify-between", centered && "md:flex-col md:items-center md:text-center", className)}>
      <div className={cn("max-w-2xl", centered && "mx-auto")}>
        {(eyebrow || index) && (
          <p className={cn("flex items-center gap-3 t-eyebrow", centered && "justify-center")}>
            {index && <span className="t-num text-[0.85rem] not-italic">{index}</span>}
            {index && <span className="inline-block h-px w-6 bg-current opacity-40" />}
            {eyebrow && <span>{eyebrow}</span>}
          </p>
        )}
        <h2 className="mt-3 t-display-md">{title}</h2>
        {description && <p className="mt-3 t-body-md text-foreground/70">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ─────────────────────── Metric ─────────────────────── */

export function Metric({
  label,
  value,
  delta,
  trend = "neutral",
  hint,
  rationale,
  surface = "paper",
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  hint?: string;
  rationale?: string[];
  surface?: Surface;
  className?: string;
}) {
  const isInk = surface === "ink";
  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between p-5 md:p-6 motion-micro",
        isInk ? "border border-white/[0.08] bg-[hsl(18_10%_6%)]" : "border border-[hsl(var(--border))] bg-card",
        className,
      )}
      title={hint}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={cn("t-eyebrow", isInk && "text-[hsl(36_15%_58%)]")}>{label}</p>
        {delta && (
          <span
            className={cn(
              "text-[0.65rem] tabular-nums",
              trend === "up" && "text-emerald-600 dark:text-emerald-300",
              trend === "down" && "text-destructive",
              trend === "neutral" && (isInk ? "text-[hsl(36_15%_55%)]" : "text-muted-foreground"),
            )}
          >
            {delta}
          </span>
        )}
      </div>
      <p className={cn("mt-4 t-display-md leading-none tabular-nums", isInk && "text-[hsl(36_28%_94%)]")}>{value}</p>
      {rationale && rationale.length > 0 && (
        <div className={cn(
          "pointer-events-none absolute inset-0 flex flex-col justify-end p-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          isInk
            ? "bg-gradient-to-t from-[hsl(18_10%_5%)] via-[hsl(18_10%_5%)]/95 to-transparent"
            : "bg-gradient-to-t from-card via-card/95 to-transparent",
        )}>
          <p className={cn("t-eyebrow", isInk && "text-[hsl(36_15%_58%)]")}>Warum</p>
          <ul className={cn("mt-2 space-y-1 text-[11px] leading-snug", isInk ? "text-[hsl(36_25%_86%)]" : "text-foreground/80")}>
            {rationale.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="mt-1.5 h-px w-2 shrink-0 bg-[hsl(var(--oxblood))]" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Timeline / Activity ─────────────────────── */

export interface TimelineStep {
  label: string;
  reached?: boolean;
  current?: boolean;
}

export function Timeline({ steps, className }: { steps: TimelineStep[]; className?: string }) {
  return (
    <ol className={cn("grid gap-2", `grid-cols-${steps.length}`, className)} style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))` }}>
      {steps.map((s) => (
        <li
          key={s.label}
          className={cn(
            "border-t-2 pt-3",
            s.current ? "border-[hsl(var(--oxblood))]" : s.reached ? "border-foreground" : "border-[hsl(var(--border-strong))]",
          )}
        >
          <p className={cn("t-eyebrow", s.reached ? "text-foreground" : "text-muted-foreground")}>
            {s.label}
          </p>
        </li>
      ))}
    </ol>
  );
}

export interface ActivityItem {
  id: string;
  actor: string;
  verb: string;
  object?: string;
  when: string;
  tone?: "positive" | "critical" | "warn" | "neutral";
  tag?: string;
}

export function ActivityList({
  items,
  surface = "paper",
  empty,
  className,
}: {
  items: ActivityItem[];
  surface?: Surface;
  empty?: ReactNode;
  className?: string;
}) {
  const isInk = surface === "ink";
  if (items.length === 0 && empty) return <div className="p-6">{empty}</div>;
  return (
    <ul className={cn(isInk ? "divide-y divide-white/[0.06]" : "divide-y divide-[hsl(var(--border))]", className)}>
      {items.map((e) => (
        <li key={e.id} className="flex items-start gap-3 px-5 py-3 md:px-6">
          <span
            className={cn(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border font-serif text-[10px]",
              e.tone === "positive" && "border-emerald-500/40 text-emerald-600 dark:text-emerald-300",
              e.tone === "critical" && "border-destructive/50 text-destructive",
              e.tone === "warn" && "border-amber-500/50 text-amber-600 dark:text-amber-200",
              (!e.tone || e.tone === "neutral") && (isInk ? "border-white/15 text-[hsl(36_20%_78%)]" : "border-[hsl(var(--border-strong))] text-foreground/70"),
            )}
          >
            ↳
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn("t-body-sm", isInk ? "text-[hsl(36_25%_86%)]" : "text-foreground/85")}>
              <span className={cn("font-medium", isInk ? "text-[hsl(36_28%_94%)]" : "text-foreground")}>{e.actor}</span>{" "}
              <span className={isInk ? "text-[hsl(36_18%_66%)]" : "text-foreground/60"}>{e.verb}</span>
              {e.object && <> <span className={isInk ? "text-[hsl(36_28%_94%)]" : "text-foreground"}>{e.object}</span></>}
            </p>
            <p className={cn("mt-0.5 text-[10px] uppercase tracking-[0.2em]", isInk ? "text-[hsl(36_15%_45%)]" : "text-muted-foreground")}>
              {e.when}
              {e.tag && <> · <span className={isInk ? "text-[hsl(36_25%_72%)]" : "text-foreground/60"}>{e.tag}</span></>}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────── Insight ─────────────────────── */

export function Insight({
  title,
  cause,
  effect,
  confidence,
  actions,
  severity = "neutral",
  surface = "paper",
  className,
}: {
  title: string;
  cause?: string;
  effect?: string;
  confidence?: number; // 0..1
  actions?: ReactNode;
  severity?: "low" | "medium" | "high" | "critical" | "neutral";
  surface?: Surface;
  className?: string;
}) {
  const isInk = surface === "ink";
  const sevDot =
    severity === "critical" ? "bg-destructive"
    : severity === "high" ? "bg-amber-500"
    : severity === "medium" ? "bg-[hsl(var(--oxblood))]"
    : severity === "low" ? "bg-emerald-500"
    : "bg-foreground/40";
  return (
    <article className={cn("flex flex-col gap-3 p-5 md:p-6", isInk ? "bg-[hsl(18_10%_7%)] border border-white/[0.06]" : "bg-card border border-[hsl(var(--border))]", className)}>
      <div className="flex items-center gap-2.5">
        <span className={cn("h-2 w-2 rounded-full", sevDot)} />
        <p className={cn("t-eyebrow", isInk && "text-[hsl(36_15%_58%)]")}>Insight</p>
        {typeof confidence === "number" && (
          <span className={cn("ml-auto text-[10px] tabular-nums uppercase tracking-[0.24em]", isInk ? "text-[hsl(36_15%_55%)]" : "text-muted-foreground")}>
            {Math.round(confidence * 100)}% confidence
          </span>
        )}
      </div>
      <h3 className={cn("t-display-sm", isInk && "text-[hsl(36_28%_94%)]")}>{title}</h3>
      {(cause || effect) && (
        <div className={cn("grid gap-2 text-[12.5px] leading-relaxed", isInk ? "text-[hsl(36_25%_82%)]" : "text-foreground/80")}>
          {cause && <p><span className={cn("t-eyebrow mr-2 inline-block", isInk && "text-[hsl(36_15%_58%)]")}>Cause</span>{cause}</p>}
          {effect && <p><span className={cn("t-eyebrow mr-2 inline-block", isInk && "text-[hsl(36_15%_58%)]")}>Effect</span>{effect}</p>}
        </div>
      )}
      {actions && <div className="mt-1 flex flex-wrap gap-2">{actions}</div>}
    </article>
  );
}

/* ─────────────────────── Recommendation ─────────────────────── */

export function Recommendation({
  subject,
  rationale,
  action,
  className,
  surface = "paper",
}: {
  subject: ReactNode;
  rationale: ReactNode;
  action?: ReactNode;
  surface?: Surface;
  className?: string;
}) {
  const isInk = surface === "ink";
  return (
    <div className={cn("flex items-start gap-3 px-5 py-4 md:px-6", className)}>
      <span className={cn(
        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border",
        isInk ? "border-[hsl(var(--oxblood))]/60 text-[hsl(var(--oxblood))]" : "border-[hsl(var(--oxblood))]/50 text-[hsl(var(--oxblood))]",
      )}>
        <PawnMark className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("t-body-sm font-medium", isInk ? "text-[hsl(36_28%_94%)]" : "text-foreground")}>{subject}</p>
        <p className={cn("mt-1 text-[12.5px] leading-relaxed", isInk ? "text-[hsl(36_18%_70%)]" : "text-foreground/65")}>{rationale}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

/* ─────────────────────── Command (button language) ─────────────────────── */

type CommandVariant = "ink" | "paper" | "ghost" | "decision";
type CommandSize = "sm" | "md" | "lg";

const CMD_VARIANT: Record<CommandVariant, string> = {
  ink: "bg-foreground text-background hover:bg-foreground/90",
  paper: "bg-transparent text-foreground border border-[hsl(var(--border-strong))] hover:bg-foreground/[0.04]",
  ghost: "bg-transparent text-foreground hover:bg-foreground/[0.04]",
  decision: "bg-[hsl(var(--oxblood))] text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--oxblood))]/90 uppercase tracking-[0.18em]",
};

const CMD_SIZE: Record<CommandSize, string> = {
  sm: "h-8 px-3 text-[0.65rem] uppercase tracking-[0.22em]",
  md: "h-10 px-5 text-[0.72rem] uppercase tracking-[0.22em]",
  lg: "h-12 px-8 text-[0.78rem] uppercase tracking-[0.22em]",
};

export interface CommandProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CommandVariant;
  size?: CommandSize;
}

export const Command = forwardRef<HTMLButtonElement, CommandProps>(function Command(
  { variant = "ink", size = "md", className, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-none font-medium motion-micro disabled:opacity-50 disabled:pointer-events-none",
        CMD_VARIANT[variant],
        CMD_SIZE[size],
        className,
      )}
      {...rest}
    />
  );
});

/* ─────────────────────── Status ─────────────────────── */

type StatusTone = "live" | "watch" | "risk" | "calm" | "muted";
const STATUS: Record<StatusTone, { dot: string; text: string; border: string }> = {
  live:  { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-500/30" },
  watch: { dot: "bg-amber-500",   text: "text-amber-700 dark:text-amber-200",     border: "border-amber-500/40" },
  risk:  { dot: "bg-destructive", text: "text-destructive",                        border: "border-destructive/40" },
  calm:  { dot: "bg-foreground/40", text: "text-foreground/70",                    border: "border-[hsl(var(--border-strong))]" },
  muted: { dot: "bg-foreground/25", text: "text-muted-foreground",                 border: "border-[hsl(var(--border))]" },
};

export function Status({ tone = "calm", label, className }: { tone?: StatusTone; label: string; className?: string }) {
  const s = STATUS[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 border px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.22em]", s.border, s.text, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {label}
    </span>
  );
}

/* ─────────────────────── IdentityChip ─────────────────────── */

export function IdentityChip({
  name,
  role,
  glyph,
  surface = "paper",
  className,
}: {
  name: string;
  role?: string;
  glyph?: string;
  surface?: Surface;
  className?: string;
}) {
  const isInk = surface === "ink";
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span className={cn(
        "flex h-8 w-8 items-center justify-center border font-serif text-[13px]",
        isInk ? "border-white/15 bg-white/[0.03] text-[hsl(36_28%_94%)]" : "border-[hsl(var(--border-strong))] bg-secondary text-foreground",
      )}>
        {glyph ?? name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className={cn("block truncate t-body-sm", isInk && "text-[hsl(36_28%_94%)]")}>{name}</span>
        {role && (
          <span className={cn("block truncate t-eyebrow", isInk && "text-[hsl(36_15%_58%)]")}>{role}</span>
        )}
      </span>
    </span>
  );
}

/* ─────────────────────── Hairline / Seam ─────────────────────── */

export function Hairline({ tone = "default", className }: { tone?: "default" | "strong" | "light"; className?: string }) {
  return <span aria-hidden className={cn(tone === "strong" ? "hairline-strong" : tone === "light" ? "hairline-light" : "hairline", className)} />;
}

export function ChessSeam({ label, invert = false, className }: { label?: string; invert?: boolean; className?: string }) {
  const line = invert ? "bg-primary-foreground/20" : "bg-foreground/15";
  const text = invert ? "text-primary-foreground/60" : "text-foreground/55";
  return (
    <div className={cn("editorial-container flex items-center gap-6 py-10", className)}>
      <span className={cn("h-px flex-1", line)} />
      <div className={cn("flex items-center gap-3", text)}>
        <PawnMark className="h-5 w-5" />
        {label && <span className="text-[0.6rem] uppercase tracking-[0.32em]">{label}</span>}
      </div>
      <span className={cn("h-px flex-1", line)} />
    </div>
  );
}
