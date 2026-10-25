import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPricing, updatePricing } from '../../api/admin';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import toast from 'react-hot-toast';

function PricingRow({ pricing, onSave }) {
  const [margin, setMargin] = useState(pricing.marginPercent ?? 30);
  const [saving, setSaving] = useState(false);
  const finalPrice = (pricing.providerCost * (1 + margin / 100)).toFixed(0);
  const dirty = margin !== (pricing.marginPercent ?? 30);

  const handleSave = async () => {
    setSaving(true);
    await onSave(pricing._id, { marginPercent: Number(margin) });
    setSaving(false);
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">{pricing.countryId?.flagEmoji} {pricing.countryId?.name}</td>
      <td className="px-4 py-3">{pricing.serviceId?.name}</td>
      <td className="px-4 py-3 font-mono-num text-gray-500">{pricing.providerCost}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={margin}
            onChange={(e) => setMargin(Number(e.target.value))}
            className="w-16 px-2 py-1 text-sm border border-gray-200 rounded-lg text-center font-mono-num focus:outline-none focus:ring-1 focus:ring-brand-500"
            min={0}
            max={500}
          />
          <span className="text-sm text-gray-400">%</span>
        </div>
      </td>
      <td className="px-4 py-3 font-mono-num font-semibold text-gray-900">{finalPrice}</td>
      <td className="px-4 py-3 text-right">
        {dirty && (
          <Button size="sm" loading={saving} onClick={handleSave}>Save</Button>
        )}
      </td>
    </tr>
  );
}

export default function AdminPricingPage() {
  const queryClient = useQueryClient();
  const [countryFilter, setCountryFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [bulkMargin, setBulkMargin] = useState('');
  const [applyingBulk, setApplyingBulk] = useState(false);

  // Debounce the text filters so we don't refetch on every keystroke; reset to
  // page 1 whenever the filter changes.
  const [debCountry, setDebCountry] = useState('');
  const [debService, setDebService] = useState('');
  useEffect(() => {
    const t = setTimeout(() => { setDebCountry(countryFilter); setDebService(serviceFilter); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [countryFilter, serviceFilter]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['adminPricing', debCountry, debService, page],
    queryFn: () => getPricing({ country: debCountry, service: debService, page, limit: 50 }).then((r) => r.data.data),
    keepPreviousData: true,
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => updatePricing(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPricing'] });
      toast.success('Pricing updated');
    },
    onError: () => toast.error('Update failed'),
  });

  const handleSave = async (id, data) => {
    return saveMutation.mutateAsync({ id, data });
  };

  const pricing = data?.pricing || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  const handleBulkApply = async () => {
    if (!bulkMargin || isNaN(Number(bulkMargin))) return;
    setApplyingBulk(true);
    try {
      // Applies to the rows currently shown (this page).
      await Promise.all(pricing.map((p) => updatePricing(p._id, { marginPercent: Number(bulkMargin) })));
      queryClient.invalidateQueries({ queryKey: ['adminPricing'] });
      toast.success(`Applied ${bulkMargin}% margin to ${pricing.length} entries on this page`);
      setBulkMargin('');
    } catch {
      toast.error('Bulk update failed');
    } finally {
      setApplyingBulk(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display font-bold text-2xl text-gray-900">Pricing Matrix</h1>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <Input
            placeholder="Filter by country..."
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="w-48"
          />
          <Input
            placeholder="Filter by service..."
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="w-48"
          />
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="number"
              placeholder="Bulk margin %"
              value={bulkMargin}
              onChange={(e) => setBulkMargin(e.target.value)}
              className="w-32 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <Button size="sm" loading={applyingBulk} onClick={handleBulkApply} disabled={!bulkMargin}>
              Apply to {pricing.length} rows (this page)
            </Button>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <p className="text-gray-400 text-sm text-center py-12">Loading...</p>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-4 py-3">Country</th>
                <th className="text-left px-4 py-3">Service</th>
                <th className="text-left px-4 py-3">Provider Cost</th>
                <th className="text-left px-4 py-3">Margin %</th>
                <th className="text-left px-4 py-3">Final Price</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pricing.length ? pricing.map((p) => (
                <PricingRow key={p._id} pricing={p} onSave={handleSave} />
              )) : (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-400 text-sm">No pricing entries found</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {total.toLocaleString()} entries · page {page} of {pages}
            {isFetching && <span className="ml-2 text-gray-400">updating…</span>}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ← Prev
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= pages || isFetching} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
