-- Teil 38 AP6 — Mini-PAWNs: das bestehende Automatik-Framework (designer_automations,
-- Teil 28c) bekommt vier neue, pro Haus schaltbare Organe statt einer eigenen neuen
-- house_settings.organe-Struktur (Wiederverwendungsprinzip — ein Framework für "welche
-- Automatik läuft für dieses Haus" reicht). 'sichtbarkeitszug' migriert dabei nur das bereits
-- bestehende Verhalten aus runMaisonSichtbarkeitszug in den Schalter-Rahmen (Rückwärtskompatibel:
-- fehlt die Zeile, gilt es weiterhin als an). 'presse'/'verstaerker_haus' sind neue, zusätzliche
-- Organe. 'impuls' bleibt rein informativ gelistet — der wochenimpuls aus Teil 38 AP2 bleibt
-- plattformweit/kostenlos und bekommt hier keinen eigenen Schalter.

alter table public.designer_automations drop constraint if exists designer_automations_automation_key_check;

alter table public.designer_automations add constraint designer_automations_automation_key_check
  check (automation_key in (
    'inszenieren_bei_upload', 'caption_nach_inszenierung', 'aufraeumen_woechentlich', 'sharekit_bei_live',
    'sichtbarkeitszug', 'presse', 'verstaerker_haus', 'impuls'
  ));
