import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '../../api/admin';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import toast from 'react-hot-toast';

function SettingField({ label, description, value, onChange, type = 'text', min, max }) {
  return (
    <div className="flex items-start justify-between gap-8 py-4 border-b border-gray-100 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        min={min}
        max={max}
        className="w-36 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-right font-mono-num focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['adminSettings'],
    queryFn: () => getSettings().then((r) => r.data.data),
  });

  useEffect(() => {
    if (data?.settings && !form) {
      const map = {};
      data.settings.forEach((s) => { map[s.key] = s.value; });
      setForm(map);
    }
  }, [data, form]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(form);
      queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  if (isLoading || !form) return <p className="text-gray-400 text-sm text-center py-12">Loading...</p>;

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-gray-900">Platform Settings</h1>
        <Button loading={saving} onClick={handleSave}>Save All</Button>
      </div>

      <Card className="px-6 py-2">
        <h2 className="font-semibold text-gray-900 pt-4 mb-2">General</h2>
        <SettingField
          label="Default Margin %"
          description="Markup applied over provider cost for all new pricing entries"
          value={form.default_margin_percent ?? 30}
          onChange={set('default_margin_percent')}
          type="number"
          min={0}
          max={1000}
        />
        <SettingField
          label="Number Timeout (minutes)"
          description="How long a rented number stays active before auto-expiry"
          value={form.number_timeout_minutes ?? 20}
          onChange={set('number_timeout_minutes')}
          type="number"
          min={1}
          max={60}
        />
        <SettingField
          label="Max Active Numbers per User"
          description="Maximum concurrent active number orders allowed per account"
          value={form.max_active_numbers_per_user ?? 5}
          onChange={set('max_active_numbers_per_user')}
          type="number"
          min={1}
          max={50}
        />
        <SettingField
          label="Minimum Top-up (USD)"
          description="Minimum amount in USD allowed for a single credit purchase"
          value={form.min_topup_usd ?? 2}
          onChange={set('min_topup_usd')}
          type="number"
          min={0.5}
        />
      </Card>

      <Card className="px-6 py-2">
        <h2 className="font-semibold text-gray-900 pt-4 mb-2">SMS & Data Retention</h2>
        <SettingField
          label="SMS Retention (hours)"
          description="How many hours SMS content is stored before being deleted"
          value={form.sms_retention_hours ?? 48}
          onChange={set('sms_retention_hours')}
          type="number"
          min={1}
          max={720}
        />
        <SettingField
          label="SMS Poll Interval (seconds)"
          description="How often the backend polls the SMS provider for new messages"
          value={form.sms_poll_interval_seconds ?? 5}
          onChange={set('sms_poll_interval_seconds')}
          type="number"
          min={2}
          max={60}
        />
      </Card>

      <Card className="px-6 py-2">
        <h2 className="font-semibold text-gray-900 pt-4 mb-2">Primary SMS Provider</h2>
        <SettingField
          label="Active Provider"
          description="Primary provider: '5sim' or 'smsactivate'"
          value={form.sms_provider ?? '5sim'}
          onChange={set('sms_provider')}
        />
      </Card>

      <Card className="px-6 py-2">
        <h2 className="font-semibold text-gray-900 pt-4 mb-2">Crypto Payments</h2>
        <SettingField
          label="CoinGate Environment"
          description="'sandbox' for testing, 'live' for production"
          value={form.coingate_environment ?? 'sandbox'}
          onChange={set('coingate_environment')}
        />
      </Card>
    </div>
  );
}
