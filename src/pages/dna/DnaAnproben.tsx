import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { signiere, useAnprobeKontingent } from "@/features/dna/bilder";
import { DnaShell, Knopf } from "./DnaShell";

/**
 * D4 — /deine-dna/anproben: die Polaroid-Wand.
 *
 * `status='laeuft'` zeigt den Ladezustand, `status='fehler'` zeigt `fehler` im
 * Klartext — kein Spinner, der nie aufhört.
 */
interface Werk { id: string; name: string | null; slug: string | null; image_url: string | null }
interface Anprobe {
  id: string;
  art: string;
  status: string;
  result_path: string | null;
  fehler: string | null;
  bewertung: string | null;
  created_at: string;
  products: Werk | null;
}

function Polaroid({
  a, onBewerten, onLoeschen,
}: { a: Anprobe; onBewerten: (b: "passt" | "nicht") => void; onLoeschen: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { void signiere(a.result_path).then(setUrl); }, [a.result_path]);

  return (
    <figure className="border-[1.5px] border-black bg-white p-3 shadow-[6px_6px_0_#000]">
      <div className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden bg-white">
        {a.status === "laeuft" ? (
          <p className="px-4 text-center font-sans text-[0.8rem] text-black">PAWN rechnet …</p>
        ) : a.status === "fehler" ? (
          <p className="px-4 text-center font-sans text-[0.8rem] text-black">{a.fehler || "Das hat nicht geklappt."}</p>
        ) : url ? (
          <img src={url} alt={`Anprobe ${a.products?.name ?? ""}`} className="h-full w-full object-cover" />
        ) : (
          <p className="px-4 text-center font-sans text-[0.8rem] text-black">Bild nicht mehr da.</p>
        )}
      </div>
      <figcaption className="mt-3 space-y-2">
        <p className="text-[0.62rem] uppercase tracking-[0.22em] text-black">KI-Anprobe</p>
        {a.products?.slug ? (
          <Link to={`/werk/${a.products.slug}`} className="block font-serif text-base leading-tight text-black underline decoration-1 underline-offset-4 hover:no-underline">
            {a.products.name}
          </Link>
        ) : (
          <p className="font-serif text-base leading-tight text-black">{a.products?.name ?? "Werk"}</p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Knopf invers={a.bewertung === "passt"} onClick={() => onBewerten("passt")}>Passt</Knopf>
          <Knopf invers={a.bewertung === "nicht"} onClick={() => onBewerten("nicht")}>Passt nicht</Knopf>
          <Knopf onClick={onLoeschen}>Löschen</Knopf>
        </div>
      </figcaption>
    </figure>
  );
}

export default function DnaAnproben() {
  const { user } = useAuth();
  const kontingent = useAnprobeKontingent(user?.id);
  const [liste, setListe] = useState<Anprobe[]>([]);
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const holen = useCallback(async () => {
    if (!user?.id) { setLaden(false); return; }
    const { data, error } = await supabase
      .from("anproben")
      .select("id, art, status, result_path, fehler, bewertung, created_at, products(id, name, slug, image_url)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) setFehler(error.message);
    else setListe((data ?? []) as unknown as Anprobe[]);
    setLaden(false);
  }, [user?.id]);

  useEffect(() => { void holen(); }, [holen]);

  // Solange etwas läuft, alle 5 s nachsehen — sonst gar nicht.
  useEffect(() => {
    if (!liste.some((a) => a.status === "laeuft")) return;
    const t = setInterval(() => { void holen(); }, 5000);
    return () => clearInterval(t);
  }, [liste, holen]);

  async function bewerten(a: Anprobe, bewertung: "passt" | "nicht") {
    setFehler(null);
    const { error } = await supabase.from("anproben").update({ bewertung } as never).eq("id", a.id);
    if (error) setFehler(error.message); else await holen();
  }

  async function loeschen(a: Anprobe) {
    setFehler(null);
    if (a.result_path) await supabase.storage.from("kunden-bilder").remove([a.result_path]);
    const { error } = await supabase.from("anproben").delete().eq("id", a.id);
    if (error) setFehler(error.message); else await holen();
  }

  return (
    <DnaShell
      eyebrow="Deine DNA"
      titel="Deine Anproben."
      satz="Jedes Bild ist eine KI-Anprobe — keine Fotografie. Sag uns, was passt: davon lernt, was PAWN dir zeigt."
      title="Deine Anproben — PAWN"
      description="Alle Anproben an einem Ort: bewerten, behalten, löschen."
    >
      <div className="space-y-8">
        {kontingent && (
          <p className="text-[0.62rem] uppercase tracking-[0.22em] text-black">
            Anproben heute: {kontingent.heute} · frei: {kontingent.frei}
          </p>
        )}
        {fehler && <p className="border-[1.5px] border-black p-4 font-sans text-[0.85rem] text-black">{fehler}</p>}
        {laden ? null : liste.length === 0 ? (
          <p className="font-sans text-[0.95rem] text-black">
            Noch keine Anprobe. Sie beginnt bei einem Stück — oder bei{" "}
            <Link to="/deine-dna/avatar" className="underline decoration-1 underline-offset-4">deinem Avatar</Link>.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {liste.map((a) => (
              <Polaroid key={a.id} a={a} onBewerten={(b) => void bewerten(a, b)} onLoeschen={() => void loeschen(a)} />
            ))}
          </div>
        )}
      </div>
    </DnaShell>
  );
}
