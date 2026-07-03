# PAWN — Designer Application Pipeline · Architektur- und Planungsbericht

Reiner Analysebericht. Nichts wird implementiert. Alle folgenden Aussagen basieren auf dem aktuellen Codestand (`src/pages/Apply.tsx`, `src/pages/portal/*`, `src/features/access/RoleGate.tsx`, `src/lib/auth.tsx`, den Admin-Seiten sowie den 4 Migrationen in `supabase/migrations/`).

---

## I. Einstieg — wie ein Designer heute zur Bewerbung findet

**Route:** `/apply` → Komponente `src/pages/Apply.tsx`
**Einstiegspunkte:** aktuell nur eine harte Verlinkung von `/designers`. Kein Link im `PublicHeader`, kein CTA auf `/`.

**Vier Schritte** (rein Frontend-State, `useState`):
1. Konto — `fullName`, `email`, `password`
2. Profil — `brandName`, Location, plus 2 `UploadField`-Placeholder (nicht funktional)
3. Über dich — `website`, `instagram`, `story`, `tags`, `production`
4. Bestätigung — Review-Liste, Submit-Button

**Was beim Submit passiert:**
```ts
function submit(e) {
  e.preventDefault();
  setSubmitted(true);   // rendert SuccessState. Nichts wird gespeichert.
}
```

**Konsequenzen:**
- Kein `supabase.auth.signUp` → kein User wird angelegt.
- Kein Insert in irgendeine Tabelle.
- Die zwei Upload-Buttons sind reine Dummies (`<button>` ohne Handler, kein Storage-Bucket).
- Nach Reload ist die Bewerbung verloren.
- Der `SuccessState` verlinkt auf `/portal`, obwohl der Bewerber weder Konto noch Rolle hat — funktioniert nur, weil `RoleGate` unauthentifizierte Besucher als Prototyp durchlässt.

**Fehlende Felder für ein tragfähiges Bewerbungsprofil:**
- Rechtliches: Firmen-/Rechtsname, Sitzland, Steuer-ID (für spätere Auszahlungen)
- Kontakt: Telefon, bevorzugte Sprache
- Substanz: Portfolio-Uploads (mind. 5 Werke), Preisspanne, Produktionskapazität, Lieferzeiten
- Nachhaltigkeit / Herkunftsangaben (Marktdifferenzierer)
- Referenzen (Presse, bisherige Verkaufsstellen)
- Consent auf die Angebotsseite (siehe II)

---

## II. Vertrags- und Angebotsseite — Consent

**Aktuell:** Die Angebotsversprechen (Gewinnbeteiligung, AI-Marketing, Plattform-Vorteile) existieren im UI-Text — z.B. der linke Panel-Text und die drei Zeilen unten in `Apply.tsx`. Es gibt **keine Checkbox**, kein explizites Accept, keine Version, keine Signatur, keine Speicherung.

Ein Bewerber kann heute keinerlei Nachweis erbringen, welchen Vertragstext er wann akzeptiert hat.

**Wie das robust aufgebaut würde (Vorschlag, nicht umgesetzt):**

Zwei Tabellen, versionierte Verträge:

```text
contract_versions
  id, kind ('designer_terms' | 'ai_marketing' | 'commission'),
  version (int), body_markdown, effective_from, effective_to, checksum

designer_consents
  id, application_id, contract_version_id,
  accepted_at, ip, user_agent, checksum_at_accept
```

Regeln:
- Vertragstext ist eine unveränderliche Version. Änderungen erzeugen eine neue `version`.
- Beim Submit wird für jeden aktiven Vertrag genau ein `designer_consents`-Zeile geschrieben — mit dem `checksum` des Textes zu diesem Zeitpunkt (verhindert stille Nachbesserungen).
- RLS: Bewerber sieht nur seine eigenen Consents, Admin alle.
- Im Ereignis-Log zusätzlich `designer.consent_accepted` als `domain_event` (siehe III), sodass die Zustimmung auch im Kausalstrom auftaucht.

