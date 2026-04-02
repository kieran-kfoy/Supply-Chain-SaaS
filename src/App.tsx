import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/useAuthStore';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Inventory from './pages/Inventory';
import Purchasing from './pages/Purchasing';
import FinishedGoodsLog from './pages/FinishedGoodsLog';
import Suppliers from './pages/Suppliers';
import Settings from './pages/Settings';

const queryClient = new QueryClient();

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.token);
  return token ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  const token = useAuthStore((state) => state.token);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="flex min-h-screen bg-bg-main text-white">
          {token && <Sidebar />}
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/login" element={!token ? <Login /> : <Navigate to="/" />} />
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                }
              />
              <Route path="/inventory" element={<PrivateRoute><Inventory /></PrivateRoute>} />
              <Route path="/purchasing" element={<PrivateRoute><Purchasing /></PrivateRoute>} />
              <Route path="/inbound" element={<PrivateRoute><FinishedGoodsLog /></PrivateRoute>} />
              <Route path="/suppliers" element={<PrivateRoute><Suppliers /></PrivateRoute>} />
              <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
            </Routes>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  );
}
