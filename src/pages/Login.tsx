import React from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { motion } from 'motion/react';
import axios from 'axios';

function LogoMark({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="loginLogoGrad" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="52" height="52" rx="14" fill="url(#loginLogoGrad)" />
      <path d="M26 11L38 18V32L26 39L14 32V18L26 11Z" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" fill="none"/>
      <path d="M26 11L38 18L26 25L14 18L26 11Z" fill="rgba(255,255,255,0.3)"/>
      <path d="M26 25V39L14 32V18L26 25Z" fill="rgba(255,255,255,0.15)"/>
      <path d="M26 25V39L38 32V18L26 25Z" fill="rgba(255,255,255,0.2)"/>
    </svg>
  );
}

// Animated grid background
function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Radial gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%)',
        }}
      />
      {/* Grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 70% 70% at 50% 0%, black 30%, transparent 100%)',
        }}
      />
      {/* Glow orbs */}
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: 500, height: 500,
          top: -200, left: '50%',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: 300, height: 300,
          bottom: 100, right: 100,
          background: 'radial-gradient(circle, rgba(129,140,248,0.06) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = React.useState('demo@inventoryos.com');
  const [password, setPassword] = React.useState('password123');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/v1/auth/login', { email, password });
      if (res.data.success) {
        setAuth(res.data.data.token, res.data.data.user);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#06080F' }}
    >
      <GridBackground />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo + Brand */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-8 space-y-4"
        >
          <div className="flex justify-center">
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{ filter: 'drop-shadow(0 8px 32px rgba(99,102,241,0.35))' }}
            >
              <LogoMark size={56} />
            </motion.div>
          </div>
          <div>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #F1F5F9 30%, rgba(129,140,248,0.9) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              InventoryOS
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>
              Supply chain operations platform
            </p>
          </div>
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: 'linear-gradient(180deg, #0F1521 0%, #0C1018 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20,
            padding: 32,
            boxShadow: '0 25px 80px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.06) inset',
          }}
        >
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-5 p-3.5 rounded-xl text-sm font-medium"
              style={{
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.2)',
                color: '#F87171',
              }}
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="field-label">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="field-label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                required
                autoComplete="current-password"
              />
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.99 }}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all duration-150 relative overflow-hidden"
              style={{
                background: loading ? 'rgba(255,255,255,0.7)' : '#fff',
                color: '#06080F',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(255,255,255,0.08)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </motion.button>
          </form>

          {/* Demo credentials hint */}
          <div
            className="mt-5 p-3 rounded-xl text-center"
            style={{
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.12)',
            }}
          >
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Demo: <span style={{ color: 'rgba(129,140,248,0.7)' }}>demo@inventoryos.com</span>
              {' / '}
              <span style={{ color: 'rgba(129,140,248,0.7)' }}>password123</span>
            </p>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-6 text-[11px]"
          style={{ color: 'rgba(255,255,255,0.18)' }}
        >
          © 2026 InventoryOS · Supply Chain Intelligence
        </motion.p>
      </div>
    </div>
  );
}
