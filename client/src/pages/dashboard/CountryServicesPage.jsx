import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiArrowLeft, FiCheckCircle, FiSearch, FiCalendar, FiStar } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { getServices, getServiceList, getCountries, getRentalPrice, orderNumber, orderRental, getRecommendations } from '../../api/numbers';
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
  const mode = modeProp || 'otp';
  const preselectedService = searchParams.get('service') || null;
  const { user } = useAuthStore();
  const qc = useQueryClient();

  // OTP state
  const [selectedService, setSelectedService] = useState(null);
  const [selectedServer, setSelectedServer] = useState('lix1');
  const [search, setSearch] = useState('');

  // Rental state
  const [rentalService, setRentalService] = useState({ id: null, slug: preselectedService || null, name: null });
  const [rentalDays, setRentalDays] = useState(3);
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [rentalSearch, setRentalSearch] = useState('');
  const [ordering, setOrdering] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['services', countryId],
    queryFn: () => getServices(countryId).then((r) => r.data.data),
    staleTime: 0,
    enabled: mode === 'otp',
  });

  const { data: recData } = useQuery({
    queryKey: ['recommendations', preselectedService],
    queryFn: () => getRecommendations(preselectedService).then((r) => r.data.data),
    enabled: mode === 'otp' && !!preselectedService,
    staleTime: 5 * 60 * 1000,
  });

  // Rental: service list from Get-SMS
  const { data: rentalServicesData } = useQuery({
    queryKey: ['serviceList', 'rental'],
    queryFn: () => getServiceList('rental').then((r) => r.data.data),
    enabled: mode === 'rental',
    staleTime: 60 * 60 * 1000,
  });

  // Rental: countries list — used to get country name/flag for the header before a service is selected
  const { data: rentalCountriesData } = useQuery({
    queryKey: ['countries', 'rental'],
    queryFn: () => getCountries('rental').then((r) => r.data.data),
    enabled: mode === 'rental',
    staleTime: 60 * 60 * 1000,
  });

  // Populate rentalService ID once the service list loads
  useEffect(() => {
    if (!rentalServicesData?.services?.length) return;
    const services = rentalServicesData.services;
    const match = preselectedService ? services.find((s) => s.slug === preselectedService) : null;
    const target = match || services[0];
    if (target && (!rentalService.id || rentalService.slug !== target.slug)) {
      setRentalService({ id: target.id, slug: target.slug, name: target.name });
    }
  }, [rentalServicesData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rental: pricing (re-fetches when selected service changes)
  const { data: rentalData, isLoading: rentalLoading } = useQuery({
    queryKey: ['rentalPrice', countryId, rentalService.slug],
    queryFn: () => getRentalPrice(countryId, { serviceSlug: rentalService.slug }).then((r) => r.data.data),
    enabled: mode === 'rental' && !!rentalService.slug,
    staleTime: 5 * 60 * 1000,
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  const rentalCountryFallback = (rentalCountriesData?.countries || []).find((c) => String(c.id) === String(countryId));
  const country = mode === 'otp' ? servicesData?.country : (rentalData?.country || rentalCountryFallback);

  const topCountryIds = new Set((recData?.recommendations || []).map((r) => String(r.id)));
  const isTopCountry = topCountryIds.has(String(countryId));
  const myRec = (recData?.recommendations || []).find((r) => String(r.id) === String(countryId));

  const rentalOptions = rentalData?.options || [];
  const selectedRentalOption = rentalOptions.find((o) => o.days === rentalDays);
  const rentalPrice = selectedRentalOption?.price || 0;

  const otpPrice = selectedService
    ? (selectedServer === 'lix3'
        ? selectedService.servers?.lix3?.price
        : selectedServer === 'lix2'
          ? selectedService.servers?.lix2?.price
          : selectedService.servers?.lix1?.price) || 0
    : 0;

  const filteredServices = (servicesData?.services || []).filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.slug.toLowerCase().includes(search.toLowerCase())
  );

  const filteredRentalServices = (rentalServicesData?.services || []).filter(
    (s) =>
      s.name.toLowerCase().includes(rentalSearch.toLowerCase()) ||
      s.slug.toLowerCase().includes(rentalSearch.toLowerCase())
  );


  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleOtpOrder = async () => {
    setOrdering(true);
    try {
      const { data: res } = await orderNumber({ countryId, serviceId: selectedService.id, server: selectedServer });
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
      const { data: res } = await orderRental({ countryId, serviceId: rentalService.id, days: rentalDays });
      const actualCharge = res.data.order.creditsCharged;
      toast.success(`Rental number: ${res.data.order.phoneNumber} — ${actualCharge} credits charged`);
      useAuthStore.setState((s) => ({ user: { ...s.user, creditBalance: s.user.creditBalance - actualCharge } }));
      qc.invalidateQueries(['activeOrders']);
      setShowRentalModal(false);
      navigate('/numbers/active');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not get rental number');
    } finally {
      setOrdering(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to={preselectedService
            ? `/numbers/${mode}/service/${preselectedService}`
            : `/numbers/${mode}`}
          className="text-gray-400 hover:text-gray-600"
        >
          <FiArrowLeft size={20} />
        </Link>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {country && <span className="text-2xl">{country.flagEmoji}</span>}
            <h1 className="font-display font-bold text-2xl text-gray-900">{country?.name || 'Loading...'}</h1>
            {isTopCountry && mode === 'otp' && (
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

      {/* ─── RENTAL MODE ────────────────────────────────────────────────────── */}
      {mode === 'rental' && (
        <div>
          <p className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">Choose a platform</p>
          <Input
            type="search"
            placeholder="Search platforms (e.g. WhatsApp, Telegram...)"
            value={rentalSearch}
            onChange={(e) => setRentalSearch(e.target.value)}
            className="max-w-sm mb-4"
          />

          {!rentalServicesData ? (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filteredRentalServices.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FiSearch size={32} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium">No platforms found{rentalSearch ? ` for "${rentalSearch}"` : ''}</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredRentalServices.map((svc) => (
                <Card
                  key={svc.slug}
                  hover
                  onClick={() => {
                    setRentalService({ id: svc.id, slug: svc.slug, name: svc.name });
                    setRentalDays(7);
                    setShowRentalModal(true);
                  }}
                  className="p-5 cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-xl">
                      {serviceEmoji(svc.slug)}
                    </div>
                    <span className="flex items-center gap-1 text-xs text-brand-600">
                      <FiCalendar size={11} />Multi-day
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{svc.name}</h3>
                  <p className="text-xs text-gray-400">1 / 3 / 7 days</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── OTP MODE ───────────────────────────────────────────────────────── */}
      {mode === 'otp' && (
        <div>
          <p className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">Choose a service</p>
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
              {filteredServices.map((service) => {
                const lix1Avail = service.servers?.lix1?.available;
                const lix2Avail = service.servers?.lix2?.available;
                const lix3Avail = service.servers?.lix3?.available;
                const anyAvail = lix1Avail || lix2Avail || lix3Avail;
                return (
                  <Card
                    key={service.id}
                    hover={anyAvail}
                    onClick={() => {
                      if (!anyAvail) return;
                      // Auto-select server: prefer lix1, fallback to lix2, then lix3
                      setSelectedServer(lix1Avail ? 'lix1' : lix2Avail ? 'lix2' : 'lix3');
                      setSelectedService(service);
                    }}
                    className={`p-5 ${!anyAvail ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-xl">
                        {serviceEmoji(service.slug)}
                      </div>
                      {anyAvail ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />Available
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Unavailable</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">{service.name}</h3>
                    <div className="flex gap-2 flex-wrap">
                      {lix1Avail && (
                        <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium">
                          LIX 1 · {service.servers.lix1.price} cr
                        </span>
                      )}
                      {lix2Avail && (
                        <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium">
                          LIX 2 · {service.servers.lix2.price} cr
                        </span>
                      )}
                      {lix3Avail && (
                        <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                          LIX 3 · {service.servers.lix3.price} cr
                        </span>
                      )}
                    </div>
                    {service.successRate != null && (
                      <div className="mt-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${service.successRate >= 90 ? 'bg-green-50 text-green-700' : service.successRate >= 75 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                          {service.successRate}% success
                        </span>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── OTP CONFIRM MODAL ──────────────────────────────────────────────── */}
      <Modal
        isOpen={!!selectedService}
        onClose={() => !ordering && setSelectedService(null)}
        title={`Get ${selectedService?.name || ''} Number`}
      >
        {selectedService && (
          <div className="space-y-4">
            {/* Server selector */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select Server</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectedServer('lix1')}
                  disabled={!selectedService.servers?.lix1?.available}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    selectedServer === 'lix1' ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:border-brand-300'
                  } ${!selectedService.servers?.lix1?.available ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold bg-brand-600 text-white px-1.5 py-0.5 rounded">LIX 1</span>
                    {selectedServer === 'lix1' && <FiCheckCircle size={13} className="text-brand-600" />}
                  </div>
                  <p className="font-mono-num font-bold text-brand-700">
                    {selectedService.servers?.lix1?.price ?? '—'} <span className="text-xs font-normal text-gray-500">cr</span>
                  </p>
                  {selectedService.servers?.lix1?.successRate != null
                    ? <p className={`text-xs mt-0.5 font-medium ${rateColor(selectedService.servers.lix1.successRate)}`}>{selectedService.servers.lix1.successRate}% success</p>
                    : <p className="text-xs text-gray-400 mt-0.5">Server 1</p>}
                </button>

                <button
                  onClick={() => setSelectedServer('lix2')}
                  disabled={!selectedService.servers?.lix2?.available}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    selectedServer === 'lix2' ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:border-brand-300'
                  } ${!selectedService.servers?.lix2?.available ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold bg-brand-600 text-white px-1.5 py-0.5 rounded">LIX 2</span>
                    {selectedServer === 'lix2' && <FiCheckCircle size={13} className="text-brand-600" />}
                  </div>
                  <p className="font-mono-num font-bold text-brand-700">
                    {selectedService.servers?.lix2?.price ?? '—'} <span className="text-xs font-normal text-gray-500">cr</span>
                  </p>
                  {selectedService.servers?.lix2?.successRate != null
                    ? <p className={`text-xs mt-0.5 font-medium ${rateColor(selectedService.servers.lix2.successRate)}`}>{selectedService.servers.lix2.successRate}% success</p>
                    : <p className="text-xs text-gray-400 mt-0.5">Server 2</p>}
                </button>

                <button
                  onClick={() => setSelectedServer('lix3')}
                  disabled={!selectedService.servers?.lix3?.available}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    selectedServer === 'lix3' ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300'
                  } ${!selectedService.servers?.lix3?.available ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded">LIX 3</span>
                    {selectedServer === 'lix3' && <FiCheckCircle size={13} className="text-emerald-600" />}
                  </div>
                  <p className="font-mono-num font-bold text-emerald-700">
                    {selectedService.servers?.lix3?.price ?? '—'} <span className="text-xs font-normal text-gray-500">cr</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Server 3</p>
                </button>
              </div>
            </div>

            {/* Summary */}
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
                <span className="text-gray-500">Server</span>
                <span className={`font-medium ${selectedServer === 'lix1' ? 'text-brand-600' : selectedServer === 'lix2' ? 'text-brand-600' : 'text-emerald-600'}`}>
                  {selectedServer === 'lix1' ? 'LIX 1' : selectedServer === 'lix2' ? 'LIX 2' : 'LIX 3'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Estimated cost</span>
                <span className="font-mono-num font-bold text-brand-600">~{otpPrice} credits</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-3">
                <span className="text-gray-500">Balance after</span>
                <span className={`font-mono-num font-semibold ${(user?.creditBalance || 0) - otpPrice < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {(user?.creditBalance || 0) - otpPrice} credits
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setSelectedService(null)} disabled={ordering} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleOtpOrder}
                loading={ordering}
                disabled={(user?.creditBalance || 0) < otpPrice || ordering}
                className="flex-1"
              >
                <FiCheckCircle size={16} /> Confirm & Get Number
              </Button>
            </div>
            <p className="text-xs text-gray-400 text-center">
              Final price confirmed at order time and may vary slightly.
            </p>
            {(user?.creditBalance || 0) < otpPrice && (
              <p className="text-xs text-red-600 text-center">
                Insufficient credits. <Link to="/credits" className="underline">Buy more →</Link>
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* ─── RENTAL CONFIRM MODAL ───────────────────────────────────────────── */}
      <Modal
        isOpen={showRentalModal}
        onClose={() => !ordering && setShowRentalModal(false)}
        title={`Rent ${rentalService.name || ''} Number`}
      >
        {rentalLoading ? (
          <div className="text-center py-10 text-gray-400">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading pricing…</p>
          </div>
        ) : !rentalData?.available ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">📅</p>
            <p className="font-medium text-gray-700">Not available for this country</p>
            <p className="text-sm text-gray-400 mt-1">Try a different platform or country.</p>
            <Button variant="outline" onClick={() => setShowRentalModal(false)} className="mt-4">Close</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Duration picker */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Duration</p>
              <div className="grid grid-cols-4 gap-2">
                {rentalOptions.map((opt) => (
                  <button
                    key={opt.days}
                    onClick={() => setRentalDays(opt.days)}
                    className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                      rentalDays === opt.days
                        ? 'border-brand-600 bg-brand-50'
                        : 'border-gray-200 hover:border-brand-300'
                    }`}
                  >
                    <div className="font-semibold text-sm text-gray-900">{opt.label}</div>
                    {opt.price && <div className="font-mono-num text-xs text-brand-700 mt-0.5">{opt.price} cr</div>}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Country</span>
                <span className="font-medium">{country?.flagEmoji} {country?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Platform</span>
                <span className="font-medium text-brand-700">{rentalService.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium">{rentalDays} Days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total cost</span>
                <span className="font-mono-num font-bold text-brand-600">
                  {rentalPrice > 0 ? `${rentalPrice} credits` : '— credits'}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-3">
                <span className="text-gray-500">Balance after</span>
                <span className={`font-mono-num font-semibold ${(user?.creditBalance || 0) - rentalPrice < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {(user?.creditBalance || 0) - rentalPrice} credits
                </span>
              </div>
            </div>

            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Number is dedicated to {rentalService.name} and expires after {rentalDays} days.
            </p>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowRentalModal(false)} disabled={ordering} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleRentalOrder}
                loading={ordering}
                disabled={rentalPrice === 0 || (user?.creditBalance || 0) < rentalPrice || ordering}
                className="flex-1"
              >
                <FiCalendar size={16} /> Confirm Rental
              </Button>
            </div>
            {rentalPrice > 0 && (user?.creditBalance || 0) < rentalPrice && (
              <p className="text-xs text-red-600 text-center">
                Insufficient credits. <Link to="/credits" className="underline">Buy more →</Link>
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function rateColor(rate) {
  if (rate >= 90) return 'text-green-600';
  if (rate >= 75) return 'text-yellow-600';
  return 'text-red-500';
}

function serviceEmoji(slug) {
  const map = {
    whatsapp: '💬', telegram: '✈️', google: '🔵', facebook: '📘', instagram: '📸',
    twitter: '🐦', tiktok: '🎵', snapchat: '👻', linkedin: '💼', discord: '🎮',
    uber: '🚗', amazon: '📦',
  };
  return map[slug] || '📱';
}
