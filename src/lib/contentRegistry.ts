/**
 * Registry aller bekannten site_content-Schlüssel, gruppiert nach Seite —
 * Grundlage für die Admin-Seite "Texte & Bilder" (Gruppierung, Suche, Labels).
 * Ein DB-Schlüssel, der hier fehlt, wird trotzdem angezeigt (unter "Sonstige") —
 * nichts verschwindet, diese Liste ist nur für Gruppierung/Beschriftung.
 */
export type ContentType = "text" | "multiline" | "image";

export interface ContentEntry {
  key: string;
  page: string;
  label: string;
  type: ContentType;
}

export const CONTENT_REGISTRY: ContentEntry[] = [
  // Landing — Hero
  { key: "landing.hero_eyebrow", page: "Landing", label: "Hero · Eyebrow", type: "text" },
  { key: "hero_headline_1", page: "Landing", label: "Hero · Headline Zeile 1", type: "text" },
  { key: "hero_headline_2", page: "Landing", label: "Hero · Headline Zeile 2 (kursiv)", type: "text" },
  { key: "hero_subline", page: "Landing", label: "Hero · Unterzeile", type: "multiline" },
  { key: "landing.hero_prompt_placeholder", page: "Landing", label: "Hero · Frag-PAWN Platzhalter", type: "text" },
  { key: "landing.hero_prompt_cta", page: "Landing", label: "Hero · Frag-PAWN Button", type: "text" },
  // Landing — Cover Story
  { key: "landing.cover_story_eyebrow", page: "Landing", label: "Cover Story · Eyebrow", type: "text" },
  { key: "landing.cover_story_headline", page: "Landing", label: "Cover Story · Headline (kursiver Teil)", type: "text" },
  { key: "landing.cover_story_cta", page: "Landing", label: "Cover Story · Link", type: "text" },
  // Landing — Grid
  { key: "landing.grid_chapter_label", page: "Landing", label: "Grid · Kapitel-Label", type: "text" },
  { key: "landing.grid_headline_a", page: "Landing", label: "Grid · Headline Teil 1", type: "text" },
  { key: "landing.grid_headline_b", page: "Landing", label: "Grid · Headline Teil 2 (kursiv)", type: "text" },
  { key: "landing.grid_cta", page: "Landing", label: "Grid · Link", type: "text" },
  { key: "landing.grid_empty_title", page: "Landing", label: "Grid · Leerer Zustand Titel", type: "text" },
  { key: "landing.grid_empty_body", page: "Landing", label: "Grid · Leerer Zustand Text", type: "text" },
  // Landing — Collection
  { key: "landing.collection_eyebrow", page: "Landing", label: "Kollektion · Eyebrow", type: "text" },
  { key: "landing.collection_hint", page: "Landing", label: "Kollektion · Scroll-Hinweis", type: "text" },
  // Landing — Atelier
  { key: "atelier_eyebrow", page: "Landing", label: "Atelier · Eyebrow", type: "text" },
  { key: "atelier_headline_a", page: "Landing", label: "Atelier · Headline Teil 1", type: "text" },
  { key: "atelier_headline_b", page: "Landing", label: "Atelier · Headline Teil 2 (kursiv)", type: "text" },
  { key: "atelier_body", page: "Landing", label: "Atelier · Text", type: "multiline" },
  { key: "atelier_image", page: "Landing", label: "Atelier · Bild", type: "image" },
  // Landing — Im Hintergrund (Helix)
  { key: "landing.helix_eyebrow", page: "Landing", label: "Im Hintergrund · Eyebrow", type: "text" },
  { key: "landing.helix_headline_a", page: "Landing", label: "Im Hintergrund · Headline Teil 1", type: "text" },
  { key: "landing.helix_headline_b", page: "Landing", label: "Im Hintergrund · Headline Teil 2 (kursiv)", type: "text" },
  { key: "landing.helix_body", page: "Landing", label: "Im Hintergrund · Text", type: "multiline" },
  { key: "landing.helix_cta", page: "Landing", label: "Im Hintergrund · Button", type: "text" },
  // Landing — Designer CTA
  { key: "cta_eyebrow", page: "Landing", label: "Designer-CTA · Eyebrow", type: "text" },
  { key: "cta_headline_a", page: "Landing", label: "Designer-CTA · Headline Teil 1", type: "text" },
  { key: "cta_headline_b", page: "Landing", label: "Designer-CTA · Headline Teil 2 (kursiv)", type: "text" },
  { key: "landing.cta_label_apply", page: "Landing", label: "Designer-CTA · Label „Bewerben“", type: "text" },
  { key: "cta_card_a", page: "Landing", label: "Designer-CTA · Karte Bewerben", type: "text" },
  { key: "landing.cta_label_view", page: "Landing", label: "Designer-CTA · Label „Sehen“", type: "text" },
  { key: "cta_card_b", page: "Landing", label: "Designer-CTA · Karte Sehen", type: "text" },
  // Landing — Signature Finale
  { key: "landing.signature_eyebrow", page: "Landing", label: "Signatur-Finale · Eyebrow", type: "text" },
  { key: "landing.signature_text_1", page: "Landing", label: "Signatur-Finale · Text 1", type: "text" },
  { key: "landing.signature_text_2", page: "Landing", label: "Signatur-Finale · Text 2", type: "text" },
  { key: "landing.signature_text_3", page: "Landing", label: "Signatur-Finale · Text 3", type: "text" },
  // Landing — Première
  { key: "landing.premiere_eyebrow", page: "Landing", label: "Première · Eyebrow", type: "text" },
  { key: "landing.premiere_headline", page: "Landing", label: "Première · Headline", type: "text" },
  // Landing — Banner
  { key: "banner_fallback_quote", page: "Landing", label: "Banner · Fallback-Zitat", type: "multiline" },

  // Neu
  { key: "landing.neu_eyebrow", page: "Neu", label: "Eyebrow", type: "text" },
  { key: "landing.neu_headline_a", page: "Neu", label: "Headline Teil 1", type: "text" },
  { key: "landing.neu_headline_b", page: "Neu", label: "Headline Teil 2 (kursiv)", type: "text" },
  { key: "landing.neu_subline", page: "Neu", label: "Unterzeile", type: "text" },

  // Welten (Mode/Interior/Kunst) — gemeinsame Vorlage
  { key: "world.mode.eyebrow", page: "Welt · Mode", label: "Eyebrow", type: "text" },
  { key: "world.mode.headline_a", page: "Welt · Mode", label: "Headline Teil 1", type: "text" },
  { key: "world.mode.headline_b", page: "Welt · Mode", label: "Headline Teil 2 (kursiv)", type: "text" },
  { key: "world.mode.intro", page: "Welt · Mode", label: "Einleitung", type: "text" },
  { key: "world_Mode_hero_image", page: "Welt · Mode", label: "Hero-Bild", type: "image" },
  { key: "world.interior.eyebrow", page: "Welt · Interior", label: "Eyebrow", type: "text" },
  { key: "world.interior.headline_a", page: "Welt · Interior", label: "Headline Teil 1", type: "text" },
  { key: "world.interior.headline_b", page: "Welt · Interior", label: "Headline Teil 2 (kursiv)", type: "text" },
  { key: "world.interior.intro", page: "Welt · Interior", label: "Einleitung", type: "text" },
  { key: "world_Interior_hero_image", page: "Welt · Interior", label: "Hero-Bild", type: "image" },
  { key: "world.kunst.eyebrow", page: "Welt · Kunst", label: "Eyebrow", type: "text" },
  { key: "world.kunst.headline_a", page: "Welt · Kunst", label: "Headline Teil 1", type: "text" },
  { key: "world.kunst.headline_b", page: "Welt · Kunst", label: "Headline Teil 2 (kursiv)", type: "text" },
  { key: "world.kunst.intro", page: "Welt · Kunst", label: "Einleitung", type: "text" },
  { key: "world_Kunst_hero_image", page: "Welt · Kunst", label: "Hero-Bild", type: "image" },
  { key: "world.category_all_label", page: "Welt (gemeinsam)", label: "Kategorie-Filter „Alles“", type: "text" },
  { key: "world.featured_eyebrow_prefix", page: "Welt (gemeinsam)", label: "Im Studio · Eyebrow-Präfix", type: "text" },
  { key: "world.featured_headline_suffix", page: "Welt (gemeinsam)", label: "Im Studio · Headline-Suffix (kursiv)", type: "text" },
  { key: "world.featured_cta", page: "Welt (gemeinsam)", label: "Im Studio · Link", type: "text" },
  { key: "world.grid_empty", page: "Welt (gemeinsam)", label: "Grid · Leerer Zustand", type: "text" },
  { key: "world.cta_body", page: "Welt (gemeinsam)", label: "Fuß-CTA · Text", type: "text" },
  { key: "world.cta_button", page: "Welt (gemeinsam)", label: "Fuß-CTA · Button", type: "text" },

  // Designer-Verzeichnis
  { key: "dindex_eyebrow", page: "Designer-Verzeichnis", label: "Eyebrow", type: "text" },
  { key: "dindex_headline_a", page: "Designer-Verzeichnis", label: "Headline Teil 1", type: "text" },
  { key: "dindex_headline_b", page: "Designer-Verzeichnis", label: "Headline Teil 2 (kursiv)", type: "text" },
  { key: "dindex_subline", page: "Designer-Verzeichnis", label: "Unterzeile", type: "multiline" },
  { key: "dindex_cta", page: "Designer-Verzeichnis", label: "Bewerben-Button", type: "text" },
  { key: "dindex_item_cta", page: "Designer-Verzeichnis", label: "Karten-Link „Zum Atelier“", type: "text" },

  // Bewerben (ApplyLanding)
  { key: "apply_hero_eyebrow", page: "Bewerben", label: "Hero · Eyebrow", type: "text" },
  { key: "apply_hero_word_a", page: "Bewerben", label: "Hero · Wort 1", type: "text" },
  { key: "apply_hero_word_b", page: "Bewerben", label: "Hero · Wort 2", type: "text" },
  { key: "apply_hero_subline", page: "Bewerben", label: "Hero · Unterzeile", type: "multiline" },
  { key: "apply_s1_title", page: "Bewerben", label: "Akt 1 · Titel", type: "text" },
  { key: "apply_s1_body", page: "Bewerben", label: "Akt 1 · Text", type: "multiline" },
  { key: "apply_s1_tagline", page: "Bewerben", label: "Akt 1 · Für-dich-Zeile", type: "text" },
  { key: "apply_s2_title", page: "Bewerben", label: "Akt 2 · Titel", type: "text" },
  { key: "apply_s2_body", page: "Bewerben", label: "Akt 2 · Text", type: "multiline" },
  { key: "apply_s2_tagline", page: "Bewerben", label: "Akt 2 · Für-dich-Zeile", type: "text" },
  { key: "apply_s3_title", page: "Bewerben", label: "Akt 3 · Titel", type: "text" },
  { key: "apply_s3_body", page: "Bewerben", label: "Akt 3 · Text", type: "multiline" },
  { key: "apply_s3_tagline", page: "Bewerben", label: "Akt 3 · Für-dich-Zeile", type: "text" },
  { key: "apply_s4_title", page: "Bewerben", label: "Akt 4 · Titel", type: "text" },
  { key: "apply_s4_body", page: "Bewerben", label: "Akt 4 · Text", type: "multiline" },
  { key: "apply_s4_tagline", page: "Bewerben", label: "Akt 4 · Für-dich-Zeile", type: "text" },
  { key: "apply_s5_title", page: "Bewerben", label: "Akt 5 · Titel", type: "text" },
  { key: "apply_s5_body", page: "Bewerben", label: "Akt 5 · Text", type: "multiline" },
  { key: "apply_s5_tagline", page: "Bewerben", label: "Akt 5 · Für-dich-Zeile", type: "text" },
  { key: "apply_fuer_dich_label", page: "Bewerben", label: "„Für dich“-Label", type: "text" },
  { key: "apply_flow_eyebrow", page: "Bewerben", label: "Ablauf · Eyebrow", type: "text" },
  { key: "apply_flow_headline_a", page: "Bewerben", label: "Ablauf · Headline Teil 1", type: "text" },
  { key: "apply_flow_headline_b", page: "Bewerben", label: "Ablauf · Headline Teil 2 (kursiv)", type: "text" },
  { key: "apply_flow_0_label", page: "Bewerben", label: "Ablauf · Schritt 1 Label", type: "text" },
  { key: "apply_flow_0_body", page: "Bewerben", label: "Ablauf · Schritt 1 Text", type: "text" },
  { key: "apply_flow_1_label", page: "Bewerben", label: "Ablauf · Schritt 2 Label", type: "text" },
  { key: "apply_flow_1_body", page: "Bewerben", label: "Ablauf · Schritt 2 Text", type: "text" },
  { key: "apply_flow_2_label", page: "Bewerben", label: "Ablauf · Schritt 3 Label", type: "text" },
  { key: "apply_flow_2_body", page: "Bewerben", label: "Ablauf · Schritt 3 Text", type: "text" },
  { key: "apply_flow_3_label", page: "Bewerben", label: "Ablauf · Schritt 4 Label", type: "text" },
  { key: "apply_flow_3_body", page: "Bewerben", label: "Ablauf · Schritt 4 Text", type: "text" },
  { key: "apply_cta_eyebrow", page: "Bewerben", label: "CTA · Eyebrow", type: "text" },
  { key: "apply_cta_headline_a", page: "Bewerben", label: "CTA · Headline Teil 1", type: "text" },
  { key: "apply_cta_headline_b", page: "Bewerben", label: "CTA · Headline Teil 2 (kursiv)", type: "text" },
  { key: "apply_cta_card_a", page: "Bewerben", label: "CTA · Karte Bewerben", type: "text" },
  { key: "apply_cta_card_b", page: "Bewerben", label: "CTA · Karte Ausstellung", type: "text" },
  { key: "apply_cta_footnote", page: "Bewerben", label: "CTA · Fußnote", type: "multiline" },

  // Plan-Seite (Studio)
  { key: "studio_plan.haus.headline", page: "Plan", label: "Haus · Zeile", type: "text" },
  { key: "studio_plan.haus.benefits", page: "Plan", label: "Haus · Vorteile (eine Zeile je Punkt)", type: "multiline" },
  { key: "studio_plan.atelier.headline", page: "Plan", label: "Atelier · Zeile", type: "text" },
  { key: "studio_plan.atelier.benefits", page: "Plan", label: "Atelier · Vorteile (eine Zeile je Punkt)", type: "multiline" },
  { key: "studio_plan.maison.headline", page: "Plan", label: "Maison · Zeile", type: "text" },
  { key: "studio_plan.maison.benefits", page: "Plan", label: "Maison · Vorteile (eine Zeile je Punkt)", type: "multiline" },

  // Funnel "Welches Haus bist du?"
  { key: "plan_funnel.heading", page: "Funnel", label: "Überschrift", type: "text" },
  { key: "plan_funnel.question_1", page: "Funnel", label: "Frage 1", type: "text" },
  { key: "plan_funnel.question_2", page: "Funnel", label: "Frage 2", type: "text" },
  { key: "plan_funnel.question_3", page: "Funnel", label: "Frage 3", type: "text" },
  { key: "plan_funnel.reason_haus", page: "Funnel", label: "Begründung · Haus", type: "text" },
  { key: "plan_funnel.reason_atelier", page: "Funnel", label: "Begründung · Atelier", type: "text" },
  { key: "plan_funnel.reason_maison", page: "Funnel", label: "Begründung · Maison", type: "text" },
  { key: "plan_funnel.apply_cta", page: "Funnel", label: "Button „Als Haus bewerben“", type: "text" },
  { key: "plan_funnel.reset_cta", page: "Funnel", label: "Button „Nochmal“", type: "text" },

  // Footer
  { key: "footer_line_1", page: "Footer", label: "Erste Zeile", type: "text" },
  { key: "footer_col_haeuser", page: "Footer", label: "Spalte 1 Titel", type: "text" },
  { key: "footer_col_fuer_sie", page: "Footer", label: "Spalte 2 Titel", type: "text" },
  { key: "footer_col_fuer_designer", page: "Footer", label: "Spalte 3 Titel", type: "text" },
  { key: "footer_col_haus", page: "Footer", label: "Spalte 4 Titel", type: "text" },
];

export const MISC_PAGE = "Sonstige";
