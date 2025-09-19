import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Public pages
import Index from "./pages/Index";
import Payment from "./pages/Payment";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

// Protected pages
import Dashboard from "./pages/Dashboard";
import NewCharge from "./pages/NewCharge";
import CheckoutNew from "./pages/admin/CheckoutNew";
import CheckoutHistory from "./pages/admin/CheckoutHistory";

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
            
            {/* Protected routes - Admin/Operador */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/charges/new" element={
              <ProtectedRoute>
                <NewCharge />
              </ProtectedRoute>
            } />
            
            <Route path="/charges" element={
              <ProtectedRoute>
                <CheckoutHistory />
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
            
            {/* Admin only routes */}
            <Route path="/admin/users" element={
              <ProtectedRoute requiredRole="admin">
                <div>Admin Users Page - To be implemented</div>
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
