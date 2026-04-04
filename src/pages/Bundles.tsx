import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import CreateBundleModal from '../components/CreateBundleModal';
import { Package, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function Bundles() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const { data: bundles, isLoading } = useQuery({
    queryKey: ['bundles'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/bundles', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/v1/bundles/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-skus'] });
      queryClient.invalidateQueries({ queryKey: ['all-skus-for-bundles'] });
    }
  });

  const handleDelete = (id: string, skuCode: string) => {
    if (window.confirm(`Remove "${skuCode}" as a bundle? It will return to the Inventory tab.`)) {
      deleteMutation.mutate(id);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2 className="text-3xl font-bold tracking-tight">Bundles</h2>
          <p className="text-white/50 mt-1">Manage bundle SKUs and their component products</p>
        </motion.div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-white text-black px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-white/90 transition-all"
        >
          Create Bundle
        </button>
      </header>

      <CreateBundleModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
          <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">Total Bundles</p>
          <p className="text-3xl font-bold tracking-tight">{bundles?.length ?? 0}</p>
        </div>
        <div className="bg-bg-card border border-border-subtle p-6 rounded-2xl">
          <p className="text-xs text-white/30 uppercase font-bold tracking-widest mb-1">Total Components</p>
          <p className="text-3xl font-bold tracking-tight">
            {bundles?.reduce((sum: number, b: any) => sum + (b.components?.length ?? 0), 0) ?? 0}
          </p>
        </div>
      </div>

      {/* Bundle List */}
      <section className="space-y-4">
        {isLoading && (
          <div className="text-center text-white/50 py-12">Loading bundles...</div>
        )}

        {!isLoading && (!bundles || bundles.length === 0) && (
          <div className="bg-bg-card border border-border-subtle rounded-2xl p-12 text-center">
            <Package className="mx-auto text-white/20 mb-4" size={48} />
            <p className="text-white/50 text-lg">No bundles yet</p>
            <p className="text-white/30 text-sm mt-1">Create a bundle to group individual products under a single bundle SKU.</p>
          </div>
        )}

        {bundles?.map((bundle: any) => (
          <div key={bundle.id} className="bg-bg-card border border-border-subtle rounded-2xl overflow-hidden">
            {/* Bundle Header Row */}
            <div
              className="flex items-center gap-4 p-5 cursor-pointer hover:bg-white/[0.02] transition-all"
              onClick={() => toggleExpand(bundle.id)}
            >
              <div className="text-white/30">
                {expandedId === bundle.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-white">{bundle.sku.skuCode}</span>
                  <span className="text-white/50">—</span>
                  <span className="text-white/70 truncate">{bundle.sku.productDescription}</span>
                </div>
              </div>
              <div className="flex items-center gap-6 flex-shrink-0">
                <div className="text-right">
                  <p className="text-xs text-white/30 uppercase tracking-widest">Shopify Inv.</p>
                  <p className="font-mono font-bold">{bundle.shopifyInventory}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/30 uppercase tracking-widest">Products</p>
                  <p className="font-mono font-bold">{bundle.components.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/30 uppercase tracking-widest">Created</p>
                  <p className="text-sm text-white/70">
                    {new Date(bundle.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(bundle.id, bundle.sku.skuCode); }}
                  className="p-2 rounded-lg hover:bg-critical/20 text-white/20 hover:text-critical transition-all"
                  title="Remove bundle"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Expanded Component List */}
            {expandedId === bundle.id && (
              <div className="border-t border-border-subtle">
                <div className="px-5 py-3 bg-white/[0.02]">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">Component Products</p>
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-white/30 uppercase tracking-widest">
                        <th className="text-left pb-2 font-bold">SKU</th>
                        <th className="text-left pb-2 font-bold">Product</th>
                        <th className="text-right pb-2 font-bold">Qty per Bundle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bundle.components.map((comp: any) => (
                        <tr key={comp.id} className="border-t border-border-subtle">
                          <td className="py-2.5 font-mono text-sm">{comp.sku.skuCode}</td>
                          <td className="py-2.5 text-sm text-white/70">{comp.sku.productDescription}</td>
                          <td className="py-2.5 text-right font-mono font-bold">{comp.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {bundle.notes && (
                  <div className="px-5 py-3 border-t border-border-subtle bg-white/[0.01]">
                    <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Notes</p>
                    <p className="text-sm text-white/60">{bundle.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
