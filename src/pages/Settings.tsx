import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { ShoppingBag, RefreshCw, CheckCircle, XCircle, ExternalLink, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export default function Settings() {
  const token = useAuthStore((state) => state.token);
  const qc = useQueryClient();
  const [syncMsg, setSyncMsg] = useState('');
  const [searchParams] = useSearchParams();
  const [cadenceSaved, setCadenceSaved] = useState(false);

  // Refetch status after Shopify redirects back with ?shopify=connected
  useEffect(() => {
    if (searchParams.get('shopify') === 'connected') {
      qc.invalidateQueries({ queryKey: ['shopify-status'] });
    }
  }, [searchParams]);

  const headers = { Authorization: `Bearer ${token}` };

  const { data: shopifyStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['shopify-status'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/shopify/status', { headers });
      return res.data;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post('/api/v1/shopify/sync', {}, { headers });
      return res.data;
    },
    onSuccess: (data) => {
      const d = data?.data;
      setSyncMsg(d?.message || `Synced ${d?.skusCreated ?? 0} new SKUs, ${d?.snapshotsCreated ?? 0} inventory snapshots created.`);
      qc.invalidateQueries({ queryKey: ['shopify-status'] });
    },
    onError: (err: any) => {
      setSyncMsg(err.response?.data?.error || 'Sync failed.');
    },
  });

  const handleConnect = () => {
    window.location.href = `/api/v1/shopify/install?shop=${encodeURIComponent('inventoryos-dev.myshopify.com')}&token=${token}`;
  };

  const connected = shopifyStatus?.data?.connected;
  const cadenceHours = shopifyStatus?.data?.cadenceHours || 24;

  const cadenceMutation = useMutation({
    mutationFn: async (hours: number) => {
      const res = await axios.post('/api/v1/shopify/cadence', { cadenceHours: hours }, { headers });
      return res.data;
    },
    onSuccess: () => {
      setCadenceSaved(true);
      setTimeout(() => setCadenceSaved(false), 2000);
      qc.invalidateQueries({ queryKey: ['shopify-status'] });
    },
  });

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
      <p className="text-gray-400 mb-8">Manage integrations and account preferences.</p>

      {/* Shopify Card */}
      <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-[#96bf48]/20 rounded-lg flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-[#96bf48]" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">Shopify</h2>
            <p className="text-gray-400 text-sm">Sync products and inventory from your Shopify store.</p>
          </div>
          <div className="ml-auto">
            {statusLoading ? (
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            ) : connected ? (
              <span className="flex items-center gap-1.5 text-green-400 text-sm font-medium">
                <CheckCircle className="w-4 h-4" /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-gray-400 text-sm">
                <XCircle className="w-4 h-4" /> Not connected
              </span>
            )}
          </div>
        </div>

        {connected && shopifyStatus?.data?.shop && (
          <div className="bg-white/5 rounded-lg px-4 py-3 mb-4 text-sm text-gray-300">
            <span className="text-gray-500">Store: </span>
            <span className="text-white font-medium">{shopifyStatus.data.shop}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {!connected ? (
            <button
              onClick={handleConnect}
              className="flex items-center gap-2 bg-[#96bf48] hover:bg-[#7ea83a] text-black font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Connect Shopify
            </button>
          ) : (
            <button
              onClick={() => { setSyncMsg(''); syncMutation.mutate(); }}
              disabled={syncMutation.isPending}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? 'Syncing...' : 'Sync Products'}
            </button>
          )}
        </div>

        {syncMsg && (
          <p className={`mt-3 text-sm ${syncMsg.includes('failed') ? 'text-red-400' : 'text-green-400'}`}>
            {syncMsg}
          </p>
        )}

        {connected && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-gray-400 text-sm mb-3">Auto-sync frequency</p>
            <div className="flex gap-2">
              {[{ label: 'Every hour', value: 1 }, { label: 'Every 6 hours', value: 6 }, { label: 'Every 24 hours', value: 24 }].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => cadenceMutation.mutate(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    cadenceHours === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {cadenceSaved && <p className="text-green-400 text-xs mt-2">Saved!</p>}
          </div>
        )}
      </div>

      {/* Amazon placeholder */}
      <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6 opacity-60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">Amazon FBA</h2>
            <p className="text-gray-400 text-sm">Sync FBA inventory via Amazon SP-API. <span className="text-orange-400 font-medium">Coming soon</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
