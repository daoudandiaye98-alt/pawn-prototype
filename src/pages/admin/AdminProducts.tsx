import { useState } from "react";
import { Search, Plus } from "lucide-react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { Input } from "@/components/ui/input";
import { useStore, marketplaceSelectors } from "@/core";
import { ProductImage } from "@/components/pawn/ProductImage";
import { Panel, Command, Status } from "@/components/pawn/primitives";
import { cn } from "@/lib/utils";

const AdminProducts = () => {
  const products = useStore(marketplaceSelectors.getAllProductViews);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const cats = ["All", "Outerwear", "Tops", "Bottoms", "Bags", "Accessories"];
  const filtered = products.filter((p) =>
    (cat === "All" || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <AdminShell eyebrow="Katalog" title="Produkte">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="rounded-none pl-9" />
          </div>
          <div className="flex gap-1">
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cn(
                  "border px-3 py-2 t-eyebrow motion-micro",
                  cat === c ? "border-foreground bg-foreground text-background" : "border-[hsl(var(--border-strong))] bg-card hover:border-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <Command><Plus className="mr-2 h-4 w-4" /> New product</Command>
      </div>

      <Panel className="mt-8" padding="none" headerBorder={false} eyebrow={`${filtered.length} pieces`} title="Catalog">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--border))] text-left t-eyebrow">
              <th className="px-6 py-3">Product</th>
              <th className="px-6 py-3">Designer</th>
              <th className="px-6 py-3">Category</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-[hsl(var(--border))] last:border-0 motion-micro hover:bg-foreground/[0.03]">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <ProductImage seed={p.slug} className="h-12 w-10" />
                    <span className="t-display-sm">{p.name}</span>
                  </div>
                </td>
                <td className="px-6 py-3 text-muted-foreground">{p.designer}</td>
                <td className="px-6 py-3">{p.category}</td>
                <td className="px-6 py-3">
                  <Status tone={p.status === "Active" ? "live" : "muted"} label={p.status} />
                </td>
                <td className="px-6 py-3 text-right tabular-nums">€{p.price.toLocaleString("de-DE")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </AdminShell>
  );
};

export default AdminProducts;
