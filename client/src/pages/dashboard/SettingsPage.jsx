import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { updateMe, changePassword } from '../../api/user';
import { getMe } from '../../api/user';
import useAuthStore from '../../store/authStore';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [profile, setProfile] = useState({ name: user?.name || '', avatar: user?.avatar || '' });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await updateMe({ name: profile.name });
      useAuthStore.setState({ user: data.data.user });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Update failed');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (password.newPassword !== password.confirm) { toast.error('Passwords do not match'); return; }
    setSavingPassword(true);
    try {
      await changePassword({ currentPassword: password.currentPassword, newPassword: password.newPassword });
      toast.success('Password updated');
      setPassword({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Password update failed');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="font-display font-bold text-2xl text-gray-900">Profile & Settings</h1>

      {/* Profile */}
      <Card className="p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Profile</h2>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            {user?.avatar ? (
              <img src={user.avatar} className="w-16 h-16 rounded-full object-cover" alt="" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-brand-600 flex items-center justify-center text-white text-2xl font-bold">
                {user?.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900">{user?.name}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{user?.provider}</span>
            </div>
          </div>
          <Input label="Full name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          <Input label="Email" value={user?.email || ''} disabled />
          <Button type="submit" loading={savingProfile}>Save Changes</Button>
        </form>
      </Card>

      {/* Security */}
      {user?.provider === 'LOCAL' && (
        <Card className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Change Password</h2>
          <form onSubmit={handlePasswordSave} className="space-y-4">
            <Input label="Current password" type="password" value={password.currentPassword} onChange={(e) => setPassword({ ...password, currentPassword: e.target.value })} required />
            <Input label="New password" type="password" value={password.newPassword} onChange={(e) => setPassword({ ...password, newPassword: e.target.value })} required placeholder="Min. 8 characters" />
            <Input label="Confirm new password" type="password" value={password.confirm} onChange={(e) => setPassword({ ...password, confirm: e.target.value })} required />
            <Button type="submit" loading={savingPassword}>Update Password</Button>
          </form>
        </Card>
      )}

      {/* Account info */}
      <Card className="p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Account Information</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Member since</span>
            <span className="text-gray-900">{new Date(user?.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Account type</span>
            <span className="text-gray-900">{user?.provider}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Email verified</span>
            <span className={user?.isEmailVerified ? 'text-green-600' : 'text-yellow-600'}>{user?.isEmailVerified ? 'Verified' : 'Not verified'}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
