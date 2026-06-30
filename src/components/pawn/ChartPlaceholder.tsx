import { cn } from "@/lib/utils";

interface ChartPlaceholderProps {
  series?: number[];
  labels?: string[];
  className?: string;
  height?: number;
  tone?: "light" | "dark";
  variant?: "line" | "bars" | "area";
}

/**
 * SVG mini-chart placeholder. Renders a clean editorial line / bars / area
 * chart from any numeric series. No dependencies.
 */
export function ChartPlaceholder({
  series = [12, 16, 14, 22, 26, 24, 31, 34, 30, 38, 44, 48],
  labels,
  className,
  height = 220,
  tone = "light",
  variant = "line",
}: ChartPlaceholderProps) {
  const width = 600;
  const padding = 24;
  const max = Math.max(...series, 1);
  const stepX = (width - padding * 2) / Math.max(series.length - 1, 1);
  const points = series.map((v, i) => {
    const x = padding + i * stepX;
    const y = height - padding - (v / max) * (height - padding * 2);
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area = `${path} L${points[points.length - 1][0]},${height - padding} L${points[0][0]},${height - padding} Z`;

  const stroke = tone === "dark" ? "hsl(38 32% 90%)" : "hsl(30 8% 12%)";
  const accent = "hsl(350 50% 35%)";
  const grid = tone === "dark" ? "hsl(30 5% 20%)" : "hsl(30 10% 82%)";
  const label = tone === "dark" ? "hsl(38 20% 60%)" : "hsl(30 6% 40%)";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("w-full", className)} role="img" aria-label="Chart">
      {[0.25, 0.5, 0.75].map((p) => (
        <line key={p} x1={padding} x2={width - padding} y1={padding + p * (height - padding * 2)} y2={padding + p * (height - padding * 2)} stroke={grid} strokeDasharray="2 4" />
      ))}
      {variant === "bars" ? (
        points.map(([x, y], i) => (
          <rect key={i} x={x - stepX / 4} y={y} width={stepX / 2} height={height - padding - y} fill={i === points.length - 1 ? accent : stroke} opacity={i === points.length - 1 ? 1 : 0.85} />
        ))
      ) : (
        <>
          {variant === "area" && <path d={area} fill={accent} opacity={0.12} />}
          <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} />
          {points.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i === points.length - 1 ? 4 : 2} fill={i === points.length - 1 ? accent : stroke} />
          ))}
        </>
      )}
      {labels && labels.map((l, i) => (
        <text key={l + i} x={padding + i * stepX} y={height - 6} textAnchor="middle" fontSize="9" fill={label} fontFamily="Inter">
          {l}
        </text>
      ))}
    </svg>
  );
}

/**
 * Radial radar-style chart for DNA visualization.
 */
export function RadarPlaceholder({ values = [70, 88, 62, 80, 55, 74], labels = ["Architectural", "Romantic", "Utilitarian", "Editorial", "Street", "Heritage"], className }: { values?: number[]; labels?: string[]; className?: string }) {
  const size = 320;
  const c = size / 2;
  const r = size / 2 - 40;
  const n = values.length;

  const polygon = (vals: number[], scale = 1) =>
    vals
      .map((v, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const rad = (v / 100) * r * scale;
        return `${c + Math.cos(angle) * rad},${c + Math.sin(angle) * rad}`;
      })
      .join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={cn("w-full", className)} role="img" aria-label="Style DNA radar">
      {[0.25, 0.5, 0.75, 1].map((s) => (
        <polygon key={s} points={polygon(new Array(n).fill(100), s)} fill="none" stroke="hsl(30 10% 78%)" strokeDasharray="2 3" />
      ))}
      {values.map((_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return <line key={i} x1={c} y1={c} x2={c + Math.cos(angle) * r} y2={c + Math.sin(angle) * r} stroke="hsl(30 10% 78%)" strokeDasharray="2 3" />;
      })}
      <polygon points={polygon(values)} fill="hsl(350 50% 22% / 0.18)" stroke="hsl(350 50% 22%)" strokeWidth={1.5} />
      {values.map((v, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const rad = (v / 100) * r;
        return <circle key={i} cx={c + Math.cos(angle) * rad} cy={c + Math.sin(angle) * rad} r={3} fill="hsl(350 50% 22%)" />;
      })}
      {labels.map((label, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const lr = r + 20;
        return (
          <text key={label} x={c + Math.cos(angle) * lr} y={c + Math.sin(angle) * lr + 4} textAnchor="middle" fontSize="10" fontFamily="Inter" fill="hsl(30 8% 22%)" className="uppercase tracking-[0.18em]">
            {label}
          </text>
        );
      })}
    </svg>
  );
}
