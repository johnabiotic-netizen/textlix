import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiCopy, FiCheck, FiUsers, FiGift } from 'react-icons/fi';
import { updateMe, changePassword, getReferral } from '../../api/user';
import useAuthStore from '../../store/authStore';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState({ name: user?.name || '', avatar: user?.avatar || '' });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(user?.emailNotifications ?? true);

  const { data: referralData } = useQuery({
    queryKey: ['referral'],
    queryFn: () => getReferral().then((r) => r.data.data),
  });

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

  const handleCopy = () => {
    if (!referralData?.referralLink) return;
    navigator.clipboard.writeText(referralData.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNotifToggle = async (val) => {
    setEmailNotifications(val);
    setNotifSaving(true);
    try {
      const { data } = await updateMe({ emailNotifications: val });
      useAuthStore.setState({ user: data.data.user });
      toast.success(val ? 'Email notifications enabled' : 'Email notifications disabled');
    } catch (err) {
      setEmailNotifications(!val);
      toast.error('Failed to update notification setting');
    } finally {
      setNotifSaving(false);
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

      {/* Referral Program */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <FiGift className="text-brand-600" size={18} />
          <h2 className="font-semibold text-gray-900">Referral Program</h2>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Share your link. When a friend signs up and makes their first purchase, you get <strong className="text-gray-700">10% of their credits</strong> as a bonus.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-brand-50 rounded-xl p-4 text-center">
            <FiUsers className="mx-auto text-brand-600 mb-1" size={20} />
            <p className="text-2xl font-bold text-gray-900">{referralData?.referredCount ?? '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">Friends referred</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <FiGift className="mx-auto text-green-600 mb-1" size={20} />
            <p className="text-2xl font-bold text-gray-900">{referralData?.bonusEarned ?? '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">Bonus credits earned</p>
          </div>
        </div>

        {/* Link + copy */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-600 truncate font-mono">
            {referralData?.referralLink ?? 'Loading...'}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Notifications</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">SMS arrival emails</p>
            <p className="text-xs text-gray-500 mt-0.5">Get an email with your verification code the moment an SMS arrives</p>
          </div>
          <button
            disabled={notifSaving}
            onClick={() => handleNotifToggle(!emailNotifications)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${emailNotifications ? 'bg-brand-600' : 'bg-gray-300'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${emailNotifications ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>
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
