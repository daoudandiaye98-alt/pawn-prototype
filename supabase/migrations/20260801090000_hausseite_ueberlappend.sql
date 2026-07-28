-- Teil 15b: neuer Baustein "Überlappend" (zwei versetzte Medien) für variable Räume.
-- Additive Erweiterung des bestehenden Enums — bestehende Werte bleiben unangetastet.
alter type public.page_block_kind add value if not exists 'ueberlappend';
