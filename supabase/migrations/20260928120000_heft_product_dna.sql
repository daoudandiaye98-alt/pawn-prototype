-- Teil H — das Heft. Quelle dieser Datei: src/heft03/sql/04_product_dna_heft.sql
-- Dort steht sie als Vertrag des Hefts; hier steht sie als Migration.
-- Wer eine aendert, aendert beide — sonst laeuft der Vertrag von der Datenbank weg.
-- Anwenden NUR ueber den Lovable-Agenten, nie von Hand im Dashboard (CLAUDE.md).

-- product_dna.heft — keine Schemaänderung, eine Konvention.
-- Das Heft liest aus products.product_dna zusätzlich den Schlüssel "heft":
--   {"heft": {"cutout_url": "<transparente Fassung des Werks (webp)>", "hoehe": 3.0, "notiz": "Kuratorenzeile unter dem Stück"}}
-- cutout_url: freigestellt (Hintergrund entfernt). Ohne cutout_url steht das Werk als Fotokarte auf der Bühne.
-- hoehe: Standhöhe in Szeneneinheiten (1,2–3,4); fehlt sie, rechnet das Heft height_cm/60, sonst Weltstandard.
-- notiz: fällt auf designer_note zurück.
--
-- Optionaler Schutz, damit das Studio keinen Unsinn speichert:
alter table public.products drop constraint if exists products_product_dna_heft_check;
alter table public.products add constraint products_product_dna_heft_check check (
  product_dna is null
  or not (product_dna ? 'heft')
  or (
    jsonb_typeof(product_dna->'heft') = 'object'
    and (not (product_dna->'heft' ? 'hoehe') or (product_dna->'heft'->>'hoehe')::numeric between 1.2 and 3.4)
  )
);
