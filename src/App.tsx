import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { captureReferralCode } from "@/features/referral";
import { captureLeadRef } from "@/features/acquisition/leadAttribution";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/store/cart";
import { CoreProvider } from "@/core";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { RoomShiftProvider } from "@/features/os/roomShift";
import { PersonalizationProvider } from "@/features/personalization";
import { ConsentProvider } from "@/lib/consent";
import { ConsentBanner } from "@/components/palace/ConsentBanner";
import { CopilotProvider } from "@/components/pawn/CopilotDrawer";
import { lazy, Suspense } from "react";
import { istHeftAdresse } from "@/heft03/adressen";

/*
 * Teil H — das Heft ist das oeffentliche Frontend. EINE Komponente fuer alle
 * Heft-Adressen: der Router bildet Adresse auf Doppelseite ab, statt Adresse auf
 * Seitenkomponente. Deshalb steht unten mehrfach dasselbe Element und kein Dutzend
 * Seiten.
 *
 * Eigenes Buendel: wer nur die Rechtstexte oder das Studio oeffnet, laedt den
 * Wendel, Three.js und die Bilder des Hefts nie.
 */
const HeftRoute03 = lazy(() => import("@/heft03/HeftRoute03"));

/*
 * Die 404 zeichnet ihre Figur mit Three.js. Fest eingebunden lag diese Bibliothek im
 * Haupt-Buendel — jeder Besucher lud sie fuer eine Seite, die fast niemand sieht.
 * Gemessen am 10.09.2026: index.js 2.678 kB mit, 2.077 kB ohne. Als eigenes Buendel
 * kostet die 404 eine Anfrage mehr und alle anderen Seiten 600 kB weniger.
 */
const NotFoundLazy = lazy(() => import("./pages/NotFound.tsx"));
const NotFound = () => (
  <Suspense fallback={null}>
    <NotFoundLazy />
  </Suspense>
);
const Heft = () => (
  <Suspense fallback={null}>
    <HeftRoute03 />
  </Suspense>
);

/**
 * Die Einwilligungsleiste steht nur ausserhalb des Hefts. Im Heft fragt PAWN selbst,
 * genau dann, wenn es zum ersten Mal etwas zu merken gaebe — zwei Dialoge zur selben
 * Frage waeren einer zu viel.
 */
/* Zwei Umzuege tragen einen Abschnitt mit — sie brauchen darum eine eigene Zeile
   statt eines festen Ziels. Serverseitig macht dasselbe die 301-Regel aus routen.js. */
function WerkUmzug() {
  const { slug } = useParams();
  return <Navigate to={`/werk/${slug}`} replace />;
}
function HausUmzug() {
  const { slug } = useParams();
  return <Navigate to={`/haus/${slug}`} replace />;
}

function EinwilligungAusserhalbDesHefts() {
  const { pathname } = useLocation();
  return istHeftAdresse(pathname) ? null : <ConsentBanner />;
}

const AdminContent = lazy(() => import("./pages/admin/AdminContent.tsx"));
const AdminWerbung = lazy(() => import("./pages/admin/AdminWerbung.tsx"));
const AdminAktionen = lazy(() => import("./pages/admin/AdminAktionen.tsx"));
const AdminBegleiter = lazy(() => import("./pages/admin/AdminBegleiter.tsx"));
const AdminArchetypen = lazy(() => import("./pages/admin/AdminArchetypen.tsx"));


