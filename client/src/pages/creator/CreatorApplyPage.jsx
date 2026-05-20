import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { applyCreator, getCreatorMe } from '../../api/creator';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { FiPlus, FiX } from 'react-icons/fi';

const PLATFORMS = ['WhatsApp', 'TikTok', 'Instagram', 'Facebook', 'YouTube', 'Twitter/X', 'Telegram', 'Other'];

export default function CreatorApplyPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [platforms, setPlatforms] = useState([{ platform: '', handle: '', followerCount: '' }]);
  const [bio, setBio] = useState('');
  const [proofLinks, setProofLinks] = useState(['']);

  const { data: creatorData } = useQuery({
    queryKey: ['creatorMe'],
    queryFn: () => getCreatorMe().then((r) => r.data.data.creator),
    enabled: !!user,
    retry: false,
  });

  if (creatorData?.creatorStatus === 'approved') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
          <p className="text-4xl mb-4">✅</p>
          <h2 className="font-bold text-xl text-gray-900 mb-2">You're already approved!</h2>
          <Link to="/dashboard" className="mt-4 inline-block bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium">Go to Dashboard</Link>
        </div>
      </div>
    );
  }

  if (creatorData?.creatorStatus === 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
          <p className="text-4xl mb-4">⏳</p>
          <h2 className="font-bold text-xl text-gray-900 mb-2">Application under review</h2>
          <p className="text-gray-500 text-sm">We'll review your application within 24–48 hours and notify you.</p>
        </div>
      </div>
    );
  }

  const addPlatform = () => setPlatforms([...platforms, { platform: '', handle: '', followerCount: '' }]);
  const removePlatform = (i) => setPlatforms(platforms.filter((_, idx) => idx !== i));
  const updatePlatform = (i, field, value) => {
    const updated = [...platforms];
    updated[i] = { ...updated[i], [field]: value };
    setPlatforms(updated);
  };

  const addProofLink = () => setProofLinks([...proofLinks, '']);
  const removeProofLink = (i) => setProofLinks(proofLinks.filter((_, idx) => idx !== i));
  const updateProofLink = (i, value) => {
    const updated = [...proofLinks];
    updated[i] = value;
    setProofLinks(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validPlatforms = platforms.filter((p) => p.platform && p.handle);
    const validLinks = proofLinks.filter((l) => l.trim());
    if (!validPlatforms.length) return toast.error('Add at least one platform');
    if (!validLinks.length) return toast.error('Add at least one proof link or screenshot URL');

    setLoading(true);
    try {
      await applyCreator({
        platforms: validPlatforms.map((p) => ({ ...p, followerCount: Number(p.followerCount) || 0 })),
        bio,
        proofLinks: validLinks,
      });
      toast.success('Application submitted!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Apply to become a creator</h1>
          <p className="text-gray-500">Tell us about your audience. We'll review within 24–48 hours.</p>
        </div>

        {!user && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
            You need to <Link to="/login" className="font-semibold underline">sign in</Link> to apply. Don't have an account? <a href="https://textlix.com/register" className="font-semibold underline">Sign up on textlix</a> first.
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
          {/* Platforms */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Your platforms</label>
            <div className="space-y-3">
              {platforms.map((p, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <select
                    value={p.platform}
                    onChange={(e) => updatePlatform(i, 'platform', e.target.value)}
                    className="col-span-3 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Platform</option>
                    {PLATFORMS.map((pl) => <option key={pl} value={pl}>{pl}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder="Handle / link"
                    value={p.handle}
                    onChange={(e) => updatePlatform(i, 'handle', e.target.value)}
                    className="col-span-5 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <input
                    type="number"
                    placeholder="Followers"
                    value={p.followerCount}
                    onChange={(e) => updatePlatform(i, 'followerCount', e.target.value)}
                    className="col-span-3 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {platforms.length > 1 && (
                    <button type="button" onClick={() => removePlatform(i)} className="col-span-1 p-2 text-gray-400 hover:text-red-500">
                      <FiX size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addPlatform} className="mt-2 flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              <FiPlus size={14} /> Add another platform
            </button>
          </div>

          {/* Proof links */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Proof of audience</label>
            <p className="text-xs text-gray-400 mb-3">Paste links to your profile, a screenshot URL, or any publicly visible proof of your following.</p>
            <div className="space-y-2">
              {proofLinks.map((link, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://..."
                    value={link}
                    onChange={(e) => updateProofLink(i, e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {proofLinks.length > 1 && (
                    <button type="button" onClick={() => removeProofLink(i)} className="p-2 text-gray-400 hover:text-red-500">
                      <FiX size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addProofLink} className="mt-2 flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              <FiPlus size={14} /> Add another link
            </button>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Tell us about yourself (optional)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Brief description of your audience and content..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !user}
            className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  );
}
