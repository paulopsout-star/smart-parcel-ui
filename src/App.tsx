import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";

// Public pages
import Index from "./pages/Index";
import Payment from "./pages/Payment";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CreateAdmin from "./pages/CreateAdmin";
import NotFound from "./pages/NotFound";

// Protected pages
import Dashboard from "./pages/Dashboard";
import NewCharge from "./pages/NewCharge";
import ChargeHistory from "./pages/ChargeHistory";
import MessageTemplates from "./pages/MessageTemplates";
import PayoutAccounts from "./pages/PayoutAccounts";
import MessageQueue from "./pages/MessageQueue";
import UserManagement from "./pages/admin/UserManagement";
import CheckoutNew from "./pages/admin/CheckoutNew";
import CheckoutHistory from "./pages/admin/CheckoutHistory";
import RefundManagement from "./pages/admin/RefundManagement";
import RecurrenceManagement from "./pages/admin/RecurrenceManagement";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/create-admin" element={<CreateAdmin />} />
            
            {/* Protected routes with Layout */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/new-charge" element={
              <ProtectedRoute>
                <Layout>
                  <NewCharge />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/charge-history" element={
              <ProtectedRoute>
                <Layout>
                  <ChargeHistory />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/message-templates" element={
              <ProtectedRoute>
                <Layout>
                  <MessageTemplates />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/payout-accounts" element={
              <ProtectedRoute>
                <Layout>
                  <PayoutAccounts />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/message-queue" element={
              <ProtectedRoute>
                <Layout>
                  <MessageQueue />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/admin/refunds" element={
              <ProtectedRoute requiredRole="admin">
                <Layout>
                  <RefundManagement />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/admin/recurrences" element={
              <ProtectedRoute requiredRole="admin">
                <Layout>
                  <RecurrenceManagement />
                </Layout>
              </ProtectedRoute>
            } />
            
            {/* Legacy routes for backward compatibility */}
            <Route path="/charges/new" element={
              <ProtectedRoute>
                <Layout>
                  <NewCharge />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/charges" element={
              <ProtectedRoute>
                <Layout>
                  <ChargeHistory />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/admin/checkout/new" element={
              <ProtectedRoute>
                <CheckoutNew />
              </ProtectedRoute>
            } />
            
            <Route path="/admin/checkout/history" element={
              <ProtectedRoute>
                <CheckoutHistory />
              </ProtectedRoute>
            } />
            
            {/* Catch all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;