Für PAWN wichtig: die Angebotsversprechen (**Umsatzbeteiligung, AI-Marketing kostenlos, exklusive Reichweite**) sollten als eigenständige `contract_versions.kind`-Einträge modelliert werden, sodass jedes Versprechen einzeln akzeptiert wird und einzeln geändert werden kann, ohne alte Bewerber ungültig zu machen.

---

## III. Backend Flow — heute vs. Ziel

**Vorhandene Tabellen** (aus `supabase-tables`):

| Tabelle | Rolle in der Bewerbungsstrecke |
|---|---|
| `profiles` | wird bei Signup via `handle_new_user`-Trigger angelegt (nur `display_name`) |
| `user_roles` | Trigger vergibt automatisch `'customer'`. **Kein `'designer_applicant'` oder Ähnliches.** |
| `domain_events` | Event-Store mit Role-Allowlist (`enforce_event_role_allowlist`). `designer.approved` / `designer.rejected` sind bereits als **admin-only** Event-Typen deklariert. Es gibt aber keinen Event-Typ für **Antrag gestellt**. |
| `domain_snapshots` | Snapshots des Event-Streams — nicht bewerbungs-spezifisch. |
| `ai_logs` | AI-Aufrufe — nicht bewerbungs-spezifisch. |

**Was heute im Backend passiert, wenn jemand `/apply` abschickt:** nichts. Es existiert kein Insert, kein Auth-Signup, kein Storage-Upload, kein Event.

**Zielbild des Datenflusses:**

```text
Designer öffnet /apply
   │
Formular (mehrstufig, mit Uploads)
   │
Frontend State (Zod-validiert, Dateien im Speicher)
   │  supabase.auth.signUp({ email, password, data: { display_name, intent: 'designer' }})
   │  → handle_new_user legt profile + user_roles('customer') an
   │  → zusätzlicher Insert in user_roles: 'designer_applicant'
   │
Storage-Bucket 'designer-applications/{user_id}/'
   │  Profil-Bild, Banner, Portfolio-Dateien
   │
Insert in public.designer_applications
   │  siehe Schema unten
   │
Insert in public.designer_consents  (pro akzeptierter contract_versions)
   │
Insert in public.domain_events  (type = 'designer.application_submitted', actor = user_id)
   │
Admin sieht Antrag in /admin/designers/applications
   │
Admin drückt Freigabe
   │
  Insert domain_events(type='designer.approved', actor='system' via admin)
  RPC public.approve_designer(application_id):
    - update designer_applications.status = 'approved'
    - insert user_roles(user_id, 'designer')
    - delete user_roles(user_id, 'designer_applicant')
    - insert public.designers  (Marktplatz-Projektion)
    - trigger optional: welcome-Mail + AI-Onboarding-Slot anlegen
   │
Designer landet beim nächsten Login in /portal
   → RoleGate('designer') greift
   → statt Studio-Dashboard: AI-Onboarding startet (siehe VI)
```

**Zusätzliche Tabelle (Vorschlag):**

```text
designer_applications
  id (uuid, PK)
  user_id (uuid, FK auth.users)
  brand_name, legal_name, location, country
  website, instagram
  story (text)
  tags (text[])
  production_status
  portfolio_urls (text[] — Storage-Pfade)
  banner_url, avatar_url
  status ('draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'archived')
  submitted_at, reviewed_at
  admin_notes (text)              -- interne Notizen
  rejection_reason (text)
  ai_review_summary (jsonb)       -- optionale AI-Vorbewertung
```

RLS-Skizze:
- Bewerber: `select` und `update` (nur solange `status = 'draft'`) auf eigene Zeile.
- Admin: voller Zugriff, plus Schreibrecht auf `admin_notes` / `status` / `rejection_reason`.
- `service_role`: `all` für Edge Functions.

