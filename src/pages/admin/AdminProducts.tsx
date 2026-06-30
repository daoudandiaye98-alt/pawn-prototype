import { useState } from "react";
import { Search, Plus } from "lucide-react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { products } from "@/data/mock";
import { ProductImage } from "@/components/pawn/ProductImage";
import { cn } from "@/lib/utils";

const AdminProducts = () => {
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
                  "border px-3 py-2 text-[0.65rem] uppercase tracking-[0.18em]",
                  cat === c ? "border-foreground bg-foreground text-background" : "border-border bg-card",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <Button className="rounded-none"><Plus className="mr-2 h-4 w-4" /> New product</Button>
      </div>

      <div className="mt-8 border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
              <th className="px-6 py-3">Product</th>
              <th className="px-6 py-3">Designer</th>
              <th className="px-6 py-3">Category</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <ProductImage seed={p.slug} className="h-12 w-10" />
                    <span className="font-serif text-base">{p.name}</span>
                  </div>
                </td>
                <td className="px-6 py-3 text-muted-foreground">{p.designer}</td>
                <td className="px-6 py-3">{p.category}</td>
                <td className="px-6 py-3">
                  <span className={cn(
                    "border px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em]",
                    p.status === "Active" ? "border-accent text-accent" : "border-border text-muted-foreground",
                  )}>{p.status}</span>
                </td>
                <td className="px-6 py-3 text-right tabular-nums">€{p.price.toLocaleString("de-DE")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
};

export default AdminProducts;
