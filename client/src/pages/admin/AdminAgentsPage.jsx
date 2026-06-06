import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminListAgents, adminCreateAgent, adminUpdateAgent } from '../../api/support';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';

const SECTION_LABELS = {
  support: 'Support', overview: 'Overview', users: 'Users', transactions: 'Transactions',
  payments: 'Payments', orders: 'Orders', catalog: 'Catalog', pricing: 'Pricing',
  settings: 'Settings', 'promo-codes': 'Promo Codes', reports: 'Reports', creators: 'Creators',
};

function AgentRow({ agent, sections, onChange }) {
  const [perms, setPerms] = useState(agent.permissions || []);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const toggle = (s) => setPerms((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const save = async () => {
    setSaving(true);
    try { await adminUpdateAgent(agent.id, { permissions: perms }); toast.success('Access updated'); onChange(); }
    catch (e) { toast.error(e?.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const setActive = async (active) => {
    try { await adminUpdateAgent(agent.id, { active }); toast.success(active ? 'Agent activated' : 'Agent deactivated'); onChange(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 py-3 last:border-0">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
            {agent.name} {!agent.active && <span className="text-xs text-red-500">(inactive)</span>}
          </p>
          <p className="text-xs text-gray-400 truncate">{agent.email}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-center"><p className="text-sm font-semibold text-gray-900 dark:text-white">{agent.resolved}</p><p className="text-[10px] text-gray-400">resolved</p></div>
          <div className="text-center"><p className="text-sm font-semibold text-gray-900 dark:text-white">{agent.handling}</p><p className="text-[10px] text-gray-400">handling</p></div>
          <button onClick={() => setOpen((o) => !o)} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">{open ? 'Close' : 'Access'}</button>
          <button onClick={() => setActive(!agent.active)} className={`text-xs px-2.5 py-1 rounded-lg ${agent.active ? 'border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800' : 'bg-green-600 text-white hover:bg-green-700'}`}>{agent.active ? 'Deactivate' : 'Activate'}</button>
        </div>
      </div>
      {open && (
        <div className="mt-3">
          <p className="text-xs text-gray-400 mb-2">Sections this agent can access (Support is always on):</p>
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => {
              const on = perms.includes(s);
              const locked = s === 'support';
              return (
                <button
                  key={s}
                  type="button"
                  disabled={locked}
                  onClick={() => toggle(s)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${on ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'} ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {SECTION_LABELS[s] || s}
                </button>
              );
            })}
          </div>
          <div className="mt-3"><Button size="sm" loading={saving} onClick={save}>Save access</Button></div>
        </div>
      )}
    </div>
  );
}

export default function AdminAgentsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['adminAgents'],
    queryFn: () => adminListAgents().then((r) => r.data.data),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['adminAgents'] });

  const create = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return toast.error('Fill in all fields');
    setCreating(true);
    try {
      await adminCreateAgent(form);
      toast.success('Agent created');
      setForm({ name: '', email: '', password: '' });
      refresh();
    } catch (e2) {
      toast.error(e2?.response?.data?.error?.message || 'Failed to create agent');
    } finally {
      setCreating(false);
    }
  };

  const agents = data?.agents || [];
  const sections = data?.sections || [];

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Support Agents</h1>

      <Card className="p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Create an agent</h2>
        <form onSubmit={create} className="grid sm:grid-cols-3 gap-3">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@textlix.com" />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 8 chars" />
          <div className="sm:col-span-3"><Button type="submit" loading={creating}>Create agent</Button></div>
        </form>
        <p className="text-xs text-gray-400 mt-3">Agents can access the Support console by default. Grant more sections per agent in the list below.</p>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Agents</h2>
        {isLoading ? (
          <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
        ) : agents.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No agents yet — create one above.</p>
        ) : (
          agents.map((a) => <AgentRow key={a.id} agent={a} sections={sections} onChange={refresh} />)
        )}
      </Card>
    </div>
  );
}
