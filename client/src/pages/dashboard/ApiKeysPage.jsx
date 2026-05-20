import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { FiPlus, FiTrash2, FiCopy, FiCheck, FiKey, FiAlertTriangle } from 'react-icons/fi';
import { getApiKeys, createApiKey, deleteApiKey } from '../../api/user';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';

const MAX_KEYS = 5;
const API_BASE_URL = 'https://textlix.com/api/v1';

function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed — please select and copy manually');
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
        copied ? 'text-green-600' : 'text-brand-600 hover:text-brand-700'
      } ${className}`}
    >
      {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function GenerateKeyModal({ isOpen, onClose, onGenerated }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a name for this key');
      return;
    }
    setSaving(true);
    try {
      const { data } = await createApiKey({ name: name.trim() });
      setName('');
      onClose();
      onGenerated(data.data);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to create API key');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setName('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Generate API Key" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Key Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Production App, My Script"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            autoFocus
            required
          />
          <p className="text-xs text-gray-400 mt-1">A descriptive label to identify where this key is used.</p>
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Generate Key</Button>
        </div>
      </form>
    </Modal>
  );
}

function NewKeyRevealModal({ isOpen, keyData, onClose }) {
  if (!keyData) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Your New API Key" size="md">
      <div className="space-y-4">
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <FiAlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 font-semibold leading-snug">
            This key will not be shown again. Copy and store it somewhere safe now.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">API Key</label>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <code className="flex-1 text-sm font-mono text-gray-800 break-all select-all">
              {keyData.key}
            </code>
            <CopyButton text={keyData.key} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Name</p>
            <p className="text-gray-800">{keyData.name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Prefix</p>
            <p className="font-mono text-gray-600">{keyData.prefix}…</p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onClose}>Done — I've saved my key</Button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteConfirmModal({ isOpen, apiKey, onClose, onConfirm, loading }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete API Key" size="sm">
      <p className="text-sm text-gray-600 mb-2">
        Are you sure you want to delete the key{' '}
        <span className="font-mono font-semibold text-gray-900">{apiKey?.prefix}…</span>
        {apiKey?.name && (
          <span className="text-gray-500"> ({apiKey.name})</span>
        )}?
      </p>
      <p className="text-sm text-red-600 mb-6">Any apps using this key will immediately stop working.</p>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>Delete Key</Button>
      </div>
    </Modal>
  );
}

export default function ApiKeysPage() {
  const qc = useQueryClient();
  const [showGenerate, setShowGenerate] = useState(false);
  const [newKeyData, setNewKeyData] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [copiedBaseUrl, setCopiedBaseUrl] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => getApiKeys().then((r) => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteApiKey(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apiKeys'] });
      toast.success('API key deleted');
      setDeleteTarget(null);
    },
    onError: () => toast.error('Delete failed'),
  });

  const keys = data?.keys || [];
  const atLimit = keys.length >= MAX_KEYS;

  const handleGenerated = (keyData) => {
    qc.invalidateQueries({ queryKey: ['apiKeys'] });
    setNewKeyData(keyData);
  };

  const handleCopyBaseUrl = async () => {
    try {
      await navigator.clipboard.writeText(API_BASE_URL);
      setCopiedBaseUrl(true);
      setTimeout(() => setCopiedBaseUrl(false), 2000);
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">API Keys</h1>
          <p className="text-sm text-gray-500 mt-1">Use API keys to access textlix programmatically.</p>
        </div>
        <Button
          onClick={() => setShowGenerate(true)}
          disabled={atLimit}
          title={atLimit ? `Maximum ${MAX_KEYS} keys allowed` : undefined}
        >
          <FiPlus size={16} /> Generate Key
        </Button>
      </div>

      {/* API base URL callout */}
      <Card className="p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">API Base URL</p>
        <div className="flex items-center gap-3">
          <code className="flex-1 text-sm font-mono text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            {API_BASE_URL}
          </code>
          <button
            onClick={handleCopyBaseUrl}
            className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors flex-shrink-0 ${
              copiedBaseUrl ? 'text-green-600' : 'text-brand-600 hover:text-brand-700'
            }`}
          >
            {copiedBaseUrl ? <FiCheck size={14} /> : <FiCopy size={14} />}
            {copiedBaseUrl ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Authenticate all requests with{' '}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">Authorization: Bearer {'<key>'}</code>.
          All authenticated API endpoints are available to API keys.
        </p>
      </Card>

      {/* Keys list */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <p className="text-center py-8 text-gray-400 text-sm">Loading...</p>
        ) : !keys.length ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <FiKey size={22} className="text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm font-medium">No API keys yet</p>
            <p className="text-gray-400 text-xs mt-1">Generate your first key to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200">
              <tr className="text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Key Prefix</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-left px-4 py-3">Last Used</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map((k) => (
                <tr key={k._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{k.name || <span className="text-gray-400 font-normal">Unnamed</span>}</td>
                  <td className="px-4 py-3 font-mono text-gray-600">{k.prefix}…</td>
                  <td className="px-4 py-3 text-gray-500">{dayjs(k.createdAt).format('MMM D, YYYY')}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {k.lastUsedAt ? dayjs(k.lastUsedAt).format('MMM D, YYYY') : <span className="text-gray-300">Never</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDeleteTarget(k)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete key"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {atLimit && (
          <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 font-medium">
            You have reached the maximum of {MAX_KEYS} API keys. Delete an existing key to create a new one.
          </div>
        )}
      </Card>

      <GenerateKeyModal
        isOpen={showGenerate}
        onClose={() => setShowGenerate(false)}
        onGenerated={handleGenerated}
      />

      <NewKeyRevealModal
        isOpen={!!newKeyData}
        keyData={newKeyData}
        onClose={() => setNewKeyData(null)}
      />

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        apiKey={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
