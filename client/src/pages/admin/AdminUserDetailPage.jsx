import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { getUser, updateUser, deleteUser, adjustCredits, getTransactions, getOrders } from '../../api/admin';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Pagination from '../../components/common/Pagination';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';
import { MdArrowBack } from 'react-icons/md';

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [txPage, setTxPage] = useState(1);
  const [ordPage, setOrdPage] = useState(1);
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ amount: '', note: '' });

  const { data: userData, isLoading } = useQuery({
    queryKey: ['adminUser', id],
    queryFn: () => getUser(id).then((r) => r.data.data),
  });

  const { data: txData } = useQuery({
    queryKey: ['adminUserTx', id, txPage],
    queryFn: () => getTransactions({ userId: id, page: txPage, limit: 10 }).then((r) => r.data.data),
  });

  const { data: ordData } = useQuery({
    queryKey: ['adminUserOrders', id, ordPage],
    queryFn: () => getOrders({ userId: id, page: ordPage, limit: 10 }).then((r) => r.data.data),
  });

  const banMutation = useMutation({
    mutationFn: () => updateUser(id, { isBanned: !userData?.user?.isBanned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUser', id] });
      toast.success(userData?.user?.isBanned ? 'User unbanned' : 'User banned');
    },
    onError: () => toast.error('Action failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteUser(id),
    onSuccess: () => {
      toast.success('User deleted');
      navigate('/admin/users');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Delete failed'),
  });

  const handleDelete = () => {
    if (window.confirm(`Delete ${user?.name} (${user?.email})? This cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const adjustMutation = useMutation({
    mutationFn: () => adjustCredits(id, { amount: Number(adjustForm.amount), note: adjustForm.note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUser', id] });
      queryClient.invalidateQueries({ queryKey: ['adminUserTx', id] });
      toast.success('Credits adjusted');
      setAdjustModal(false);
      setAdjustForm({ amount: '', note: '' });
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Adjustment failed'),
  });

  if (isLoading) return <p className="text-gray-400 text-sm text-center py-12">Loading...</p>;

  const user = userData?.user;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link to="/admin/users" className="text-gray-400 hover:text-gray-700 transition-colors">
          <MdArrowBack size={22} />
        </Link>
        <h1 className="font-display font-bold text-2xl text-gray-900">User Detail</h1>
      </div>

      {/* Profile card */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="p-6 md:col-span-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {user?.avatar ? (
                <img src={user.avatar} className="w-14 h-14 rounded-full object-cover" alt="" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-brand-600 flex items-center justify-center text-white text-xl font-bold">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900 text-lg">{user?.name}</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{user?.role}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{user?.provider}</span>
                  {user?.isBanned && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">BANNED</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setAdjustModal(true)}>Adjust Credits</Button>
              <Button size="sm" variant={user?.isBanned ? 'secondary' : 'danger'} loading={banMutation.isPending} onClick={() => banMutation.mutate()}>
                {user?.isBanned ? 'Unban' : 'Ban'}
              </Button>
              <Button size="sm" variant="danger" loading={deleteMutation.isPending} onClick={handleDelete}>Delete</Button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Joined</p>
              <p className="font-medium text-gray-900">{dayjs(user?.createdAt).format('MMM D, YYYY')}</p>
            </div>
            <div>
              <p className="text-gray-400">Last active</p>
              <p className="font-medium text-gray-900">{user?.lastLoginAt ? dayjs(user.lastLoginAt).format('MMM D, YYYY HH:mm') : 'Never'}</p>
            </div>
            <div>
              <p className="text-gray-400">Email verified</p>
              <p className={user?.isEmailVerified ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>{user?.isEmailVerified ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="text-gray-400">Max active numbers</p>
              <p className="font-medium text-gray-900">{user?.maxActiveNumbers ?? 5}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Credit Stats</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Current balance</span>
              <span className="font-mono-num font-bold text-gray-900">{user?.creditBalance?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total purchased</span>
              <span className="font-mono-num text-green-600">{userData?.stats?.totalPurchased?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total spent</span>
              <span className="font-mono-num text-red-600">{userData?.stats?.totalSpent?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total refunded</span>
              <span className="font-mono-num text-blue-600">{userData?.stats?.totalRefunded?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-3">
              <span className="text-gray-500">Numbers ordered</span>
              <span className="font-mono-num text-gray-900">{userData?.stats?.numbersOrdered || 0}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Transaction history */}
      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Transactions</h3>
        {!txData?.transactions?.length ? (
          <p className="text-sm text-gray-400 text-center py-4">No transactions</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-left py-2">Description</th>
                    <th className="text-right py-2">Amount</th>
                    <th className="text-right py-2">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {txData.transactions.map((tx) => (
                    <tr key={tx._id} className="hover:bg-gray-50">
                      <td className="py-2 text-gray-500 whitespace-nowrap">{dayjs(tx.createdAt).format('MMM D, HH:mm')}</td>
                      <td className="py-2"><Badge label={tx.type} variant={tx.type} /></td>
                      <td className="py-2 text-gray-700">{tx.description}</td>
                      <td className={`py-2 text-right font-mono-num font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                      </td>
                      <td className="py-2 text-right font-mono-num text-gray-500">{tx.balanceAfter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <Pagination page={txPage} pages={txData.pages} total={txData.total} limit={10} onPage={setTxPage} />
            </div>
          </>
        )}
      </Card>

      {/* Orders */}
      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Number Orders</h3>
        {!ordData?.orders?.length ? (
          <p className="text-sm text-gray-400 text-center py-4">No orders</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Number</th>
                    <th className="text-left py-2">Country</th>
                    <th className="text-left py-2">Service</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-right py-2">Credits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ordData.orders.map((order) => (
                    <tr key={order._id} className="hover:bg-gray-50">
                      <td className="py-2 text-gray-500 whitespace-nowrap">{dayjs(order.createdAt).format('MMM D, HH:mm')}</td>
                      <td className="py-2 font-mono-num text-xs">{order.phoneNumber}</td>
                      <td className="py-2">{order.countryId?.flagEmoji} {order.countryId?.name}</td>
                      <td className="py-2">{order.serviceId?.name}</td>
                      <td className="py-2"><Badge label={order.status.toLowerCase()} variant={order.status.toLowerCase()} /></td>
                      <td className="py-2 text-right font-mono-num">{order.creditsCharged}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <Pagination page={ordPage} pages={ordData.pages} total={ordData.total} limit={10} onPage={setOrdPage} />
            </div>
          </>
        )}
      </Card>

      {/* Adjust credits modal */}
      <Modal isOpen={adjustModal} onClose={() => setAdjustModal(false)} title="Adjust Credits" size="sm">
        <div className="space-y-4">
          <Input
            label="Amount (positive to add, negative to deduct)"
            type="number"
            value={adjustForm.amount}
            onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })}
            placeholder="e.g. 500 or -100"
          />
          <Input
            label="Note / Reason"
            value={adjustForm.note}
            onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
            placeholder="Admin adjustment reason"
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setAdjustModal(false)}>Cancel</Button>
            <Button className="flex-1" loading={adjustMutation.isPending} onClick={() => adjustMutation.mutate()} disabled={!adjustForm.amount || !adjustForm.note}>
              Apply
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
