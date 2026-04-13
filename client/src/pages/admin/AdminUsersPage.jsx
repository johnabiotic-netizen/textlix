import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { FiSearch, FiEye, FiUserX, FiUserCheck } from 'react-icons/fi';
import { getUsers, updateUser } from '../../api/admin';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import Button from '../../components/common/Button';
import toast from 'react-hot-toast';

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['adminUsers', search, status, page],
    queryFn: () => getUsers({ page, limit: 20, search, status }).then((r) => r.data.data),
  });

  const handleBan = async (user) => {
    try {
      await updateUser(user._id, { isBanned: !user.isBanned, banReason: user.isBanned ? null : 'Banned by admin' });
      qc.invalidateQueries(['adminUsers']);
      toast.success(user.isBanned ? 'User unbanned' : 'User banned');
    } catch {
      toast.error('Action failed');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display font-bold text-2xl text-gray-900">Users</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none">
          <option value="">All users</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200">
            <tr className="text-xs text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-right px-4 py-3">Credits</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Joined</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan="6" className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : !data?.users?.length ? (
              <tr><td colSpan="6" className="text-center py-8 text-gray-400">No users found</td></tr>
            ) : data.users.map((user) => (
              <tr key={user._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {user.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><Badge label={user.role} variant={user.role} /></td>
                <td className="px-4 py-3 text-right font-mono-num">{user.creditBalance?.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <Badge label={user.isBanned ? 'banned' : 'active'} variant={user.isBanned ? 'banned' : 'active'} />
                </td>
                <td className="px-4 py-3 text-gray-500">{dayjs(user.createdAt).format('MMM D, YYYY')}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <Link to={`/admin/users/${user._id}`}>
                      <Button variant="outline" size="sm"><FiEye size={14} /></Button>
                    </Link>
                    <Button variant={user.isBanned ? 'outline' : 'danger'} size="sm" onClick={() => handleBan(user)}>
                      {user.isBanned ? <FiUserCheck size={14} /> : <FiUserX size={14} />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {data && <Pagination page={page} pages={data.pages} total={data.total} limit={20} onPage={setPage} />}
    </div>
  );
}
