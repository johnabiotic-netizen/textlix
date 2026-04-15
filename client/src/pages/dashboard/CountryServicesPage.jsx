import { useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiArrowLeft, FiCheckCircle, FiSearch, FiCalendar, FiStar } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { getServices, getRentalPrice, orderNumber, orderRental, getRecommendations } from '../../api/numbers';
import useAuthStore from '../../store/authStore';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Card from '../../components/common/Card';
import { SkeletonCard } from '../../components/common/Skeleton';
import Input from '../../components/common/Input';

export default function CountryServicesPage({ mode: modeProp }) {
  const { countryId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = modeProp || 'otp'; // passed via route element prop
  const preselectedService = searchParams.get('service') || null;
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [selectedService, setSelectedService] = useState(null); // for OTP modal
  const [rentalDays, setRentalDays] = useState(1);
  const [rentalServiceSlug, setRentalServiceSlug] = useState(null); // selected hosting service
  const [rentalModalOpen, setRentalModalOpen] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [search, setSearch] = useState('');

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['services', countryId],
    queryFn: () => getServices(countryId).then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
  });

  // When user arrived via service → country path, fetch recs so we can show
  // a "Best Match" badge on the service that brought them here
  const { data: recData } = useQuery({
    queryKey: ['recommendations', preselectedService],
    queryFn: () => getRecommendations(preselectedService).then((r) => r.data.data),
    enabled: mode !== 'rental' && !!preselectedService,
    staleTime: 5 * 60 * 1000,
  });

  // Set of country IDs that are in the top-5 for the pre-selected service
  const topCountryIds = new Set((recData?.recommendations || []).map((r) => String(r.id)));
  const isTopCountry = topCountryIds.has(String(countryId));
  const myRec = (recData?.recommendations || []).find((r) => String(r.id) === String(countryId));

  const { data: rentalData, isLoading: rentalLoading } = useQuery({
    queryKey: ['rentalPrice', countryId],
    queryFn: () => getRentalPrice(countryId).then((r) => r.data.data),
    onSuccess: (data) => {
      // Auto-select first available service
      if (data?.services?.length > 0 && !rentalServiceSlug) {
        setRentalServiceSlug(data.services[0].slug);
      }
    },
  });

  const country = servicesData?.country;

  const handleOtpOrder = async () => {
    setOrdering(true);
    try {
      const { data: res } = await orderNumber({ countryId, serviceId: selectedService.id });
      const actualCharge = res.data.order.creditsCharged;
      toast.success(`Got number: ${res.data.order.phoneNumber} — ${actualCharge} credits charged`);
      useAuthStore.setState((s) => ({ user: { ...s.user, creditBalance: s.user.creditBalance - actualCharge } }));
      qc.invalidateQueries(['activeOrders']);
      setSelectedService(null);
      navigate('/numbers/active');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not get number');
    } finally {
      setOrdering(false);
    }
  };

  const handleRentalOrder = async () => {
    setOrdering(true);
    try {
      const { data: res } = await orderRental({ countryId, days: rentalDays, serviceSlug: rentalServiceSlug });
      const actualCharge = res.data.order.creditsCharged;
      toast.success(`Rental number: ${res.data.order.phoneNumber} — ${actualCharge} credits charged`);
      useAuthStore.setState((s) => ({ user: { ...s.user, creditBalance: s.user.creditBalance - actualCharge } }));
      qc.invalidateQueries(['activeOrders']);
      setRentalModalOpen(false);
      navigate('/numbers/active');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not get rental number');
    } finally {
      setOrdering(false);
    }
  };

  const filteredServices = (servicesData?.services || []).filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.slug.toLowerCase().includes(search.toLowerCase())
  );

  // Active rental service object
  const activeRentalService = rentalData?.services?.find((s) => s.slug === rentalServiceSlug) || rentalData?.services?.[0] || null;
  const rentalPrice = activeRentalService?.options?.find((o) => o.days === rentalDays)?.price || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to={preselectedService
            ? `/numbers/${mode === 'rental' ? 'rental' : 'otp'}/service/${preselectedService}`
            : `/numbers/${mode === 'rental' ? 'rental' : 'otp'}`}
          className="text-gray-400 hover:text-gray-600"
        >
          <FiArrowLeft size={20} />
        </Link>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {country && <span className="text-2xl">{country.flagEmoji}</span>}
            <h1 className="font-display font-bold text-2xl text-gray-900">{country?.name || 'Loading...'}</h1>
            {isTopCountry && (
              <span className="flex items-center gap-1 text-xs bg-brand-600 text-white px-2 py-1 rounded-full font-semibold">
                <FiStar size={11} /> Best Match
                {myRec?.successRate > 0 && <span className="opacity-80">· {myRec.successRate}%</span>}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {mode === 'rental' ? 'Rent a number for days' : 'One-time OTP verification'}
          </p>
        </div>
      </div>

      {/* Rental box */}
      {mode !== 'otp' && !rentalLoading && rentalData?.available && rentalData.services?.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <FiCalendar size={16} className="text-purple-600" />
            <span className="font-semibold text-gray-900">Rent a number</span>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Long-term</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Keep the number active for days. Receive multiple SMS codes on the same number.
          </p>

          {/* Service selector */}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Platform</p>
          <div className="flex gap-2 flex-wrap mb-4">
            {rentalData.services.map((svc) => (
              <button
                key={svc.slug}
                onClick={() => setRentalServiceSlug(svc.slug)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                  (rentalServiceSlug || rentalData.services[0]?.slug) === svc.slug
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-purple-300'
                }`}
              >
                {svc.name}
              </button>
            ))}
          </div>

          {/* Duration selector */}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Duration</p>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {(activeRentalService?.options || []).map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => setRentalDays(opt.days)}
                  className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                    rentalDays === opt.days
                      ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-purple-300'
                  }`}
                >
                  {opt.label}
                  <span className="ml-2 font-mono-num">{opt.price} cr</span>
                </button>
              ))}
            </div>
            <Button
              onClick={() => setRentalModalOpen(true)}
              disabled={(user?.creditBalance || 0) < rentalPrice}
              className="bg-purple-600 hover:bg-purple-700 shrink-0"
            >
              <FiCalendar size={15} /> Rent Now
            </Button>
          </div>
          {(user?.creditBalance || 0) < rentalPrice && (
            <p className="text-xs text-red-600 mt-3">
              Insufficient credits. <Link to="/credits" className="underline">Buy more →</Link>
            </p>
          )}
        </div>
      )}

      {/* Rental unavailable message */}
      {mode === 'rental' && !rentalLoading && (!rentalData?.available || !rentalData?.services?.length) && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-medium text-gray-600">Rental not available for this country</p>
          <p className="text-sm mt-1">Try a different country or use one-time OTP instead.</p>
          <Link to="/numbers/otp" className="text-brand-600 text-sm hover:underline mt-3 inline-block">Browse OTP numbers →</Link>
        </div>
      )}

      {/* OTP section */}
      {mode !== 'rental' && <div>
        <p className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">One-time OTP numbers</p>

        <Input
          type="search"
          placeholder="Search services (e.g. WhatsApp, Netflix...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm mb-4"
        />

        {servicesLoading ? (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FiSearch size={32} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">No services found{search ? ` for "${search}"` : ''}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredServices.map((service) => (
              <Card
                key={service.id}
                hover={service.available}
                onClick={() => service.available && setSelectedService(service)}
                className={`p-5 ${!service.available ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-xl">
                    {serviceEmoji(service.slug)}
                  </div>
                  {service.available ? (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />Available
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Unavailable</span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{service.name}</h3>
                <div className="flex items-center justify-between">
                  <p className="font-mono-num font-bold text-brand-600">{service.price} credits</p>
                  {service.successRate != null && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${service.successRate >= 90 ? 'bg-green-50 text-green-700' : service.successRate >= 75 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                      {service.successRate}% success
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>}

      {/* OTP confirm modal */}
      <Modal isOpen={!!selectedService} onClose={() => !ordering && setSelectedService(null)} title="Confirm Order">
        {selectedService && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Country</span>
                <span className="font-medium">{country?.flagEmoji} {country?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Service</span>
                <span className="font-medium">{selectedService.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Estimated cost</span>
                <span className="font-mono-num font-bold text-brand-600">~{selectedService.price} credits</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-3">
                <span className="text-gray-500">Balance after</span>
                <span className={`font-mono-num font-semibold ${(user?.creditBalance || 0) - selectedService.price < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {(user?.creditBalance || 0) - selectedService.price} credits
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setSelectedService(null)} disabled={ordering} className="flex-1">Cancel</Button>
              <Button onClick={handleOtpOrder} loading={ordering} disabled={(user?.creditBalance || 0) < selectedService.price} className="flex-1">
                <FiCheckCircle size={16} /> Confirm & Get Number
              </Button>
            </div>
            <p className="text-xs text-gray-400 text-center">Final price confirmed at order time and may vary slightly.</p>
            {(user?.creditBalance || 0) < selectedService.price && (
              <p className="text-xs text-red-600 text-center">Insufficient credits. <Link to="/credits" className="underline">Buy more →</Link></p>
            )}
          </div>
        )}
      </Modal>

      {/* Rental confirm modal */}
      <Modal isOpen={rentalModalOpen} onClose={() => !ordering && setRentalModalOpen(false)} title="Confirm Rental">
        {rentalData?.available && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Country</span>
                <span className="font-medium">{country?.flagEmoji} {country?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Platform</span>
                <span className="font-medium text-purple-700">{activeRentalService?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium">{rentalDays} {rentalDays === 1 ? 'day' : 'days'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total cost</span>
                <span className="font-mono-num font-bold text-purple-600">{rentalPrice} credits</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-3">
                <span className="text-gray-500">Balance after</span>
                <span className={`font-mono-num font-semibold ${(user?.creditBalance || 0) - rentalPrice < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {(user?.creditBalance || 0) - rentalPrice} credits
                </span>
              </div>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              No refund if cancelled early — rental credits cover the full duration.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setRentalModalOpen(false)} disabled={ordering} className="flex-1">Cancel</Button>
              <Button onClick={handleRentalOrder} loading={ordering} disabled={(user?.creditBalance || 0) < rentalPrice} className="flex-1 bg-purple-600 hover:bg-purple-700">
                <FiCalendar size={16} /> Confirm Rental
              </Button>
            </div>
            {(user?.creditBalance || 0) < rentalPrice && (
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
