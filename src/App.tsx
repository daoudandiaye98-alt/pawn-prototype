import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/store/cart";

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

import AdminOverview from "./pages/admin/AdminOverview.tsx";
import AdminDNA from "./pages/admin/AdminDNA.tsx";
import AdminProducts from "./pages/admin/AdminProducts.tsx";
import AdminAI from "./pages/admin/AdminAI.tsx";

import PortalOverview from "./pages/portal/PortalOverview.tsx";
import PortalEditor from "./pages/portal/PortalEditor.tsx";

import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
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
            <Route path="/admin/dna" element={<AdminDNA />} />
            <Route path="/admin/products" element={<AdminProducts />} />
            <Route path="/admin/ai" element={<AdminAI />} />

            <Route path="/portal" element={<PortalOverview />} />
            <Route path="/portal/editor" element={<PortalEditor />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
