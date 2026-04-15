import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiArrowLeft, FiCheckCircle, FiSearch, FiClock, FiCalendar } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { getServices, orderNumber, orderRental } from '../../api/numbers';
import useAuthStore from '../../store/authStore';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Card from '../../components/common/Card';
import { SkeletonCard } from '../../components/common/Skeleton';
import Input from '../../components/common/Input';

const DURATION_OPTIONS = [
  { days: 1, label: '1 Day' },
  { days: 7, label: '7 Days' },
  { days: 30, label: '30 Days' },
];

export default function CountryServicesPage() {
  const { countryId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [tab, setTab] = useState('otp'); // 'otp' | 'rental'
  const [selected, setSelected] = useState(null);
  const [rentalDays, setRentalDays] = useState(1);
  const [ordering, setOrdering] = useState(false);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['services', countryId],
    queryFn: () => getServices(countryId).then((r) => r.data.data),
  });

  const handleOrder = async () => {
    setOrdering(true);
    try {
      if (tab === 'otp') {
        const { data: res } = await orderNumber({ countryId, serviceId: selected.id });
        const actualCharge = res.data.order.creditsCharged;
        toast.success(`Got number: ${res.data.order.phoneNumber} — ${actualCharge} credits charged`);
        useAuthStore.setState((s) => ({ user: { ...s.user, creditBalance: s.user.creditBalance - actualCharge } }));
      } else {
        const { data: res } = await orderRental({ countryId, serviceId: selected.id, days: rentalDays });
        const actualCharge = res.data.order.creditsCharged;
        toast.success(`Rental number: ${res.data.order.phoneNumber} — ${actualCharge} credits charged`);
        useAuthStore.setState((s) => ({ user: { ...s.user, creditBalance: s.user.creditBalance - actualCharge } }));
      }
      qc.invalidateQueries(['activeOrders']);
      setSelected(null);
      navigate('/numbers/active');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not get number');
    } finally {
      setOrdering(false);
    }
  };

  const country = data?.country;
  const allServices = data?.services || [];

  const filteredServices = allServices.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.slug.toLowerCase().includes(search.toLowerCase());
    const matchesTab = tab === 'otp' ? s.available : s.rental?.available;
    return matchesSearch && matchesTab;
  });

  // Price shown in modal
  const modalPrice =
    tab === 'otp'
      ? selected?.price
      : selected?.rental?.options?.find((o) => o.days === rentalDays)?.price;

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

      {/* OTP / Rental toggle */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('otp')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'otp' ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <FiClock size={14} /> One-time OTP
        </button>
        <button
          onClick={() => setTab('rental')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'rental' ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <FiCalendar size={14} /> Long-term Rental
        </button>
      </div>

      {tab === 'rental' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <strong>Rental numbers</strong> stay active for the full duration. You can receive multiple SMS messages. No refund on cancel — you're paying for time.
        </div>
      )}

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
          <p className="font-medium">
            {search ? `No services found for "${search}"` : `No ${tab === 'rental' ? 'rental' : 'OTP'} services available for this country`}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              tab={tab}
              onSelect={() => setSelected(service)}
            />
          ))}
        </div>
      )}

      {/* Confirm order modal */}
      <Modal isOpen={!!selected} onClose={() => !ordering && setSelected(null)} title="Confirm Order">
        {selected && (
          <div className="space-y-4">
            {tab === 'rental' && (
              <div>
                <p className="text-sm text-gray-500 mb-2 font-medium">Choose rental duration</p>
                <div className="grid grid-cols-3 gap-2">
                  {DURATION_OPTIONS.map((opt) => {
                    const price = selected.rental?.options?.find((o) => o.days === opt.days)?.price;
                    return (
                      <button
                        key={opt.days}
                        onClick={() => setRentalDays(opt.days)}
                        className={`p-3 rounded-xl border text-center transition-all ${rentalDays === opt.days ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <div className="font-semibold text-sm text-gray-900">{opt.label}</div>
                        {price && <div className="font-mono-num text-xs text-brand-600 font-bold mt-0.5">{price} cr</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Country</span>
                <span className="font-medium">{country?.flagEmoji} {country?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Service</span>
                <span className="font-medium">{selected.name}</span>
              </div>
              {tab === 'rental' && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Duration</span>
                  <span className="font-medium">{rentalDays} {rentalDays === 1 ? 'day' : 'days'}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{tab === 'otp' ? 'Estimated cost' : 'Total cost'}</span>
                <span className="font-mono-num font-bold text-brand-600">
                  {tab === 'otp' ? `~${selected.price}` : modalPrice} credits
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-3">
                <span className="text-gray-500">Balance after</span>
                <span className={`font-mono-num font-semibold ${(user?.creditBalance || 0) - (modalPrice || 0) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {(user?.creditBalance || 0) - (modalPrice || 0)} credits
                </span>
              </div>
            </div>

            {tab === 'rental' && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                No refund if cancelled early — rental credits cover the full duration.
              </p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setSelected(null)} disabled={ordering} className="flex-1">Cancel</Button>
              <Button
                onClick={handleOrder}
                loading={ordering}
                disabled={(user?.creditBalance || 0) < (modalPrice || 0)}
                className="flex-1"
              >
                <FiCheckCircle size={16} /> Confirm & Get Number
              </Button>
            </div>

            {tab === 'otp' && (
              <p className="text-xs text-gray-400 text-center">Final price confirmed at order time and may vary slightly.</p>
            )}
            {(user?.creditBalance || 0) < (modalPrice || 0) && (
              <p className="text-xs text-red-600 text-center">Insufficient credits. <Link to="/credits" className="underline">Buy more →</Link></p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function ServiceCard({ service, tab, onSelect }) {
  const isAvailable = tab === 'otp' ? service.available : service.rental?.available;
  const priceLabel =
    tab === 'otp'
      ? `${service.price} credits`
      : service.rental?.available
      ? `${service.rental.pricePerDay} cr/day`
      : 'Not available';

  return (
    <Card
      hover={isAvailable}
      onClick={() => isAvailable && onSelect()}
      className={`p-5 ${!isAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-xl">
          {serviceEmoji(service.slug)}
        </div>
        {isAvailable ? (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />Available
          </span>
        ) : (
          <span className="text-xs text-gray-400">Unavailable</span>
        )}
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">{service.name}</h3>
      <p className="font-mono-num font-bold text-brand-600">{priceLabel}</p>
      {tab === 'rental' && service.rental?.available && (
        <p className="text-xs text-gray-400 mt-0.5">
          7d: {service.rental.options.find((o) => o.days === 7)?.price} cr &nbsp;·&nbsp;
          30d: {service.rental.options.find((o) => o.days === 30)?.price} cr
        </p>
      )}
    </Card>
  );
}

function serviceEmoji(slug) {
  const map = { whatsapp: '💬', telegram: '✈️', google: '🔵', facebook: '📘', instagram: '📸', twitter: '🐦', tiktok: '🎵', snapchat: '👻', linkedin: '💼', discord: '🎮', uber: '🚗', amazon: '📦' };
  return map[slug] || '📱';
}
