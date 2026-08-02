/**
 * Produktdetails als ausklappbare Abschnitte — Maße & Passform, Material,
 * Pflege, Herkunft, Versand & Rückgabe. Leere Abschnitte erscheinen nicht.
 */
import { useState, type ReactNode } from "react";
import {
  careLabel,
  materialLine,
  worldProfile,
  type MaterialPart,
  type Measurements,
  type SizeVariant,
} from "@/features/studio/productDetails";
import { FitVerdict } from "@/components/palace/FitVerdict";
import type { DbProduct } from "@/features/products/useDbProduct";

function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="house-hair border-b">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="house-ink flex min-h-[52px] w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="palace-eyebrow">{title}</span>
        <span className="text-lg leading-none opacity-60">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="house-ink pb-6">{children}</div>}
    </div>
  );
}

function Rows({ rows }: { rows: [string, string | null][] }) {
  const filled = rows.filter(([, v]) => v && String(v).trim() !== "");
  if (filled.length === 0) return null;
  return (
    <dl className="space-y-3">
      {filled.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[130px_1fr] items-baseline gap-4">
          <dt className="text-[0.62rem] uppercase tracking-[0.24em] opacity-60">{label}</dt>
          <dd className="whitespace-pre-line text-[0.92rem] leading-relaxed opacity-90">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProductDetailsAccordion({ dbProduct, onPickSize }: { dbProduct: DbProduct | null; onPickSize?: (size: string) => void }) {
  if (!dbProduct) return null;

  const profile = worldProfile(dbProduct.world);
  const dims = [
    dbProduct.length_cm && `L ${dbProduct.length_cm} cm`,
    dbProduct.width_cm && `B ${dbProduct.width_cm} cm`,
    dbProduct.height_cm && `H ${dbProduct.height_cm} cm`,
  ].filter(Boolean).join(" × ");

  const dna = (dbProduct.product_dna ?? {}) as { materials?: string[] };
  const parts = (Array.isArray(dbProduct.material_composition) ? dbProduct.material_composition : []) as unknown as MaterialPart[];
  const composition = materialLine(parts);
  const materials = composition || (Array.isArray(dna.materials) && dna.materials.length ? dna.materials.join(", ") : null);
  const weight = dbProduct.weight_grams ? `${dbProduct.weight_grams} g` : null;
  const care = (Array.isArray(dbProduct.care_symbols) ? (dbProduct.care_symbols as string[]) : []).map(careLabel).join(" · ");
  const careText = [care || null, dbProduct.care_instructions ?? null].filter(Boolean).join("\n");

  const rawMeasurements = (dbProduct.measurements ?? {}) as Partial<Measurements>;
  const measurements: Measurements = {
    rows: Array.isArray(rawMeasurements.rows) ? rawMeasurements.rows : [],
    values: (rawMeasurements.values ?? {}) as Measurements["values"],
  };
  const sizes = (Array.isArray(dbProduct.size_variants) ? dbProduct.size_variants : ([] as unknown[]))
    .filter((s): s is SizeVariant => !!(s as SizeVariant)?.size?.trim());
  const sizeNames = sizes.map((s) => s.size);
  const showTable = measurements.rows.length > 0 && sizes.length > 0;

  const massRows: [string, string | null][] = [
    [dbProduct.world === "Mode" ? "Paketmaße" : "Maße", dims || null],
    ["Gewicht", weight],
  ];
  const materialRows: [string, string | null][] = [
    [profile.materialPublicLabel, materials],
    [profile.detailPublicLabel, dbProduct.lining_hardware ?? null],
    ["Nachhaltigkeit", dbProduct.sustainability_note ?? null],
  ];
  const herkunftRows: [string, string | null][] = [
    [profile.originLabel === "Wo entstanden?" ? "Entstanden in" : "Gefertigt in", dbProduct.made_in ?? null],
    [profile.editionPublicLabel, dbProduct.edition_info ?? null],
  ];
  const versandRows: [string, string | null][] = [
    [
      "Lieferzeit",
      dbProduct.inventory_mode === "made_to_order"
        ? `Wird für dich gefertigt${dbProduct.lead_time_days ? ` · ca. ${dbProduct.lead_time_days} Tage` : ""}`
        : "Versandfertig aus dem Atelier",
    ],
    ["Rückgabe", "14 Tage Widerrufsrecht. Anfertigungen nach Maß sind davon ausgenommen."],
    ["Versand", "Versichert, weltweit — direkt vom Haus, nicht aus einem Lager."],
  ];

  const hasMass = showTable || massRows.some(([, v]) => v);
  const hasMaterial = materialRows.some(([, v]) => v);
  const hasCare = !!careText;
  const hasHerkunft = herkunftRows.some(([, v]) => v);

  if (!hasMass && !hasMaterial && !hasCare && !hasHerkunft) return null;

  return (
    <div className="house-hair mt-10 border-t pt-4">
      {hasMass && (
        <Section title={dbProduct.world === "Mode" ? "Maße & Passform" : profile.measurementTitle} defaultOpen>
          {showTable && (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full min-w-[380px] text-[0.9rem]">
                <thead>
                  <tr className="house-hair border-b text-left">
                    <th className="py-2 pr-4 text-[0.62rem] uppercase tracking-[0.24em] opacity-60">Maß</th>
                    {sizes.map((s) => (
                      <th key={s.size} className="py-2 pr-4 text-[0.62rem] uppercase tracking-[0.24em] opacity-60">{s.size}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {measurements.rows.map((row) => (
                    <tr key={row} className="house-hair border-b">
                      <td className="py-2 pr-4">{row}</td>
                      {sizes.map((s) => (
                        <td key={s.size} className="py-2 pr-4 tabular-nums">{measurements.values?.[row]?.[s.size] || "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Rows rows={massRows} />
          {dbProduct.world === "Mode" && (
            <FitVerdict measurements={measurements} sizes={sizeNames} onPick={onPickSize} />
          )}
        </Section>
      )}

      {hasMaterial && (
        <Section title={profile.materialTitle}>
          <Rows rows={materialRows} />
        </Section>
      )}

      {hasCare && (
        <Section title={profile.careTitle}>
          <p className="whitespace-pre-line text-[0.92rem] leading-relaxed opacity-90">{careText}</p>
        </Section>
      )}

      {hasHerkunft && (
        <Section title="Herkunft & Auflage">
          <Rows rows={herkunftRows} />
        </Section>
      )}

      <Section title="Versand & Rückgabe">
        <Rows rows={versandRows} />
      </Section>
    </div>
  );
}
