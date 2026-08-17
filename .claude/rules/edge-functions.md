---
paths:
  - "supabase/functions/**"
  - "supabase/migrations/**"
---

# Du fasst gerade etwas an, das nicht über Git live geht

Diese Regel lädt **nur**, wenn eine Datei unter `supabase/` im Kontext ist. Am
Sitzungsstart kostet sie nichts.

## Die eine Sache, die du nicht tun kannst

Du darfst diesen Code **ändern**. Du kannst ihn **nicht ausliefern**.

Edge Functions und Migrationen gehen ausschließlich über den Lovable-Agenten,
und das kostet Guthaben. Daoudas Budget ist knapp und genau dafür reserviert.
Ein eigener Deploy-Versuch ist immer falsch — auch wenn ein Werkzeug dafür
verfügbar aussieht.

**Nach jeder Änderung hier gehört dieser Satz in den Bericht, wörtlich:**

> Daouda: hier ist ein Lovable-Deploy nötig. Geänderte Funktionen: `…`.
> Ohne diesen Deploy läuft weiterhin die alte Fassung.

## Die Reihenfolge kippt hier

**Migration vor Code.** Immer. Geht der Code zuerst live, redet er mit einer
Tabelle, die es noch nicht gibt.

Belegt: `61e0204` musste ausdrücklich warnen — *„Migration muss VOR dem
Live-Gang dieses Codes ausgeführt werden, sonst liefern neue Uploads 400 auf dem
noch privaten Bucket."*

Und die Zwischenzeit ist echt: zwischen Merge und Lovable-Deploy läuft das neue
Frontend gegen die **alte** Funktion. Überlebt es das nicht, wird erst deployt
und dann gemerged.

## Migrationen sind nicht rücknehmbar

- Nur nach ausdrücklichem Auftrag schreiben.
- **Nie** eine bestehende Migration löschen oder ändern. `wache.sh` blockiert
  das mechanisch.
- Der Rückweg ist immer eine **zweite** Migration.
- Der Zeitstempel im Dateinamen muss hinter der zuletzt angewandten liegen,
  sonst wird sie nie ausgeführt.
- RLS-Policies und Trigger nur nach ausdrücklichem Auftrag anfassen.

## Zwei Fallen in diesem Repo

1. **`create-checkout` bekommt keinen `automatic_payment_methods`-Parameter.**
2. **Die Connect-Sperre muss greifen:** ohne `stripe_charges_enabled` blockiert
   `create-checkout` den Kauf freundlich. Ausnahme sind nur Häuser, die einem
   Admin gehören. Ein Checkout = ein Haus.

PAWN ist live und nimmt echte Zahlungen. Der ganze Ablauf steht im Skill
`deploy-choreografie`.
