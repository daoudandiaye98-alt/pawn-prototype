import { useState } from "react";
import { Search, Plus } from "lucide-react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore, marketplaceSelectors } from "@/core";
import { ProductImage } from "@/components/pawn/ProductImage";
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
        <Button><Plus className="mr-2 h-4 w-4" /> New product</Button>
      </div>

      <div className="mt-8 border border-[hsl(var(--border-strong))] bg-card">
        <div className="flex items-baseline justify-between gap-4 px-6 py-4">
          <div>
            <p className="t-eyebrow">{`${filtered.length} pieces`}</p>
            <h3 className="mt-1 t-display-sm">Catalog</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
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
                  <Badge variant={p.status === "Active" ? "default" : "outline"}>{p.status}</Badge>
                </td>
                <td className="px-6 py-3 text-right tabular-nums">€{p.price.toLocaleString("de-DE")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </AdminShell>
  );
};

export default AdminProducts;
