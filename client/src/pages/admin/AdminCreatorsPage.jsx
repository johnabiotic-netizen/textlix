import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminGetApplications, adminGetCreators, adminApproveCreator, adminRejectCreator, adminGetWithdrawals, adminMarkWithdrawalPaid, adminRejectWithdrawal } from '../../api/creator';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';

const fmt = (n) => `₦${Number(n || 0).toLocaleString()}`;

export default function AdminCreatorsPage() {
  const [tab, setTab] = useState('applications');
  // Inline note modal: { open, title, label, required, placeholder, onSubmit(note) }
  const [actionModal, setActionModal] = useState(null);
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const qc = useQueryClient();

  const askNote = (cfg) => {
    setActionNote('');
    setActionModal(cfg);
  };

  const submitNote = async () => {
    if (!actionModal) return;
    if (actionModal.required && !actionNote.trim()) {
      toast.error(`${actionModal.label} is required`);
      return;
    }
    setActionLoading(true);
    try {
      await actionModal.onSubmit(actionNote);
      setActionModal(null);
    } finally {
      setActionLoading(false);
    }
  };

  const { data: applicationsData } = useQuery({
    queryKey: ['adminApplications', 'pending'],
    queryFn: () => adminGetApplications('pending').then((r) => r.data.data.applications),
    enabled: tab === 'applications',
  });

  const { data: creators } = useQuery({
    queryKey: ['adminCreators'],
    queryFn: () => adminGetCreators().then((r) => r.data.data.creators),
    enabled: tab === 'creators',
  });

  const { data: withdrawals } = useQuery({
    queryKey: ['adminWithdrawals', 'pending'],
    queryFn: () => adminGetWithdrawals('pending').then((r) => r.data.data.withdrawals),
    enabled: tab === 'withdrawals',
  });

  const approve = (id) => askNote({
    open: true,
    title: 'Approve creator',
    label: 'Approval note (optional)',
    placeholder: 'Welcome! Glad to have you on board.',
    confirmLabel: 'Approve',
    onSubmit: async (note) => {
      try {
        await adminApproveCreator(id, note);
        toast.success('Creator approved');
        qc.invalidateQueries({ queryKey: ['adminApplications'] });
      } catch { toast.error('Failed'); }
    },
  });

  const reject = (id) => askNote({
    open: true,
    title: 'Reject application',
    label: 'Rejection reason',
    placeholder: 'Tell the applicant why',
    required: true,
    confirmLabel: 'Reject',
    danger: true,
    onSubmit: async (note) => {
      try {
        await adminRejectCreator(id, note);
        toast.success('Application rejected');
        qc.invalidateQueries({ queryKey: ['adminApplications'] });
      } catch { toast.error('Failed'); }
    },
  });

  const markPaid = (id) => askNote({
    open: true,
    title: 'Mark withdrawal as paid',
    label: 'Payment reference / note (optional)',
    placeholder: 'Bank transaction ID',
    confirmLabel: 'Mark as paid',
    onSubmit: async (note) => {
      try {
        await adminMarkWithdrawalPaid(id, note);
        toast.success('Marked as paid');
        qc.invalidateQueries({ queryKey: ['adminWithdrawals'] });
      } catch { toast.error('Failed'); }
    },
  });

  const rejectW = (id) => askNote({
    open: true,
    title: 'Reject withdrawal',
    label: 'Rejection reason',
    placeholder: 'Why is this being rejected?',
    required: true,
    confirmLabel: 'Reject',
    danger: true,
    onSubmit: async (note) => {
      try {
        await adminRejectWithdrawal(id, note);
        toast.success('Withdrawal rejected');
        qc.invalidateQueries({ queryKey: ['adminWithdrawals'] });
      } catch { toast.error('Failed'); }
    },
  });

  const tabs = ['applications', 'creators', 'withdrawals'];

  return (
    <div className="space-y-6">
      <h1 className="font-display font-bold text-2xl text-gray-900">Creator Program</h1>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Applications */}
      {tab === 'applications' && (
        <div className="space-y-4">
          {!applicationsData?.length ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100">No pending applications</div>
          ) : applicationsData.map((app) => (
            <div key={app._id} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-semibold text-gray-900">{app.name}</p>
                  <p className="text-sm text-gray-500">{app.email}</p>
                  <p className="text-xs text-gray-400 mt-1">Applied {new Date(app.creatorProfile?.appliedAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approve(app._id)} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">Approve</button>
                  <button onClick={() => reject(app._id)} className="px-4 py-2 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 text-red-600">Reject</button>
                </div>
              </div>

              <div className="space-y-2">
                {app.creatorProfile?.platforms?.map((p, i) => (
                  <div key={i} className="text-sm flex gap-4">
                    <span className="font-medium text-gray-700 w-24">{p.platform}</span>
                    <span className="text-gray-500">{p.handle}</span>
                    {p.followerCount > 0 && <span className="text-gray-400">{p.followerCount.toLocaleString()} followers</span>}
                  </div>
                ))}
              </div>

              {app.creatorProfile?.proofLinks?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Proof</p>
                  {app.creatorProfile.proofLinks.map((link, i) => (
                    <a key={i} href={link} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 hover:underline truncate">{link}</a>
                  ))}
                </div>
              )}

              {app.creatorProfile?.bio && (
                <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{app.creatorProfile.bio}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Creators */}
      {tab === 'creators' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Creator</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Referrals</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Total Earned</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Pending</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Withdrawn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(creators || []).map((c) => (
                <tr key={c._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.email}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{c.referralCount}</td>
                  <td className="px-6 py-4 text-right font-medium text-gray-800">{fmt(c.totalEarningsNaira)}</td>
                  <td className="px-6 py-4 text-right text-emerald-700 font-medium">{fmt(c.pendingEarningsNaira)}</td>
                  <td className="px-6 py-4 text-right text-gray-500">{fmt(c.withdrawnNaira)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!creators?.length && <div className="text-center py-12 text-gray-400 text-sm">No approved creators yet</div>}
        </div>
      )}

      {/* Withdrawals */}
      {tab === 'withdrawals' && (
        <div className="space-y-4">
          {!withdrawals?.length ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100">No pending withdrawals</div>
          ) : withdrawals.map((w) => (
            <div key={w._id} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{fmt(w.amountNaira)}</p>
                <p className="text-sm text-gray-500">{w.creatorId?.name} · {w.creatorId?.email}</p>
                <div className="text-sm text-gray-600 mt-2 space-y-0.5">
                  <p>{w.bankAccount?.bankName}</p>
                  <p className="font-mono">{w.bankAccount?.accountNumber}</p>
                  <p>{w.bankAccount?.accountName}</p>
                </div>
                <p className="text-xs text-gray-400 mt-1">Requested {new Date(w.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => markPaid(w._id)} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">Mark as Paid</button>
                <button onClick={() => rejectW(w._id)} className="px-4 py-2 border border-gray-200 text-sm font-medium rounded-lg text-red-600 hover:bg-gray-50">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!actionModal?.open}
        onClose={() => !actionLoading && setActionModal(null)}
        title={actionModal?.title || ''}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {actionModal?.label}{actionModal?.required ? ' *' : ''}
            </label>
            <textarea
              autoFocus
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder={actionModal?.placeholder || ''}
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setActionModal(null)} disabled={actionLoading} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={submitNote}
              loading={actionLoading}
              className={`flex-1 ${actionModal?.danger ? '!bg-red-600 hover:!bg-red-700' : ''}`}
            >
              {actionModal?.confirmLabel || 'Confirm'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
