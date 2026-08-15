/**
 * EditModeProvider — der Bearbeiten-Schalter. Es gibt zwei getrennte Rechte:
 *
 *  1. Admin  → darf die Texte/Bilder der Site (Tabelle `site_content`) überall bearbeiten.
 *              Das ist der alte Zustand und bleibt unverändert.
 *  2. Inhaber → darf die Bausteine SEINER eigenen Hausseite bearbeiten
 *              (Tabelle `designer_page_blocks`). Neu in Teil U1.1.
 *
 * `enabled` ist deshalb nicht mehr global, sondern kann in einem Zweig der Seite
 * gelten: <AuftrittScope designerId={…}> schaltet ihn ein, wenn der eingeloggte
 * Nutzer entweder Admin ist ODER dieses Haus besitzt.
 *
 * Wichtig: Das Frontend ist hier nur die Höflichkeit. Die eigentliche Grenze zieht
 * die RLS von `designer_page_blocks` ("designer manages own page blocks"): ein Haus
 * darf ausschließlich Zeilen schreiben, deren `designer_id` auf einen `designers`-
 * Eintrag mit dem eigenen `user_id` zeigt. Ein manipulierter Client kommt also
 * nicht weiter als ein ehrlicher.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

interface EditModeCtx {
  enabled: boolean;
  isAdmin: boolean;
  /** Das Haus des eingeloggten Nutzers (null, wenn er keines besitzt). */
  eigenesHausId: string | null;
  /** Gehört diese Hausseite dem eingeloggten Nutzer? */
  istEigenesHaus: (designerId?: string | null) => boolean;
  /** Admin ODER Inhaber — das Recht, die Bausteine dieses Hauses zu ändern. */
  darfHausBearbeiten: (designerId?: string | null) => boolean;
  toggle: () => void;
  disable: () => void;
}

const Ctx = createContext<EditModeCtx>({
  enabled: false,
  isAdmin: false,
  eigenesHausId: null,
  istEigenesHaus: () => false,
  darfHausBearbeiten: () => false,
  toggle: () => {},
  disable: () => {},
});

const STORAGE_KEY = "pawn:edit-mode";

export function EditModeProvider({ children }: { children: ReactNode }) {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [enabled, setEnabled] = useState(false);
  const [eigenesHausId, setEigenesHausId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) { setEnabled(false); return; }
    try { setEnabled(sessionStorage.getItem(STORAGE_KEY) === "1"); } catch { /* noop */ }
  }, [isAdmin]);

  // Das eigene Haus einmal je Anmeldung nachschlagen — nur die id, sonst nichts.
  useEffect(() => {
    if (!user) { setEigenesHausId(null); return; }
    let abgebrochen = false;
    void (async () => {
      const { data } = await supabase.from("designers").select("id").eq("user_id", user.id).maybeSingle();
      if (!abgebrochen) setEigenesHausId((data as { id: string } | null)?.id ?? null);
    })();
    return () => { abgebrochen = true; };
  }, [user?.id]);

  const toggle = useCallback(() => {
    setEnabled((v) => {
      const next = !v;
      try { sessionStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  }, []);

  const disable = useCallback(() => {
    setEnabled(false);
    try { sessionStorage.setItem(STORAGE_KEY, "0"); } catch { /* noop */ }
  }, []);

  const istEigenesHaus = useCallback(
    (designerId?: string | null) => !!designerId && !!eigenesHausId && designerId === eigenesHausId,
    [eigenesHausId],
  );
  const darfHausBearbeiten = useCallback(
    (designerId?: string | null) => isAdmin || istEigenesHaus(designerId),
    [isAdmin, istEigenesHaus],
  );

  const wert = useMemo<EditModeCtx>(() => ({
    enabled: enabled && isAdmin, isAdmin, eigenesHausId, istEigenesHaus, darfHausBearbeiten, toggle, disable,
  }), [enabled, isAdmin, eigenesHausId, istEigenesHaus, darfHausBearbeiten, toggle, disable]);

  return <Ctx.Provider value={wert}>{children}</Ctx.Provider>;
}

/**
 * Der Auftritt-Modus für genau eine Hausseite (Teil U1.1).
 * `gewuenscht` kommt aus `?auftritt=1`; erlaubt wird er nur, wenn der Nutzer das
 * Haus besitzt oder Admin ist. Innerhalb dieses Zweigs ist `enabled` wahr — die
 * Site-Texte (`site_content`) bleiben davon unberührt, denn <Editable contentKey>
 * verlangt zusätzlich `isAdmin`.
 */
export function AuftrittScope({ designerId, gewuenscht, children }: {
  designerId?: string | null;
  gewuenscht: boolean;
  children: ReactNode;
}) {
  const basis = useContext(Ctx);
  const darf = basis.darfHausBearbeiten(designerId);
  const wert = useMemo<EditModeCtx>(
    () => ({ ...basis, enabled: basis.enabled || (gewuenscht && darf) }),
    [basis, gewuenscht, darf],
  );
  return <Ctx.Provider value={wert}>{children}</Ctx.Provider>;
}

export function useEditMode() {
  return useContext(Ctx);
}
