import React from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Package } from 'lucide-react';
import axios from 'axios';

export default function Login() {
  const [email, setEmail] = React.useState('demo@inventoryos.com');
  const [password, setPassword] = React.useState('password123');
  const [error, setError] = React.useState('');
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post('/api/v1/auth/login', { email, password });
      if (res.data.success) {
        setAuth(res.data.data.token, res.data.data.user);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-main p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-critical rounded-2xl flex items-center justify-center mx-auto shadow-2xl shadow-critical/20">
            <Package className="text-white w-10 h-10" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">InventoryOS</h1>
            <p className="text-white/50 mt-2">Supply chain operations platform</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-bg-card border border-border-subtle p-8 rounded-3xl space-y-6">
          {error && (
            <div className="bg-critical/10 border border-critical/20 text-critical text-sm p-4 rounded-xl font-medium">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-border-subtle rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-white/90 transition-all shadow-xl shadow-white/5"
          >
            Sign In
          </button>
          <p className="text-center text-xs text-white/30">
            Demo credentials: demo@inventoryos.com / password123
          </p>
        </form>
      </div>
    </div>
  );
}
