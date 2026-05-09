import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { FiPlus, FiToggleLeft, FiToggleRight, FiTrash2 } from 'react-icons/fi';
import { getPromoCodes, createPromoCode, updatePromoCode, deletePromoCode } from '../../api/admin';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  code: '',
  type: 'PERCENT_BONUS',
  value: '',
  maxUses: '',
  minAmountUSD: '',
  expiresAt: '',
};

function CreatePromoModal({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || !form.value) {
      toast.error('Code and value are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value: Number(form.value),
        ...(form.maxUses ? { maxUses: Number(form.maxUses) } : {}),
        ...(form.minAmountUSD ? { minAmountUSD: Number(form.minAmountUSD) } : {}),
        ...(form.expiresAt ? { expiresAt: form.expiresAt } : {}),
      };
      await createPromoCode(payload);
      toast.success('Promo code created');
      setForm(EMPTY_FORM);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to create promo code');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Promo Code" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
          <input
            value={form.code}
            onChange={set('code')}
            placeholder="e.g. WELCOME20"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
          <select
            value={form.type}
            onChange={set('type')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          >
            <option value="PERCENT_BONUS">Percent Bonus — adds X% bonus credits</option>
            <option value="FLAT_BONUS">Flat Bonus — adds X flat credits</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Value * {form.type === 'PERCENT_BONUS' ? '(%)' : '(credits)'}
          </label>
          <input
            type="number"
            value={form.value}
            onChange={set('value')}
            placeholder={form.type === 'PERCENT_BONUS' ? 'e.g. 20' : 'e.g. 500'}
            min={1}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            required
          />
          <p className="text-xs text-gray-400 mt-1">
            {form.type === 'PERCENT_BONUS'
              ? 'User receives their purchase amount plus this % on top as bonus credits.'
              : 'User receives this many bonus credits added to their balance.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Uses</label>
            <input
              type="number"
              value={form.maxUses}
              onChange={set('maxUses')}
              placeholder="Unlimited"
              min={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Purchase (USD)</label>
            <input
              type="number"
              value={form.minAmountUSD}
              onChange={set('minAmountUSD')}
              placeholder="None"
              min={0}
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
          <input
            type="datetime-local"
            value={form.expiresAt}
            onChange={set('expiresAt')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Create Code</Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteConfirmModal({ isOpen, promoCode, onClose, onConfirm, loading }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Promo Code" size="sm">
      <p className="text-sm text-gray-600 mb-6">
        Are you sure you want to delete the promo code{' '}
        <span className="font-mono font-semibold text-gray-900">{promoCode?.code}</span>?
        This action cannot be undone.
      </p>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>Delete</Button>
      </div>
    </Modal>
  );
}

export default function AdminPromoCodesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['adminPromoCodes'],
    queryFn: () => getPromoCodes().then((r) => r.data.data),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => updatePromoCode(id, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adminPromoCodes'] });
      toast.success('Promo code updated');
    },
    onError: () => toast.error('Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deletePromoCode(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adminPromoCodes'] });
      toast.success('Promo code deleted');
      setDeleteTarget(null);
    },
    onError: () => toast.error('Delete failed'),
  });

  const promoCodes = data?.promoCodes || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-gray-900">Promo Codes</h1>
        <Button onClick={() => setShowCreate(true)}>
          <FiPlus size={16} /> New Code
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200">
            <tr className="text-xs text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3">Code</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-right px-4 py-3">Value</th>
              <th className="text-right px-4 py-3">Uses</th>
              <th className="text-left px-4 py-3">Min Purchase</th>
              <th className="text-left px-4 py-3">Expires</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan="8" className="text-center py-8 text-gray-400">Loading...</td>
              </tr>
            ) : !promoCodes.length ? (
              <tr>
                <td colSpan="8" className="text-center py-8 text-gray-400">No promo codes yet. Create one above.</td>
              </tr>
            ) : promoCodes.map((pc) => {
              const isExpired = pc.expiresAt && dayjs(pc.expiresAt).isBefore(dayjs());
              const isExhausted = pc.maxUses && pc.usedCount >= pc.maxUses;
              return (
                <tr key={pc._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-gray-900">{pc.code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      label={pc.type === 'PERCENT_BONUS' ? 'Percent' : 'Flat'}
                      variant={pc.type === 'PERCENT_BONUS' ? 'PURCHASE' : 'PAYSTACK'}
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num font-semibold text-gray-900">
                    {pc.type === 'PERCENT_BONUS' ? `${pc.value}%` : `+${pc.value.toLocaleString()} cr`}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-gray-600">
                    {pc.usedCount ?? 0}
                    {pc.maxUses ? (
                      <span className="text-gray-400"> / {pc.maxUses}</span>
                    ) : (
                      <span className="text-gray-400"> / ∞</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {pc.minAmountUSD ? `$${pc.minAmountUSD}` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {pc.expiresAt ? (
                      <span className={isExpired ? 'text-red-500' : ''}>
                        {dayjs(pc.expiresAt).format('MMM D, YYYY HH:mm')}
                      </span>
                    ) : (
                      <span className="text-gray-300">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isExpired ? (
                      <Badge label="expired" variant="expired" />
                    ) : isExhausted ? (
                      <Badge label="exhausted" variant="expired" />
                    ) : (
                      <Badge label={pc.isActive ? 'active' : 'inactive'} variant={pc.isActive ? 'active' : 'expired'} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => toggleMutation.mutate({ id: pc._id, isActive: !pc.isActive })}
                        className="text-gray-400 hover:text-brand-600 transition-colors"
                        title={pc.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {pc.isActive
                          ? <FiToggleRight size={20} className="text-brand-600" />
                          : <FiToggleLeft size={20} />}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(pc)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <CreatePromoModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => qc.invalidateQueries({ queryKey: ['adminPromoCodes'] })}
      />

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        promoCode={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
