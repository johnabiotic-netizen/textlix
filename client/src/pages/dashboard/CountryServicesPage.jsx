import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiArrowLeft, FiCheckCircle, FiSearch } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { getServices, orderNumber } from '../../api/numbers';
import useAuthStore from '../../store/authStore';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Card from '../../components/common/Card';
import { SkeletonCard } from '../../components/common/Skeleton';
import Input from '../../components/common/Input';

export default function CountryServicesPage() {
  const { countryId } = useParams();
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const qc = useQueryClient();

  const [selected, setSelected] = useState(null);
  const [ordering, setOrdering] = useState(false);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['services', countryId],
    queryFn: () => getServices(countryId).then((r) => r.data.data),
  });

  const handleOrder = async () => {
    setOrdering(true);
    try {
      const { data: res } = await orderNumber({ countryId, serviceId: selected.id });
      const actualCharge = res.data.order.creditsCharged;
      toast.success(`Got number: ${res.data.order.phoneNumber} — ${actualCharge} credits charged`);
      qc.invalidateQueries(['activeOrders']);
      // Deduct actual amount charged (may differ from displayed price due to real-time 5sim pricing)
      useAuthStore.setState((s) => ({ user: { ...s.user, creditBalance: s.user.creditBalance - actualCharge } }));
      setSelected(null);
      navigate('/numbers/active');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not get number');
    } finally {
      setOrdering(false);
    }
  };

  const country = data?.country;
  const filteredServices = (data?.services || []).filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/numbers" className="text-gray-400 hover:text-gray-600"><FiArrowLeft size={20} /></Link>
        <div>
          <div className="flex items-center gap-2">
            {country && <span className="text-2xl">{country.flagEmoji}</span>}
            <h1 className="font-display font-bold text-2xl text-gray-900">{country?.name || 'Loading...'}</h1>
          </div>
          <p className="text-sm text-gray-500">Select a service to get a number</p>
        </div>
      </div>

      <Input
        type="search"
        placeholder="Search services (e.g. WhatsApp, Netflix...)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : filteredServices.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FiSearch size={32} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No services found for "{search}"</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <Card key={service.id} hover={service.available} onClick={() => service.available && setSelected(service)}
              className={`p-5 ${!service.available ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-xl">
                  {serviceEmoji(service.slug)}
                </div>
                {service.available ? (
                  <span className="flex items-center gap-1 text-xs text-green-600"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" />Available</span>
                ) : (
                  <span className="text-xs text-gray-400">Unavailable</span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{service.name}</h3>
              <p className="font-mono-num font-bold text-brand-600">{service.price} credits</p>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={!!selected} onClose={() => !ordering && setSelected(null)} title="Confirm Order">
        {selected && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Country</span>
                <span className="font-medium">{country?.flagEmoji} {country?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Service</span>
                <span className="font-medium">{selected.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Estimated cost</span>
                <span className="font-mono-num font-bold text-brand-600">~{selected.price} credits</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-3">
                <span className="text-gray-500">Balance after</span>
                <span className={`font-mono-num font-semibold ${user?.creditBalance - selected.price < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {(user?.creditBalance || 0) - selected.price} credits
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setSelected(null)} disabled={ordering} className="flex-1">Cancel</Button>
              <Button onClick={handleOrder} loading={ordering} disabled={(user?.creditBalance || 0) < selected.price} className="flex-1">
                <FiCheckCircle size={16} /> Confirm & Get Number
              </Button>
            </div>
            <p className="text-xs text-gray-400 text-center">Final price is confirmed at order time and may vary slightly from the estimate shown.</p>
            {(user?.creditBalance || 0) < selected.price && (
              <p className="text-xs text-red-600 text-center">Insufficient credits. <Link to="/credits" className="underline">Buy more →</Link></p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function serviceEmoji(slug) {
  const map = { whatsapp: '💬', telegram: '✈️', google: '🔵', facebook: '📘', instagram: '📸', twitter: '🐦', tiktok: '🎵', snapchat: '👻', linkedin: '💼', discord: '🎮', uber: '🚗', amazon: '📦' };
  return map[slug] || '📱';
}