**Beziehungen:**
- `designer_applications.user_id → auth.users.id`
- `designer_consents.application_id → designer_applications.id`
- `designer_consents.contract_version_id → contract_versions.id`
- Nach Approval: `designers.user_id → auth.users.id` (heute existiert `designers` nur im Core-Seed, nicht in Postgres — siehe VIII).

---

## IV. Admin Workflow — was heute möglich ist

**Existierender Zugang:** `/admin` (AdminOverview), `/admin/dna`, `/admin/products`, `/admin/ai`. Es gibt **keine** `/admin/designers`-Route.

Im `AdminOverview`-Cockpit gibt es zwei Referenzen auf Bewerbungen:
- KPI-Karte „Aktive Designer" mit Untertitel „18 warten auf Review" — hartcodiert.
- Attention-Zeile „18 Designer warten auf Freigabe" mit Button `Freigeben`, der eine **rein visuelle** `designer.approve`-Aktion in den lokalen `useOsBus` feuert (kein DB-Effekt, kein Event im echten `domain_events`-Log).

**Als Gründer kannst du heute konkret:**

| Fähigkeit | Status |
|---|---|
| alle Bewerbungen sehen | ✗ keine Tabelle, keine Liste |
| filtern / sortieren | ✗ |
| Bewerbung öffnen | ✗ kein Detail-View |
| Notizen hinterlegen | ✗ |
| annehmen | ✗ (nur visuelle Simulation im OS-Bus) |
| ablehnen | ✗ |
| archivieren | ✗ |
| Bewerbungshistorie einsehen | ✗ |

**Empfohlener Admin-Workflow (Vorschlag):**

```text
/admin/designers  (Inbox)
├── Tabs: Neu · In Prüfung · Angenommen · Abgelehnt · Archiviert
├── Filter: Land, Kategorie, Datum, "wartet > 3 Tage"
├── Sortierung: Datum, DNA-Match-Score (später), zufällig
└── Zeile → Detail-Drawer:
      ├── Portfolio-Galerie (Storage-URLs)
      ├── Bewerbungsdaten (alle Felder aus III)
      ├── Consent-Status (welche Verträge, welche Version, wann)
      ├── Admin-Notizen (append-only, mit Autor + Zeitstempel)
      ├── Aktionen: [Ablehnen mit Grund] [Annehmen] [Archivieren] [Notiz]
      └── AI-Vorbewertung (optional, siehe VI)
```

Jede Aktion erzeugt ein `domain_event` (`designer.approved` / `designer.rejected` / `designer.archived` / `designer.note_added`), sodass die komplette Governance rekonstruierbar bleibt — dafür ist der Event-Store bereits vorhanden und mit Role-Allowlist geschützt.

---

## V. Nach der Annahme — Rollen-, Permission- und Datenwechsel

**Heute:** passiert nichts, weil keine Bewerbung persistent ist.

**Zielbild:** Eine einzige Server-Function `public.approve_designer(application_id uuid)` als `SECURITY DEFINER`, admin-only, die atomar:

1. `user_roles`: entfernt `'designer_applicant'`, fügt `'designer'` hinzu. `'customer'` bleibt erhalten (Designer soll auch als Kunde einkaufen können).
2. `designer_applications.status = 'approved'`, `reviewed_at = now()`.
3. Materialisiert das Designer-Profil in eine echte `public.designers`-Tabelle (existiert heute nicht in Postgres, siehe VIII).
4. Legt eine `designer_onboarding_sessions`-Zeile an (Status `pending`), damit der Designer beim nächsten Login das AI-Interview startet und **nicht** das Studio-Dashboard sieht.
5. Schreibt `domain_events(type='designer.approved', actor=<admin user_id>, payload={ application_id, designer_id })`.
6. Optional: triggert Welcome-Mail via Edge Function.

