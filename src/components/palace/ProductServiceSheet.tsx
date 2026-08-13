import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PawnFigurSvg } from "@/components/pawn/PawnFigur";
import { AiDisclosureNote } from "@/components/pawn/AiDisclosureNote";
import { useI18n } from "@/lib/i18n";

/**
 * Teil 35 — das Service-Sheet: öffnet sich über der stickigen Kaufleiste (die bleibt
 * sichtbar/bedienbar). Drei Chips + freies Eingabefeld an pawn-chat mit Produktkontext.
 * "Steht mir das?" nutzt weiterhin die Einschätzungs-Logik aus PasstDas (Teil 19/21):
 * immer mit Beleg aus der Kunden-DNA, im Frühzustand die ehrliche Absage, nie erfunden.
 */

interface PasstResult {
  ok: boolean;
  fruehzustand?: { erreicht: boolean };
  passt?: boolean;
  urteil?: string;
  alternative_slug?: string | null;
  alternative_grund?: string | null;
  message?: string;
  error?: string;
}

interface Msg { role: "user" | "assistant"; content: string }

export function ProductServiceSheet({
  open, onClose, bottomOffset, productSlug, productName, variant = "sheet",
}: {
  open: boolean;
  onClose: () => void;
  bottomOffset?: number;
  productSlug: string;
  productName: string;
  /** "sheet" (Standard, mobil): fest über der Kaufleiste. "panel" (Desktop-Doppelseite,
   * Teil 36): sitzt im normalen Fluss direkt unter dem Kaufblock, kein Bottom-Sheet. */
  variant?: "sheet" | "panel";
}) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [passtBusy, setPasstBusy] = useState(false);
  const [passtResult, setPasstResult] = useState<PasstResult | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, passtResult]);

  const sendMessage = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("pawn-chat", {
        body: {
          messages: [...messages, { role: "user", content: q }],
          page_context: { route: `/product/${productSlug}`, product_slug: productSlug },
        },
      });
      if (error) throw error;
      const reply = (data as { reply?: string })?.reply ?? "…";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: t("product.serviceSheet.connectionError") }]);
    } finally {
      setBusy(false);
    }
  };

  const checkPasst = async () => {
    if (passtBusy) return;
    setPasstBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-dna-voice", { body: { mode: "passt", produkt_slug: productSlug } });
      if (error) throw error;
      setPasstResult(data as PasstResult);
    } catch (e) {
      setPasstResult({ ok: false, error: (e as Error).message });
    } finally {
      setPasstBusy(false);
    }
  };

  if (!open) return null;

  const content = (
    <>
      <div className="flex items-center justify-between border-b border-black/15 px-4 py-3">
        <p className="text-[0.6rem] uppercase tracking-[0.28em] text-black/60">{t("product.serviceSheet.title")}</p>
        <button type="button" onClick={onClose} aria-label={t("product.serviceSheet.closeAria")} className="text-black/60 hover:text-black">
          <X className="h-4 w-4" />
        </button>
      </div>

      {(messages.length > 0 || passtResult) && (
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {passtResult && (
            passtResult.ok === false ? (
              <p className="text-sm text-black/70">{passtResult.message ?? passtResult.error ?? t("product.passt.error")}</p>
            ) : !passtResult.fruehzustand?.erreicht ? (
              <div className="border-[1.5px] border-black p-4">
                <p className="text-sm text-black/70">{t("product.passt.fruehzustand")}</p>
                <Link to="/dna" className="mt-2 inline-block text-[0.62rem] uppercase tracking-[0.24em] text-black underline decoration-1 underline-offset-4 hover:no-underline">
                  {t("product.passt.zurDna")}
                </Link>
              </div>
            ) : (
              <div className="border-[1.5px] border-black p-4" style={{ boxShadow: "6px 6px 0 0 #000" }}>
                <p className="text-[0.6rem] uppercase tracking-[0.24em] text-black/60">{passtResult.passt ? t("product.passt.passt") : t("product.passt.passtNicht")}</p>
                <p className="mt-2 text-sm text-black">{passtResult.urteil}</p>
                {!passtResult.passt && passtResult.alternative_slug && (
                  <div className="mt-3 border-t border-black/15 pt-3">
                    <p className="text-xs text-black/60">{passtResult.alternative_grund}</p>
                    <Link to={`/product/${passtResult.alternative_slug}`} className="mt-2 inline-block text-[0.62rem] uppercase tracking-[0.24em] text-black underline decoration-1 underline-offset-4 hover:no-underline">
                      {t("product.passt.alternative")}
                    </Link>
                  </div>
                )}
              </div>
            )
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "flex items-start gap-2"}>
              {m.role === "assistant" && <PawnFigurSvg className="mt-0.5 h-4 w-3 shrink-0" />}
              <p className={`inline-block max-w-[85%] whitespace-pre-wrap text-sm ${m.role === "assistant" ? "font-serif italic" : ""}`}>{m.content}</p>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2">
              <PawnFigurSvg className="h-4 w-3 shrink-0" />
              <span className="text-[0.6rem] uppercase tracking-[0.24em] text-black/60">{t("product.serviceSheet.thinking")}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-black/15 px-4 py-3">
        <button type="button" onClick={() => void checkPasst()} disabled={passtBusy} className="border-[1.5px] border-black px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.2em] hover:bg-black hover:text-white disabled:opacity-40">
          {passtBusy ? "…" : t("product.serviceSheet.chip.passt")}
        </button>
        <button type="button" onClick={() => void sendMessage(t("product.serviceSheet.masze.question"))} className="border-[1.5px] border-black px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.2em] hover:bg-black hover:text-white">
          {t("product.serviceSheet.chip.masze")}
        </button>
        <button type="button" onClick={() => void sendMessage(t("product.serviceSheet.versand.question"))} className="border-[1.5px] border-black px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.2em] hover:bg-black hover:text-white">
          {t("product.serviceSheet.chip.versand")}
        </button>
      </div>

      <div className="border-t border-black/15 px-4 pt-3">
        <AiDisclosureNote />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void sendMessage(input); }} className="flex items-center gap-2 p-3 pt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("product.serviceSheet.inputPlaceholder")}
          aria-label={`${t("product.serviceSheet.title")} — ${productName}`}
          className="flex-1 border-[1.5px] border-black bg-white px-3 py-2 text-sm focus:outline-none"
        />
        <button type="submit" disabled={busy || !input.trim()} className="border-[1.5px] border-black bg-black px-4 py-2 text-[0.6rem] uppercase tracking-[0.24em] text-white disabled:opacity-40">
          {t("product.serviceSheet.send")}
        </button>
      </form>
    </>
  );

  if (variant === "panel") {
    return (
      <div className="mt-4 flex max-h-[70vh] flex-col border-[1.5px] border-black bg-white">
        {content}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-x-0 z-[45] mx-auto flex max-h-[60vh] w-full flex-col border-[1.5px] border-black bg-white"
      style={{ bottom: bottomOffset ?? 0, boxShadow: "0 -8px 0 0 rgba(0,0,0,0.04)" }}
    >
      {content}
    </div>
  );
}