const Preise = lazy(() => import("./pages/Preise.tsx"));
const PreiseMaison = lazy(() => import("./pages/PreiseMaison.tsx"));
const Apply = lazy(() => import("./pages/Apply.tsx"));
const Start = lazy(() => import("./pages/Start.tsx"));
const Einladung = lazy(() => import("./pages/Einladung.tsx"));
const Datenschutz = lazy(() => import("./pages/Datenschutz.tsx"));
const Impressum = lazy(() => import("./pages/Impressum.tsx"));
const Versand = lazy(() => import("./pages/Versand.tsx"));
const AGB = lazy(() => import("./pages/AGB.tsx"));
const Widerruf = lazy(() => import("./pages/Widerruf.tsx"));
const Barrierefreiheit = lazy(() => import("./pages/Barrierefreiheit.tsx"));
const WiePawnKiNutzt = lazy(() => import("./pages/WiePawnKiNutzt.tsx"));
const VertragKuendigen = lazy(() => import("./pages/VertragKuendigen.tsx"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation.tsx"));
const StudioOverview = lazy(() => import("./pages/studio/StudioOverview.tsx"));
const StudioProducts = lazy(() => import("./pages/studio/StudioProducts.tsx"));
const StudioStueckNeu = lazy(() => import("./pages/studio/StudioStueckNeu.tsx"));
const StudioOrders = lazy(() => import("./pages/studio/StudioOrders.tsx"));
const StudioVersand = lazy(() => import("./pages/studio/StudioVersand.tsx"));
const StudioBrand = lazy(() => import("./pages/studio/StudioBrand.tsx"));
const StudioCampaigns = lazy(() => import("./pages/studio/StudioCampaigns.tsx"));
const StudioMessages = lazy(() => import("./pages/studio/StudioMessages.tsx"));
const StudioPayout = lazy(() => import("./pages/studio/StudioPayout.tsx"));
const StudioCopilot = lazy(() => import("./pages/studio/StudioCopilot.tsx"));
const StudioSettings = lazy(() => import("./pages/studio/StudioSettings.tsx"));
const StudioAutomatik = lazy(() => import("./pages/studio/StudioAutomatik.tsx"));
const StudioVertraege = lazy(() => import("./pages/studio/StudioVertraege.tsx"));
const StudioOffeneTueren = lazy(() => import("./pages/studio/StudioOffeneTueren.tsx"));
const StudioCampaignNew = lazy(() => import("./pages/studio/StudioCampaignNew.tsx"));
const StudioPlan = lazy(() => import("./pages/studio/StudioPlan.tsx"));
const StudioVideothek = lazy(() => import("./pages/studio/StudioVideothek.tsx"));
const StudioMediathek = lazy(() => import("./pages/studio/StudioMediathek.tsx"));
const StudioContentBegleiter = lazy(() => import("./pages/studio/StudioContentBegleiter.tsx"));
const StudioHausseite = lazy(() => import("./pages/studio/StudioHausseite.tsx"));
const StudioHeft = lazy(() => import("./pages/studio/StudioHeft.tsx"));
const StudioReferrals = lazy(() => import("./pages/studio/StudioReferrals.tsx"));
const StudioBeweis = lazy(() => import("./pages/studio/StudioBeweis.tsx"));
const StudioDNA = lazy(() => import("./pages/studio/StudioDNA.tsx"));
const StudioPostfach = lazy(() => import("./pages/studio/StudioPostfach.tsx"));
const StudioGeschaeft = lazy(() => import("./pages/studio/StudioGeschaeft.tsx"));
const StudioRochade = lazy(() => import("./pages/studio/StudioRochade.tsx"));

const AdminCampaigns = lazy(() => import("./pages/admin/AdminCampaigns.tsx"));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages.tsx"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments.tsx"));
const AdminDesigners = lazy(() => import("./pages/admin/AdminDesigners.tsx"));
const AdminPosting = lazy(() => import("./pages/admin/AdminPosting.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Kontakt = lazy(() => import("./pages/Kontakt.tsx"));
const Presse = lazy(() => import("./pages/Presse.tsx"));

const AdminOverview = lazy(() => import("./pages/admin/AdminOverview.tsx"));
const AdminDNA = lazy(() => import("./pages/admin/AdminDNA.tsx"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts.tsx"));
const AdminAI = lazy(() => import("./pages/admin/AdminAI.tsx"));
const AdminApplications = lazy(() => import("./pages/admin/AdminApplications.tsx"));
const AdminKI = lazy(() => import("./pages/admin/AdminKI.tsx"));
const AdminTrends = lazy(() => import("./pages/admin/AdminTrends.tsx"));
const AdminAkquise = lazy(() => import("./pages/admin/AdminAkquise.tsx"));
const AdminFeldzug = lazy(() => import("./pages/admin/AdminFeldzug.tsx"));
const AdminWachstum = lazy(() => import("./pages/admin/AdminWachstum.tsx"));
const AdminJarvis = lazy(() => import("./pages/admin/AdminJarvis.tsx"));
const AdminArchiv = lazy(() => import("./pages/admin/AdminArchiv.tsx"));
const AdminEditionen = lazy(() => import("./pages/admin/AdminEditionen.tsx"));

const PortalOverview = lazy(() => import("./pages/portal/PortalOverview.tsx"));
const PortalEditor = lazy(() => import("./pages/portal/PortalEditor.tsx"));
const PortalOnboarding = lazy(() => import("./pages/portal/PortalOnboarding.tsx"));

import { RoleGate } from "@/features/access/RoleGate";
import { PortalGate } from "@/features/access/PortalGate";

// Seitenpakete werden erst innerhalb der bestehenden Rollenpruefung geladen.
// Der Router und seine Provider bleiben beim Blaettern im Heft bestehen.
function RouteLoading() {
  const { t } = useI18n();
  return <div role="status" className="flex min-h-[50vh] items-center justify-center bg-white text-sm text-black">{t("studio.pawn.loading")}</div>;
}

const queryClient = new QueryClient();

function AuthedCore({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return <CoreProvider userId={user?.id ?? null}>{children}</CoreProvider>;
}

/** Teil 17d: merkt sich ?ref=<haus-slug> für 30 Tage — auf jeder Seite, nicht nur der Landing. */
function ReferralCapture() {
  const [params] = useSearchParams();
  useEffect(() => { captureReferralCode(params.get("ref")); }, [params]);
  return null;
}

/** Teil 37/AP2: merkt sich ?lead=<akquise-lead-id> für 30 Tage — Attribution für "Erster Zug". */
function LeadCapture() {
  const [params] = useSearchParams();
  useEffect(() => { captureLeadRef(params.get("lead")); }, [params]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <I18nProvider>
        <AuthProvider>
          <AuthedCore>
            <CartProvider>
              <ConsentProvider>
              <PersonalizationProvider>
              <RoomShiftProvider>
              <CopilotProvider>

              <ReferralCapture />
              <LeadCapture />
              <Suspense fallback={<RouteLoading />} >
              <Routes>

                {/* ——— Das Heft. Jede dieser Adressen ist eine Doppelseite. ——— */}
                <Route path="/" element={<Heft />} />
                <Route path="/ausgewaehlt" element={<Heft />} />
                <Route path="/mode" element={<Heft />} />
                <Route path="/mode/:seite" element={<Heft />} />
                <Route path="/interior" element={<Heft />} />
                <Route path="/interior/:seite" element={<Heft />} />
                <Route path="/kunst" element={<Heft />} />
                <Route path="/kunst/:seite" element={<Heft />} />
                <Route path="/haeuser" element={<Heft />} />
                <Route path="/haeuser/:seite" element={<Heft />} />
                <Route path="/haus/:slug" element={<Heft />} />
                <Route path="/haus/:slug/:blatt" element={<Heft />} />
                <Route path="/werk/:slug" element={<Heft />} />
                {/* Die sieben Schritte der DNA heissen, sie zaehlen nicht — deshalb
                    ausgeschrieben und nicht als Platzhalter: so bekommt ein erfundener
                    Name die 404 und nicht die erste Seite. */}
                <Route path="/deine-dna" element={<Heft />} />
                <Route path="/deine-dna/welt" element={<Heft />} />
                <Route path="/deine-dna/richtung" element={<Heft />} />
                <Route path="/deine-dna/form" element={<Heft />} />
                <Route path="/deine-dna/linie" element={<Heft />} />
                <Route path="/deine-dna/foto" element={<Heft />} />
                <Route path="/deine-dna/massband" element={<Heft />} />
                <Route path="/deine-dna/privacy" element={<Heft />} />
                <Route path="/frag-pawn" element={<Heft />} />
                <Route path="/vision" element={<Heft />} />
                <Route path="/vision/:seite" element={<Heft />} />
                <Route path="/fuer-designer" element={<Heft />} />
                <Route path="/fuer-designer/:seite" element={<Heft />} />
                <Route path="/suche" element={<Heft />} />
                <Route path="/konto" element={<Heft />} />
                <Route path="/konto/:seite" element={<Heft />} />
                <Route path="/tasche" element={<Heft />} />

                {/* ——— Die Umzuege. Dieselbe Zuordnung steht in routen.js und wird
                        serverseitig zur 301; hier gilt sie fuer Klicks in der App,
                        wo kein Server dazwischen liegt. ——— */}
                <Route path="/dna" element={<Navigate to="/deine-dna" replace />} />
                <Route path="/designers" element={<Navigate to="/haeuser" replace />} />
                <Route path="/designers/all" element={<Navigate to="/haeuser" replace />} />
                <Route path="/boutique" element={<Navigate to="/ausgewaehlt" replace />} />
                <Route path="/neu" element={<Navigate to="/ausgewaehlt" replace />} />
                <Route path="/cart" element={<Navigate to="/tasche" replace />} />
                <Route path="/checkout" element={<Navigate to="/tasche" replace />} />
                <Route path="/account" element={<Navigate to="/konto" replace />} />
                <Route path="/shop" element={<Navigate to="/suche" replace />} />
                <Route path="/verzeichnis" element={<Navigate to="/suche" replace />} />
                <Route path="/apply" element={<Navigate to="/fuer-designer/2" replace />} />
                <Route path="/about" element={<Navigate to="/vision" replace />} />
                <Route path="/kuratierter-raum" element={<Navigate to="/vision" replace />} />
                <Route path="/drei-welten" element={<Navigate to="/haeuser" replace />} />
                <Route path="/ausgabe" element={<Navigate to="/" replace />} />
                <Route path="/inhalt" element={<Navigate to="/" replace />} />
                <Route path="/product/:slug" element={<WerkUmzug />} />
                <Route path="/designer/:slug" element={<HausUmzug />} />

                {/* ——— Was eine eigene Seite bleibt. ——— */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/preise" element={<Preise />} />
                <Route path="/preise/maison" element={<PreiseMaison />} />
                <Route path="/apply/form" element={<Apply />} />
                <Route path="/start" element={<Start />} />
                <Route path="/einladung/:refCode" element={<Einladung />} />
                <Route path="/datenschutz" element={<Datenschutz />} />
                <Route path="/impressum" element={<Impressum />} />
                <Route path="/versand" element={<Versand />} />
                <Route path="/agb" element={<AGB />} />
                <Route path="/widerruf" element={<Widerruf />} />
                <Route path="/barrierefreiheit" element={<Barrierefreiheit />} />
                <Route path="/wie-pawn-ki-nutzt" element={<WiePawnKiNutzt />} />
                <Route path="/vertrag-kuendigen" element={<VertragKuendigen />} />
                <Route path="/kontakt" element={<Kontakt />} />
                <Route path="/presse/:slug" element={<Presse />} />
                <Route path="/order/success" element={<OrderConfirmation />} />

                <Route path="/admin" element={<RoleGate role="admin"><AdminOverview /></RoleGate>} />
                <Route path="/admin/dna" element={<RoleGate role="admin"><AdminDNA /></RoleGate>} />
                <Route path="/admin/products" element={<RoleGate role="admin"><AdminProducts /></RoleGate>} />
                <Route path="/admin/applications" element={<RoleGate role="admin"><AdminApplications /></RoleGate>} />
                <Route path="/admin/designers" element={<RoleGate role="admin"><AdminDesigners /></RoleGate>} />
                <Route path="/admin/kampagnen" element={<RoleGate role="admin"><AdminCampaigns /></RoleGate>} />
                <Route path="/admin/ai" element={<RoleGate role="admin"><AdminAI /></RoleGate>} />
                <Route path="/admin/ki" element={<RoleGate role="admin"><AdminKI /></RoleGate>} />
                <Route path="/admin/trends" element={<RoleGate role="admin"><AdminTrends /></RoleGate>} />
                <Route path="/admin/akquise" element={<RoleGate role="admin"><AdminAkquise /></RoleGate>} />
                <Route path="/admin/feldzug" element={<RoleGate role="admin"><AdminFeldzug /></RoleGate>} />
                <Route path="/admin/wachstum" element={<RoleGate role="admin"><AdminWachstum /></RoleGate>} />
                <Route path="/admin/jarvis" element={<RoleGate role="admin"><AdminJarvis /></RoleGate>} />
                <Route path="/admin/nachrichten" element={<RoleGate role="admin"><AdminMessages /></RoleGate>} />
                <Route path="/admin/zahlungen" element={<RoleGate role="admin"><AdminPayments /></RoleGate>} />
                <Route path="/admin/texte-bilder" element={<RoleGate role="admin"><AdminContent /></RoleGate>} />
                <Route path="/admin/posting" element={<RoleGate role="admin"><AdminPosting /></RoleGate>} />
                <Route path="/admin/archiv" element={<RoleGate role="admin"><AdminArchiv /></RoleGate>} />
                <Route path="/admin/editionen" element={<RoleGate role="admin"><AdminEditionen /></RoleGate>} />
                <Route path="/admin/werbung" element={<RoleGate role="admin"><AdminWerbung /></RoleGate>} />
                <Route path="/admin/aktionen" element={<RoleGate role="admin"><AdminAktionen /></RoleGate>} />
                <Route path="/admin/begleiter" element={<RoleGate role="admin"><AdminBegleiter /></RoleGate>} />
                <Route path="/admin/archetypen" element={<RoleGate role="admin"><AdminArchetypen /></RoleGate>} />

                <Route path="/studio" element={<RoleGate role="designer"><StudioOverview /></RoleGate>} />
                {/* Teil K1 — Sidebar-Faltung: neue gefaltete Flächen. */}
                <Route path="/studio/werke" element={<RoleGate role="designer"><StudioProducts /></RoleGate>} />
                <Route path="/studio/werke/neu" element={<RoleGate role="designer"><StudioStueckNeu /></RoleGate>} />
                <Route path="/studio/werke/bilder" element={<RoleGate role="designer"><StudioMediathek /></RoleGate>} />
                <Route path="/studio/werke/rochade" element={<RoleGate role="designer"><StudioRochade /></RoleGate>} />
                <Route path="/studio/doppelseite" element={<RoleGate role="designer"><StudioHausseite /></RoleGate>} />
                <Route path="/studio/heft" element={<RoleGate role="designer"><StudioHeft /></RoleGate>} />
                <Route path="/studio/doppelseite/stil" element={<RoleGate role="designer"><StudioBrand /></RoleGate>} />
                <Route path="/studio/clips" element={<RoleGate role="designer"><StudioCampaigns /></RoleGate>} />
                <Route path="/studio/clips/neu" element={<RoleGate role="designer"><StudioCampaignNew /></RoleGate>} />
                <Route path="/studio/clips/fertig" element={<RoleGate role="designer"><StudioVideothek /></RoleGate>} />
                {/* Teil K1 — alte Routen leben als Redirects weiter, keine Funktion geht verloren. */}
                <Route path="/studio/aufbau" element={<Navigate to="/studio" replace />} />
                <Route path="/studio/produkte" element={<Navigate to="/studio/werke" replace />} />
                <Route path="/studio/produkte/neu" element={<Navigate to="/studio/werke/neu" replace />} />
                <Route path="/studio/mediathek" element={<Navigate to="/studio/werke/bilder" replace />} />
                <Route path="/studio/hausseite" element={<Navigate to="/studio/doppelseite" replace />} />
                <Route path="/studio/kampagnen" element={<Navigate to="/studio/clips" replace />} />
                <Route path="/studio/kampagnen/neu" element={<Navigate to="/studio/clips/neu" replace />} />
                <Route path="/studio/videothek" element={<Navigate to="/studio/clips/fertig" replace />} />
                {/* Teil N — die Räume Postfach und Geschäft (Abendlicht-System) */}
                <Route path="/studio/postfach" element={<RoleGate role="designer"><StudioPostfach /></RoleGate>} />
                <Route path="/studio/geschaeft" element={<RoleGate role="designer"><StudioGeschaeft /></RoleGate>} />
                <Route path="/studio/bestellungen" element={<RoleGate role="designer"><StudioOrders /></RoleGate>} />
                <Route path="/studio/versand" element={<RoleGate role="designer"><StudioVersand /></RoleGate>} />
                <Route path="/studio/content-begleiter" element={<RoleGate role="designer"><StudioContentBegleiter /></RoleGate>} />
                <Route path="/studio/empfehlungen" element={<RoleGate role="designer"><StudioReferrals /></RoleGate>} />
                <Route path="/studio/beweis" element={<RoleGate role="designer"><StudioBeweis /></RoleGate>} />
                <Route path="/studio/plan" element={<RoleGate role="designer"><StudioPlan /></RoleGate>} />
                <Route path="/studio/dna" element={<RoleGate role="designer"><StudioDNA /></RoleGate>} />
                <Route path="/studio/brand" element={<Navigate to="/studio/doppelseite/stil" replace />} />
                <Route path="/studio/nachrichten" element={<RoleGate role="designer"><StudioMessages /></RoleGate>} />
                <Route path="/studio/auszahlung" element={<RoleGate role="designer"><StudioPayout /></RoleGate>} />
                <Route path="/studio/copilot" element={<RoleGate role="designer"><StudioCopilot /></RoleGate>} />
                <Route path="/studio/einstellungen" element={<RoleGate role="designer"><StudioSettings /></RoleGate>} />
                <Route path="/studio/automatik" element={<RoleGate role="designer"><StudioAutomatik /></RoleGate>} />
                <Route path="/studio/vertraege" element={<RoleGate role="designer"><StudioVertraege /></RoleGate>} />
                <Route path="/studio/tueren" element={<RoleGate role="designer"><StudioOffeneTueren /></RoleGate>} />

                <Route path="/studio/onboarding" element={<RoleGate role="designer"><PortalGate><PortalOnboarding /></PortalGate></RoleGate>} />
                <Route path="/portal" element={<RoleGate role="designer"><PortalGate><PortalOverview /></PortalGate></RoleGate>} />
                <Route path="/portal/onboarding" element={<RoleGate role="designer"><PortalGate><PortalOnboarding /></PortalGate></RoleGate>} />
                <Route path="/portal/editor" element={<RoleGate role="designer"><PortalEditor /></RoleGate>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              <EinwilligungAusserhalbDesHefts />
              </CopilotProvider>
              </RoomShiftProvider>

              </PersonalizationProvider>
              </ConsentProvider>
            </CartProvider>


          </AuthedCore>
        </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