**Effekt auf UI:**
- `RoleGate('designer')` greift ab jetzt echt. `/portal` wird geschützter Bereich.
- `PortalOverview` liest `designer_onboarding_sessions.status`: `pending` → Onboarding-Screen, `complete` → Studio-Dashboard.
- Header zeigt Designer-Umschalter (Studio vs. Kundenmodus).

**Ereignisse, die dabei entstehen:**
- `designer.application_submitted` (bei Submit)
- `designer.reviewed` (wenn Admin öffnet)
- `designer.note_added` (jede Notiz)
- `designer.approved` / `designer.rejected` / `designer.archived`
- `designer.onboarding_started` (beim ersten Portal-Besuch nach Approval)
- `designer.onboarding_completed`

Alle sind über die vorhandene `enforce_event_role_allowlist`-Funktion absicherbar — sie muss nur um diese Typen erweitert werden.

---

## VI. AI-Onboarding — Interview-basierte Brand-DNA-Erzeugung

**Aktueller Stand:** existiert nicht. Nach erfolgreicher (heute simulierter) Bewerbung führt `/portal` direkt zum Studio-Dashboard.

**Architektonischer Einbau (Vorschlag):**

**Datenmodell:**
```text
designer_onboarding_sessions
  id, designer_id, status ('pending'|'in_progress'|'complete'),
  started_at, completed_at, transcript (jsonb)

designer_brand_dna
  designer_id (PK),
  brand_dna (jsonb)       -- was steht die Marke für, Emotion, Zielgruppe
  brand_voice (jsonb)     -- Ton, verbotene Wörter, Beispielsätze
  marketing_dna (jsonb)   -- Kanäle, Frequenz, Format-Präferenzen
  audience_profile (jsonb)
  color_palette (jsonb)   -- inkl. verbotene Farben
  storytelling (jsonb)
  campaign_style (jsonb)
  prompt_library (jsonb)  -- generierte Text/Bild/Video-Prompt-Templates
  version, generated_at
```

**Flow:**

```text
1. Designer landet nach Approval auf /portal
2. RoleGate('designer') OK → PortalGateway prüft onboarding.status
3. 'pending' → /portal/onboarding
   ├── AI-Chat mit fest strukturierter Fragefolge (state machine)
   │     Wofür steht deine Marke? / Emotion? / Inspirationen? /
   │     Zielgruppe? / verbotene Farben? / Materialien? /
   │     Musik? / Filme? / Architektur?
   ├── Jede Antwort → append zu session.transcript
   └── Session-Events als domain_events (ai.interview.turn)
4. Nach letzter Frage: Edge Function synthesize_brand_dna
   ├── ruft Lovable AI Gateway (LOVABLE_API_KEY vorhanden)
   ├── produziert die 8 Bausteine oben in einem Zug (JSON)
   ├── schreibt sie in designer_brand_dna
   └── Event ai.brand_dna_generated (cause = session_id)
5. Designer bekommt "Kuratier deine DNA"-Screen:
   jeder Baustein einzeln bearbeitbar, ein "Ratify"-Button
   → ratifiziert wandert die DNA in den Status 'active'
   → session.status = 'complete', Studio-Dashboard freigeschaltet
```

**Warum diese Architektur passt:**
- Deckt sich mit dem vorhandenen **DNA-Evolution-Muster** (proposal → ratification, siehe `src/core/policies/dnaEvolution.ts`) — hier: AI proposes, Designer ratifies.
- Alles läuft über den Event-Store, damit später jede Kampagne rückverfolgt werden kann bis zum ursprünglichen Interview-Turn.
- `LOVABLE_API_KEY` ist bereits als Secret gesetzt → keine neue Kreditbarriere.
- `ai_logs` (existiert) nimmt Request/Response-Log auf.

---

## VII. AI Marketing Pipeline — Systemarchitektur

**Grobe Architektur ohne Implementierung, in Anlehnung an das Event-Sourcing-Prinzip von PAWN:**

