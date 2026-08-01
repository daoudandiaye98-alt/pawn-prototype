/**
 * Automatische Übersetzungsschicht (Teil 22b).
 *
 * Warum: Der weitaus größte Teil der Seite besteht aus fest im Code stehenden
 * deutschen Sätzen. Ein Wörterbuch von Hand wäre nicht pflegbar. Diese Schicht
 * sammelt stattdessen alle sichtbaren deutschen Textstellen, ersetzt bekannte
 * Sätze sofort aus dem Gedächtnis (`ui_translations`) und lässt unbekannte
 * einmalig übersetzen. Jeder Satz kostet also genau einmal etwas — danach nie wieder.
 *
 * Deutsch bleibt unangetastet: die Originale liegen in einer WeakMap und werden
 * beim Zurückschalten wiederhergestellt.
 */
import { supabase } from "@/integrations/supabase/client";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "CODE", "PRE", "SVG", "PATH"]);
const ATTRS = ["placeholder", "title", "aria-label"] as const;

/** Stabiler, kurzer Schlüssel für einen Satz (identisch in der Edge Function). */
export function textHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  let h2 = 52711;
  for (let i = input.length - 1; i >= 0; i--) h2 = ((h2 << 5) + h2 + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** Was nie übersetzt wird: Zahlen, Preise, Links, Kürzel, Wortmarke. */
function isTranslatable(raw: string): boolean {
  const s = norm(raw);
  if (s.length < 2 || s.length > 600) return false;
  if (!/[a-zA-ZäöüÄÖÜß]{2,}/.test(s)) return false;
  if (/^[\d\s.,€$%+\-–—:/]+$/.test(s)) return false;
  if (/^(https?:\/\/|www\.|[^\s@]+@[^\s@]+\.)/.test(s)) return false;
  if (/^(PAWN|DE|EN|OK)$/i.test(s)) return false;
  return true;
}

function skipNode(node: Node): boolean {
  let el: HTMLElement | null = node.parentElement;
  while (el) {
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.dataset?.noTranslate !== undefined) return true;
    if (el.getAttribute?.("translate") === "no") return true;
    if (el.isContentEditable) return true;
    el = el.parentElement;
  }
  return false;
}

const originalText = new WeakMap<Text, string>();
const originalAttr = new WeakMap<Element, Map<string, string>>();
const memory = new Map<string, string>(); // hash → englischer Text
const unknown = new Set<string>(); // deutsche Sätze ohne Übersetzung
const requested = new Set<string>(); // schon angefragt (kein Doppelversuch)

let active = false;
let applying = false;
let observer: MutationObserver | null = null;
let timer: number | null = null;

function collect(root: Node): { nodes: Text[]; attrs: Array<[Element, string, string]> } {
  const nodes: Text[] = [];
  const attrs: Array<[Element, string, string]> = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current: Node | null = walker.currentNode;
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      const t = current as Text;
      const base = originalText.get(t) ?? t.nodeValue ?? "";
      if (isTranslatable(base) && !skipNode(t)) nodes.push(t);
    } else if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element;
      if (!SKIP_TAGS.has(el.tagName) || el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        for (const attr of ATTRS) {
          const stored = originalAttr.get(el)?.get(attr);
          const val = stored ?? el.getAttribute(attr) ?? "";
          if (isTranslatable(val)) attrs.push([el, attr, val]);
        }
      }
    }
    current = walker.nextNode();
  }
  return { nodes, attrs };
}

function apply(root: Node): void {
  const { nodes, attrs } = collect(root);
  applying = true;
  for (const node of nodes) {
    const base = originalText.get(node) ?? node.nodeValue ?? "";
    const key = norm(base);
    const en = memory.get(textHash(key));
    if (!originalText.has(node)) originalText.set(node, base);
    if (en) {
      // Führende/abschließende Leerzeichen des Originals erhalten (Inline-Layout).
      const lead = base.match(/^\s*/)?.[0] ?? "";
      const tail = base.match(/\s*$/)?.[0] ?? "";
      if (node.nodeValue !== lead + en + tail) node.nodeValue = lead + en + tail;
    } else if (!requested.has(key)) {
      unknown.add(key);
    }
  }
  for (const [el, attr, base] of attrs) {
    const key = norm(base);
    let store = originalAttr.get(el);
    if (!store) { store = new Map(); originalAttr.set(el, store); }
    if (!store.has(attr)) store.set(attr, base);
    const en = memory.get(textHash(key));
    if (en) { if (el.getAttribute(attr) !== en) el.setAttribute(attr, en); }
    else if (!requested.has(key)) unknown.add(key);
  }
  applying = false;
  if (unknown.size > 0) void resolveUnknown();
}

/** Erst im Gedächtnis nachsehen, nur echte Lücken übersetzen lassen. */
async function resolveUnknown(): Promise<void> {
  const batch = Array.from(unknown).slice(0, 60);
  if (batch.length === 0) return;
  batch.forEach((t) => { unknown.delete(t); requested.add(t); });

  const hashes = batch.map(textHash);
  try {
    const { data } = await supabase.from("ui_translations").select("hash, en").in("hash", hashes);
    (data ?? []).forEach((row) => { if (row.hash && row.en) memory.set(row.hash, row.en); });
  } catch { /* Gedächtnis nicht erreichbar — dann eben nur über die Funktion */ }

  const missing = batch.filter((t) => !memory.has(textHash(t)));
  if (missing.length > 0) {
    try {
      const { data, error } = await supabase.functions.invoke("translate-batch", { body: { texts: missing } });
      const map = (data as { translations?: Record<string, string> } | null)?.translations;
      if (!error && map) for (const [de, en] of Object.entries(map)) if (en) memory.set(textHash(de), en);
    } catch { /* still bleiben — Deutsch ist ein akzeptabler Rückfall */ }
  }
  if (active) apply(document.body);
}

function schedule(): void {
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(() => { timer = null; if (active) apply(document.body); }, 150);
}

/** Alles zurück auf Deutsch. */
function restore(): void {
  applying = true;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current: Node | null = walker.currentNode;
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      const t = current as Text;
      const orig = originalText.get(t);
      if (orig !== undefined && t.nodeValue !== orig) t.nodeValue = orig;
    } else if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element;
      const store = originalAttr.get(el);
      if (store) for (const [attr, val] of store) el.setAttribute(attr, val);
    }
    current = walker.nextNode();
  }
  applying = false;
}

/** Bestehende Handübersetzungen haben Vorrang. */
export function seedMemory(pairs: Array<[string, string]>): void {
  for (const [de, en] of pairs) {
    const key = norm(de);
    if (key && en) memory.set(textHash(key), en);
  }
}

export function startAutoTranslate(): void {
  if (active || typeof document === "undefined") return;
  active = true;
  apply(document.body);
  observer = new MutationObserver((records) => {
    if (applying) return;
    if (records.length > 0) schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
}

export function stopAutoTranslate(): void {
  if (!active) return;
  active = false;
  observer?.disconnect();
  observer = null;
  if (timer !== null) { window.clearTimeout(timer); timer = null; }
  restore();
}
