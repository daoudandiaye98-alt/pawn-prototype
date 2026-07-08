import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/store/cart";
import { CoreProvider } from "@/core";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { RoomShiftProvider } from "@/features/os/roomShift";
import { PersonalizationProvider } from "@/features/personalization";
import { ConsentProvider } from "@/lib/consent";
import { ConsentBanner } from "@/components/palace/ConsentBanner";
import { EditModeProvider } from "@/lib/editMode";
import { CopilotProvider } from "@/components/pawn/CopilotDrawer";

import AdminInhalte from "./pages/admin/AdminInhalte.tsx";


import Index from "./pages/Index.tsx";
import DNA from "./pages/DNA.tsx";
import Designers from "./pages/Designers.tsx";
import Apply from "./pages/Apply.tsx";
import ApplyLanding from "./pages/ApplyLanding.tsx";
import Datenschutz from "./pages/Datenschutz.tsx";
import Impressum from "./pages/Impressum.tsx";
import Versand from "./pages/Versand.tsx";
import AGB from "./pages/AGB.tsx";
import OrderConfirmation from "./pages/OrderConfirmation.tsx";
import StudioOverview from "./pages/studio/StudioOverview.tsx";
import StudioProducts from "./pages/studio/StudioProducts.tsx";
import StudioOrders from "./pages/studio/StudioOrders.tsx";
import StudioBrand from "./pages/studio/StudioBrand.tsx";
import StudioCampaigns from "./pages/studio/StudioCampaigns.tsx";
import StudioMessages from "./pages/studio/StudioMessages.tsx";
import StudioPayout from "./pages/studio/StudioPayout.tsx";
import StudioCopilot from "./pages/studio/StudioCopilot.tsx";
import StudioSettings from "./pages/studio/StudioSettings.tsx";

import AdminCampaigns from "./pages/admin/AdminCampaigns.tsx";
import AdminMessages from "./pages/admin/AdminMessages.tsx";
import AdminPayments from "./pages/admin/AdminPayments.tsx";
import AdminDesigners from "./pages/admin/AdminDesigners.tsx";
import Shop from "./pages/Shop.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import Cart from "./pages/Cart.tsx";
import Checkout from "./pages/Checkout.tsx";
import DesignersIndex from "./pages/DesignersIndex.tsx";
import DesignerPage from "./pages/DesignerPage.tsx";
import Account from "./pages/Account.tsx";
import Auth from "./pages/Auth.tsx";
import Mode from "./pages/palace/Mode.tsx";
import Interior from "./pages/palace/Interior.tsx";
import Kunst from "./pages/palace/Kunst.tsx";
import Neu from "./pages/palace/Neu.tsx";
import Style from "./pages/Style.tsx";
import Kontakt from "./pages/Kontakt.tsx";

import AdminOverview from "./pages/admin/AdminOverview.tsx";
import AdminDNA from "./pages/admin/AdminDNA.tsx";
import AdminProducts from "./pages/admin/AdminProducts.tsx";
import AdminAI from "./pages/admin/AdminAI.tsx";
import AdminApplications from "./pages/admin/AdminApplications.tsx";
import AdminKI from "./pages/admin/AdminKI.tsx";

import PortalOverview from "./pages/portal/PortalOverview.tsx";
import PortalEditor from "./pages/portal/PortalEditor.tsx";
import PortalOnboarding from "./pages/portal/PortalOnboarding.tsx";

import NotFound from "./pages/NotFound.tsx";
import { RoleGate } from "@/features/access/RoleGate";
import { PortalGate } from "@/features/access/PortalGate";

const queryClient = new QueryClient();

function AuthedCore({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return <CoreProvider userId={user?.id ?? null}>{children}</CoreProvider>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <I18nProvider>
        <AuthProvider>
          <AuthedCore>
            <CartProvider>
              <ConsentProvider>
              <EditModeProvider>
              <PersonalizationProvider>
              <RoomShiftProvider>
              <CopilotProvider>

              <Routes>

                <Route path="/" element={<Index />} />
                <Route path="/mode" element={<Mode />} />
                <Route path="/interior" element={<Interior />} />
                <Route path="/kunst" element={<Kunst />} />
                <Route path="/neu" element={<Neu />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/style" element={<Style />} />
                <Route path="/dna" element={<DNA />} />
                <Route path="/designers" element={<Designers />} />
                <Route path="/designers/all" element={<DesignersIndex />} />
                <Route path="/designer/:slug" element={<DesignerPage />} />
                <Route path="/apply" element={<ApplyLanding />} />
                <Route path="/apply/form" element={<Apply />} />
                <Route path="/datenschutz" element={<Datenschutz />} />
                <Route path="/impressum" element={<Impressum />} />
                <Route path="/versand" element={<Versand />} />
                <Route path="/agb" element={<AGB />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/product/:slug" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/order/success" element={<OrderConfirmation />} />
                <Route path="/account" element={<Account />} />

                <Route path="/admin" element={<AdminOverview />} />
                <Route path="/admin/dna" element={<RoleGate role="admin"><AdminDNA /></RoleGate>} />
                <Route path="/admin/products" element={<RoleGate role="admin"><AdminProducts /></RoleGate>} />
                <Route path="/admin/applications" element={<RoleGate role="admin"><AdminApplications /></RoleGate>} />
                <Route path="/admin/designers" element={<RoleGate role="admin"><AdminDesigners /></RoleGate>} />
                <Route path="/admin/kampagnen" element={<RoleGate role="admin"><AdminCampaigns /></RoleGate>} />
                <Route path="/admin/ai" element={<RoleGate role="admin"><AdminAI /></RoleGate>} />
                <Route path="/admin/ki" element={<RoleGate role="admin"><AdminKI /></RoleGate>} />
                <Route path="/admin/nachrichten" element={<RoleGate role="admin"><AdminMessages /></RoleGate>} />
                <Route path="/admin/zahlungen" element={<RoleGate role="admin"><AdminPayments /></RoleGate>} />
                <Route path="/admin/inhalte" element={<AdminInhalte />} />

                <Route path="/studio" element={<RoleGate role="designer"><StudioOverview /></RoleGate>} />
                <Route path="/studio/produkte" element={<RoleGate role="designer"><StudioProducts /></RoleGate>} />
                <Route path="/studio/bestellungen" element={<RoleGate role="designer"><StudioOrders /></RoleGate>} />
                <Route path="/studio/kampagnen" element={<RoleGate role="designer"><StudioCampaigns /></RoleGate>} />
                <Route path="/studio/brand" element={<RoleGate role="designer"><StudioBrand /></RoleGate>} />
                <Route path="/studio/nachrichten" element={<RoleGate role="designer"><StudioMessages /></RoleGate>} />
                <Route path="/studio/auszahlung" element={<RoleGate role="designer"><StudioPayout /></RoleGate>} />
                <Route path="/studio/copilot" element={<RoleGate role="designer"><StudioCopilot /></RoleGate>} />
                <Route path="/studio/einstellungen" element={<RoleGate role="designer"><StudioSettings /></RoleGate>} />

                <Route path="/studio/onboarding" element={<PortalGate><PortalOnboarding /></PortalGate>} />
                <Route path="/portal" element={<PortalGate><PortalOverview /></PortalGate>} />
                <Route path="/portal/onboarding" element={<PortalGate><PortalOnboarding /></PortalGate>} />
                <Route path="/portal/editor" element={<RoleGate role="designer"><PortalEditor /></RoleGate>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
              <ConsentBanner />
              </CopilotProvider>
              </RoomShiftProvider>

              </PersonalizationProvider>
              </EditModeProvider>
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