```text
┌── Trigger ────────────────────────────────────────────┐
│  product.registered   (Designer lädt Produkt hoch)    │
│  brand_dna.ratified   (nach VI)                       │
│  campaign.scheduled   (manuell oder Cron)             │
└─────────────────────────────────┬────────────────────┘
                                  ▼
┌── Analyse-Worker (Edge Function) ─────────────────────┐
│  1. product-vision      → Bilder analysieren          │
│                           (Farben, Silhouette, Tags)  │
│  2. dna-merge           → Produkt-Tags + brand_dna    │
│                           → creative_brief (jsonb)    │
└─────────────────────────────────┬────────────────────┘
                                  ▼
┌── Prompt-Generator ───────────────────────────────────┐
│  aus creative_brief + prompt_library                  │
│  erzeugt N Varianten pro Kanal                        │
│  (IG-Reel, TikTok, Pinterest-Pin, YT-Short)           │
│  → Insert campaigns / campaign_variants               │
└─────────────────────────────────┬────────────────────┘
                                  ▼
┌── Media-Generator (Video-AI) ─────────────────────────┐
│  pro Variante → Video/Bild rendern                    │
│  → Storage-Bucket 'campaigns/{designer}/{campaign}/'  │
│  → variant.status = 'rendered'                        │
└─────────────────────────────────┬────────────────────┘
                                  ▼
┌── Auto-Bewertung ─────────────────────────────────────┐
│  score = f(brand_alignment, technical_quality,        │
│           predicted_ctr, policy_compliance)           │
│  → variant.score, variant.rejection_reasons           │
│  Top-K werden in "Designer-Freigabe-Inbox" gelegt.    │
└─────────────────────────────────┬────────────────────┘
                                  ▼
┌── Designer Approval Loop ─────────────────────────────┐
│  /portal/marketing/inbox                              │
│  Designer: Approve / Tweak-Prompt / Reject            │
│  → campaign.status = 'approved'                       │
└─────────────────────────────────┬────────────────────┘
                                  ▼
┌── Channel-Publisher (Plugin-Runtime) ─────────────────┐
│  Instagram · TikTok · Pinterest · YT Shorts           │
│  jede Plattform als eigenes Plugin (Plugin-Registry   │
│  existiert bereits, siehe reducers/plugin.ts)         │
│  Publish → external_post_id gespeichert               │
└─────────────────────────────────┬────────────────────┘
                                  ▼
┌── Performance-Feedback ───────────────────────────────┐
│  Webhook / Poll pro Plattform                         │
│  → campaign_metrics (impressions, ctr, saves, sales)  │
│  → Event campaign.metric_recorded                     │
└─────────────────────────────────┬────────────────────┘
                                  ▼
┌── Learning Loop ──────────────────────────────────────┐
│  Nightly-Job: metrics + variant.score → update        │
│  prompt_library.weight, dna.affinity                  │
│  → nächste Kampagne startet klüger                    │
└───────────────────────────────────────────────────────┘
```

**Passt gut zur bestehenden Architektur, weil:**
- Der Event-Store trägt bereits `plugin.enabled`/`ai.tool_enabled`-Events — Publishing-Plattformen sind einfach neue Plugins.
- `PromptVersion`-Entity existiert im Core → `prompt_library` ist deren produktionsreife Form.
- `Provenance` (siehe `src/core/types/provenance.ts`) ist schon dafür gebaut, jede Empfehlung zu ihrer Ursache zu tracen — das ist exakt das, was du für „warum wurde diese Kampagne so gebaut?" brauchst.

**Neue Tabellen (Skizze):**
```text
campaigns(id, designer_id, product_id, brief, status, created_at)
campaign_variants(id, campaign_id, channel, prompt, media_url, score, status, external_post_id, published_at)
campaign_metrics(id, variant_id, at, impressions, clicks, saves, sales, revenue)
prompt_library(id, designer_id, kind, template, weight, updated_at)
```

---

## VIII. Fehlende Bausteine — priorisiert

### 1 · Kritisch (ohne diese ist die Strecke nicht funktionsfähig)

