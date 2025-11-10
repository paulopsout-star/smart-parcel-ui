import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";

import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import NewCharge from "./pages/NewCharge";
import ChargeHistory from "./pages/ChargeHistory";
import Payment from "./pages/Payment";
import Checkout from "./pages/Checkout";
import PaymentDirect from "./pages/PaymentDirect";
import PaymentPix from "./pages/PaymentPix";
import PaymentCard from "./pages/PaymentCard";
import ThankYou from "./pages/ThankYou";
import PayoutAccounts from "./pages/PayoutAccounts";
import MessageTemplates from "./pages/MessageTemplates";
import MessageQueue from "./pages/MessageQueue";
import CreateAdmin from "./pages/CreateAdmin";
import NotFound from "./pages/NotFound";
import Simulator from "./pages/Simulator";

// Admin pages
import UserManagement from "./pages/admin/UserManagement";
import SubscriptionManagement from "./pages/admin/SubscriptionManagement";
import RefundManagement from "./pages/admin/RefundManagement";
import RecurrenceManagement from "./pages/admin/RecurrenceManagement";
import CheckoutNew from "./pages/admin/CheckoutNew";
import CheckoutHistory from "./pages/admin/CheckoutHistory";
import Reports from "./pages/admin/Reports";
import CompanySettings from "./pages/admin/CompanySettings";
import { useState } from "react";

const App = () => {
  const [queryClient] = useState(() => new QueryClient());
  
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SubscriptionProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/payment" element={<Payment />} />
                <Route path="/checkout/:id" element={<Checkout />} />
                <Route path="/payment-direct/:id" element={<PaymentDirect />} />
                <Route path="/payment-pix/:id" element={<PaymentPix />} />
                <Route path="/payment-card/:id" element={<PaymentCard />} />
                <Route path="/thank-you" element={<ThankYou />} />
                <Route path="/simulador" element={<Simulator />} />
                
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/new-charge" element={<ProtectedRoute><NewCharge /></ProtectedRoute>} />
                <Route path="/charges" element={<ProtectedRoute><ChargeHistory /></ProtectedRoute>} />
                <Route path="/payout-accounts" element={<ProtectedRoute><PayoutAccounts /></ProtectedRoute>} />
                <Route path="/message-templates" element={<ProtectedRoute><MessageTemplates /></ProtectedRoute>} />
                <Route path="/message-queue" element={<ProtectedRoute><MessageQueue /></ProtectedRoute>} />
                <Route path="/create-admin" element={<ProtectedRoute requiredRole="admin"><CreateAdmin /></ProtectedRoute>} />
                
                <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><UserManagement /></ProtectedRoute>} />
                <Route path="/admin/subscriptions" element={<ProtectedRoute requiredRole="admin"><SubscriptionManagement /></ProtectedRoute>} />
                <Route path="/admin/refunds" element={<ProtectedRoute requiredRole="admin"><RefundManagement /></ProtectedRoute>} />
                <Route path="/admin/recurrences" element={<ProtectedRoute requiredRole="admin"><RecurrenceManagement /></ProtectedRoute>} />
                <Route path="/admin/checkout/new" element={<ProtectedRoute requiredRole="admin"><CheckoutNew /></ProtectedRoute>} />
                <Route path="/admin/checkout/history" element={<ProtectedRoute requiredRole="admin"><CheckoutHistory /></ProtectedRoute>} />
                <Route path="/admin/reports" element={<ProtectedRoute requiredRole="admin"><Reports /></ProtectedRoute>} />
                <Route path="/admin/settings" element={<ProtectedRoute requiredRole="admin"><CompanySettings /></ProtectedRoute>} />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
