import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/store/cart";
import { CoreProvider } from "@/core";
import { AuthProvider, useAuth } from "@/lib/auth";
import { RoomShiftProvider } from "@/features/os/roomShift";

import Index from "./pages/Index.tsx";
import DNA from "./pages/DNA.tsx";
import Designers from "./pages/Designers.tsx";
import Apply from "./pages/Apply.tsx";
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

import AdminOverview from "./pages/admin/AdminOverview.tsx";
import AdminDNA from "./pages/admin/AdminDNA.tsx";
import AdminProducts from "./pages/admin/AdminProducts.tsx";
import AdminAI from "./pages/admin/AdminAI.tsx";
import AdminApplications from "./pages/admin/AdminApplications.tsx";

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
        <AuthProvider>
          <AuthedCore>
            <CartProvider>
              <RoomShiftProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/mode" element={<Mode />} />
                <Route path="/interior" element={<Interior />} />
                <Route path="/kunst" element={<Kunst />} />
                <Route path="/neu" element={<Neu />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dna" element={<DNA />} />
                <Route path="/designers" element={<Designers />} />
                <Route path="/designers/all" element={<DesignersIndex />} />
                <Route path="/designer/:slug" element={<DesignerPage />} />
                <Route path="/apply" element={<Apply />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/product/:slug" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/account" element={<Account />} />

                <Route path="/admin" element={<AdminOverview />} />
                <Route path="/admin/dna" element={<RoleGate role="admin"><AdminDNA /></RoleGate>} />
                <Route path="/admin/products" element={<RoleGate role="admin"><AdminProducts /></RoleGate>} />
                <Route path="/admin/applications" element={<RoleGate role="admin"><AdminApplications /></RoleGate>} />
                <Route path="/admin/designers" element={<RoleGate role="admin"><AdminApplications /></RoleGate>} />
                <Route path="/admin/ai" element={<RoleGate role="admin"><AdminAI /></RoleGate>} />

                <Route path="/portal" element={<PortalGate><PortalOverview /></PortalGate>} />
                <Route path="/portal/onboarding" element={<PortalGate><PortalOnboarding /></PortalGate>} />
                <Route path="/portal/editor" element={<RoleGate role="designer"><PortalEditor /></RoleGate>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
              </RoomShiftProvider>
            </CartProvider>
          </AuthedCore>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