1. **Persistenz der Bewerbung.** `designer_applications`-Tabelle + RLS + Storage-Bucket für Uploads. Ohne das ist `/apply` ein Placebo.
2. **Auth-Signup im Submit.** `Apply.tsx` muss `supabase.auth.signUp` aufrufen; Trigger `handle_new_user` erweitern, dass er bei `intent = 'designer'` zusätzlich `user_roles('designer_applicant')` setzt.
3. **Consent-System.** `contract_versions` + `designer_consents`. Pflicht für Rechtssicherheit (Umsatzbeteiligung, AI-Nutzung).
4. **Admin-Bewerbungs-Inbox** unter `/admin/designers/applications` mit Detail-Drawer, Notizen und den Aktionen Annehmen/Ablehnen/Archivieren.
5. **`approve_designer`-Function** (SECURITY DEFINER, admin-only). Atomarer Rollenwechsel + Projektion.
6. **`public.designers`-Tabelle** als echte Projektion — heute existieren Designer nur im Core-Seed (`src/core/seed/designers.ts`), nicht in Postgres. Ohne diese Tabelle kann `/designer/:slug` nicht öffentlich aus DB gerendert werden.
7. **Event-Typen erweitern** (`designer.application_submitted`, `designer.reviewed`, `designer.note_added`, `designer.archived`) + Allowlist in `enforce_event_role_allowlist`.

### 2 · Wichtig (nächste Ausbaustufe)

8. **AI-Onboarding-Modul** (`/portal/onboarding` + `designer_onboarding_sessions` + `designer_brand_dna` + Edge Function `synthesize_brand_dna`).
9. **Portal-Gate** (`PortalGateway`), das `onboarding.status` liest und Studio erst nach `complete` freigibt.
10. **Rejection-/Notification-Flow.** Bewerber muss per Mail erfahren, was passiert ist. Edge Function + Mail-Provider (`RESEND_API_KEY` oder ähnlich, muss neu hinzugefügt werden).
11. **Bewerbungsentwurf speichern.** `status = 'draft'` mit Auto-Save alle 5s. Verhindert Verlust bei einer 4-Step-Strecke.
12. **Sichtbare Einstiegspunkte:** Link im `PublicHeader` („Für Designer") und CTA auf `/designers`.
13. **Uploads real machen:** Storage-Bucket `designer-applications` mit RLS (owner read/write bis Approval, Admin read all).

### 3 · Nice to have (später)

14. **AI-Vorbewertung der Bewerbung** — Score für Passung, Auffälligkeiten, Empfehlungen an den Admin.
15. **Reviewer-Zuweisung** (mehrere Admins, Zuständigkeiten).
16. **Öffentliche Statusseite** für Bewerber: „Deine Bewerbung ist in Prüfung, geschätzt noch 3 Tage."
17. **Analytics** auf der Bewerbungs-Funnel-Ebene: wie viele erreichen Step 4, wo brechen sie ab.
18. **AI Marketing Pipeline** (VII) — kompletter Ausbau als eigenes Modul.
19. **A/B-Test-Framework** für Vertragsversprechen (welche Kombination konvertiert am besten).
20. **Multi-Language** für den Bewerbungsprozess.

---

## Wo wir stehen — in einem Satz

Es gibt ein hübsches Bewerbungsformular ohne Backend, einen Portal-Bereich ohne Onboarding, einen Admin-Bereich ohne Bewerbungsansicht, einen Event-Store, der bereits die richtigen Event-Typen kennt aber niemand feuert sie, und ein Rollen-System, das robust genug ist, um darauf aufzubauen — sobald die kritischen 7 Bausteine oben sitzen.

**Nächster empfohlener Schritt** (nach deiner Freigabe): mit Baustein 1–3 (Persistenz + Auth-Signup + Consent) in *einer* Migration + einem Apply-Formular-Rewrite anfangen. Alles andere baut darauf auf.