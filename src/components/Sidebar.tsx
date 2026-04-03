import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard',     path: '/' },
  { icon: Package,         label: 'Inventory',     path: '/inventory' },
  { icon: ShoppingCart,    label: 'Purchasing',    path: '/purchasing' },
  { icon: Truck,           label: 'Shipping Log',  path: '/inbound' },
  { icon: Users,           label: 'Suppliers',     path: '/suppliers' },
];

function LogoMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logoGrad)" />
      {/* Cube / box icon paths */}
      <path d="M16 7L24 11.5V20.5L16 25L8 20.5V11.5L16 7Z" stroke="rgba(255,255,255,0.3)" strokeWidth="1" fill="none"/>
      <path d="M16 7L24 11.5L16 16L8 11.5L16 7Z" fill="rgba(255,255,255,0.25)"/>
      <path d="M16 16V25L8 20.5V11.5L16 16Z" fill="rgba(255,255,255,0.12)"/>
      <path d="M16 16V25L24 20.5V11.5L16 16Z" fill="rgba(255,255,255,0.18)"/>
    </svg>
  );
}

export default function Sidebar() {
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();

  return (
    <aside
      className="w-[230px] flex flex-col h-screen sticky top-0 shrink-0"
      style={{
        background: 'linear-gradient(180deg, #090C16 0%, #07090F 100%)',
        borderRight: '1px solid rgba(255,255,255,0.055)',
      }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <LogoMark />
          <div>
            <h1 className="text-[15px] font-bold tracking-tight leading-none" style={{ color: '#F1F5F9' }}>
              InventoryOS
            </h1>
            <p className="text-[10px] mt-0.5 font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Supply Chain Ops
            </p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 mb-3" style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

      {/* Navigation label */}
      <div className="px-5 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Navigation
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item, i) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="block"
            >
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                className={clsx(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer select-none',
                  isActive
                    ? 'nav-active-glow'
                    : 'hover:bg-white/[0.04]'
                )}
              >
                {/* Active left bar (for non-active items, invisible) */}
                {!isActive && (
                  <div
                    className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(99,102,241,0.4)' }}
                  />
                )}

                <item.icon
                  className="w-[18px] h-[18px] shrink-0 transition-colors duration-200"
                  style={{ color: isActive ? '#818CF8' : 'rgba(255,255,255,0.4)' }}
                />
                <span
                  className="text-[13.5px] font-medium transition-colors duration-200"
                  style={{ color: isActive ? '#E2E8F0' : 'rgba(255,255,255,0.5)' }}
                >
                  {item.label}
                </span>

                {/* Active dot */}
                {isActive && (
                  <motion.div
                    layoutId="activeNavDot"
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: '#6366F1', boxShadow: '0 0 8px rgba(99,102,241,0.8)' }}
                  />
                )}
              </motion.div>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-3 space-y-0.5">
        <div className="mx-1 mb-2" style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

        <NavLink to="/settings">
          {({ isActive }) => (
            <div
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer',
                isActive ? 'nav-active-glow' : 'hover:bg-white/[0.04]'
              )}
            >
              <Settings
                className="w-[18px] h-[18px] shrink-0"
                style={{ color: isActive ? '#818CF8' : 'rgba(255,255,255,0.4)' }}
              />
              <span
                className="text-[13.5px] font-medium"
                style={{ color: isActive ? '#E2E8F0' : 'rgba(255,255,255,0.5)' }}
              >
                Settings
              </span>
            </div>
          )}
        </NavLink>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-red-500/[0.08] group cursor-pointer"
        >
          <LogOut
            className="w-[18px] h-[18px] shrink-0 transition-colors duration-200 group-hover:text-red-400"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          />
          <span
            className="text-[13.5px] font-medium transition-colors duration-200 group-hover:text-red-400"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            Sign Out
          </span>
        </button>

        {/* Version badge */}
        <div className="px-3 pt-2">
          <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.15)' }}>
            InventoryOS v1.0
          </span>
        </div>
      </div>
    </aside>
  );
}
