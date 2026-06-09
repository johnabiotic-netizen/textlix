import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiArrowLeft, FiCheckCircle, FiSearch, FiCalendar, FiStar, FiAlertTriangle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { getServices, getServiceList, getCountries, getRentalPrice, orderNumber, orderRental, getRecommendations } from '../../api/numbers';
import useAuthStore from '../../store/authStore';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Card from '../../components/common/Card';
import { SkeletonCard } from '../../components/common/Skeleton';
import Input from '../../components/common/Input';

// Tier layout: LIX 1 = 5sim (default, live rate) · LIX 2 = GrizzlySMS ·
// LIX 3 = smscodes.io (real-SIM). LIX3_ENABLED gates smscodes — flip to false to
// instantly hide the LIX 3 tier (its adapter is throttled, but keep the kill-switch).
const LIX3_ENABLED = true;

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
  const [rentalDays, setRentalDays] = useState(7);
  const [rentalTier, setRentalTier] = useState('lix1');
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

  // Populate rentalService ID once the service list loads, and auto-open the
  // rental modal if the user came in with ?service= (e.g. picked the service
  // on the previous page and only needs to confirm duration).
  const didAutoOpenRental = useRef(false);
  useEffect(() => {
    if (!rentalServicesData?.services?.length) return;
    const services = rentalServicesData.services;
    const match = preselectedService ? services.find((s) => s.slug === preselectedService) : null;
    const target = match || services[0];
    if (target && (!rentalService.id || rentalService.slug !== target.slug)) {
      setRentalService({ id: target.id, slug: target.slug, name: target.name });
    }
    if (preselectedService && match && !didAutoOpenRental.current) {
      didAutoOpenRental.current = true;
      setRentalDays(7);
      setShowRentalModal(true);
    }
  }, [rentalServicesData]); // eslint-disable-line react-hooks/exhaustive-deps

  // OTP: auto-open the order modal if the user came in with ?service= and the
  // service is actually available at this country. Otherwise let them pick.
  const didAutoOpenOtp = useRef(false);
  useEffect(() => {
    if (mode !== 'otp') return;
    if (didAutoOpenOtp.current) return;
    if (!preselectedService) return;
    const services = servicesData?.services;
    if (!services?.length) return;

    const match = services.find((s) => s.slug === preselectedService);
    if (!match) return;
    const lix1Avail = match.servers?.lix1?.available;
    const lix2Avail = match.servers?.lix2?.available;
    const lix3Avail = LIX3_ENABLED && match.servers?.lix3?.available;
    if (!(lix1Avail || lix2Avail || lix3Avail)) return;

    didAutoOpenOtp.current = true;
    setSelectedServer(lix1Avail ? 'lix1' : lix2Avail ? 'lix2' : 'lix3');
    setSelectedService(match);
  }, [mode, preselectedService, servicesData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rental: pricing (re-fetches when selected service changes)
  const { data: rentalData, isLoading: rentalLoading } = useQuery({
    queryKey: ['rentalPrice', countryId, rentalService.slug],
    queryFn: () => getRentalPrice(countryId, { serviceSlug: rentalService.slug }).then((r) => r.data.data),
    enabled: mode === 'rental' && !!rentalService.slug,
    staleTime: 5 * 60 * 1000,
  });

  // Default rental tier: LIX 1 when it has stock, else LIX 2
  useEffect(() => {
    if (!rentalData?.tiers) return;
    setRentalTier(rentalData.tiers.lix1?.available ? 'lix1' : 'lix2');
  }, [rentalData]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const rentalCountryFallback = (rentalCountriesData?.countries || []).find((c) => String(c.id) === String(countryId));
  const country = mode === 'otp' ? servicesData?.country : (rentalData?.country || rentalCountryFallback);

  const topCountryIds = new Set((recData?.recommendations || []).map((r) => String(r.id)));
  const isTopCountry = topCountryIds.has(String(countryId));
  const myRec = (recData?.recommendations || []).find((r) => String(r.id) === String(countryId));

  // AI Recommend ranks countries by 5sim's success rate, and 5sim is now LIX 1 —
  // the default tier — so recommended countries already open on the provider the
  // recommendation was based on. No tier override needed.

  // Tiered shape (rentalData.tiers) appears only when the backend has rent
  // LIX 2 enabled; otherwise fall back to the legacy single-tier options.
  const rentalTiers = rentalData?.tiers || null;
  const rentalOptions = rentalTiers
    ? (rentalTiers[rentalTier]?.options || [])
    : (rentalData?.options || []);
  const selectedRentalOption = rentalOptions.find((o) => o.days === rentalDays);
  const rentalPrice = selectedRentalOption?.price || 0;

  const otpPrice = selectedService
    ? (selectedService.servers?.[selectedServer]?.price || 0)
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
      const { data: res } = await orderRental({ countryId, serviceId: rentalService.id, days: rentalDays, server: rentalTier });
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
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <FiArrowLeft size={20} />
        </Link>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {country && <span className="text-2xl">{country.flagEmoji}</span>}
            <h1 className="font-display font-bold text-2xl text-gray-900 dark:text-white">{country?.name || 'Loading...'}</h1>
            {isTopCountry && mode === 'otp' && (
              <span className="flex items-center gap-1 text-xs bg-brand-600 text-white px-2 py-1 rounded-full font-semibold">
                <FiStar size={11} /> Best Match
                {myRec?.successRate > 0 && <span className="opacity-80">· {myRec.successRate}%</span>}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {mode === 'rental' ? 'Rent a number for days' : 'One-time OTP verification'}
          </p>
        </div>
      </div>

      {/* ─── RENTAL MODE ────────────────────────────────────────────────────── */}
      {mode === 'rental' && (
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Choose a platform</p>
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
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
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
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-xl">
                      {serviceEmoji(svc.slug)}
                    </div>
                    <span className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-300">
                      <FiCalendar size={11} />Multi-day
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{svc.name}</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500">1 week · 2 · 3 weeks · 1 month</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── OTP MODE ───────────────────────────────────────────────────────── */}
      {mode === 'otp' && (
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Choose a service</p>
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
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <FiSearch size={32} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium">No services found{search ? ` for "${search}"` : ''}</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredServices.map((service) => {
                const lix1Avail = service.servers?.lix1?.available;
                const lix2Avail = service.servers?.lix2?.available;
                const lix3Avail = LIX3_ENABLED && service.servers?.lix3?.available;
                const anyAvail = lix1Avail || lix2Avail || lix3Avail;
                return (
                  <Card
                    key={service.id}
                    hover={anyAvail}
                    onClick={() => {
                      if (!anyAvail) return;
                      // Auto-select server: prefer lix1, then lix2, lix3
                      setSelectedServer(lix1Avail ? 'lix1' : lix2Avail ? 'lix2' : 'lix3');
                      setSelectedService(service);
                    }}
                    className={`p-5 ${!anyAvail ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-xl">
                        {serviceEmoji(service.slug)}
                      </div>
                      {anyAvail ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />Available
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">Unavailable</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{service.name}</h3>
                    <div className="flex gap-2 flex-wrap">
                      {lix1Avail && (
                        <span className="text-xs bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full font-medium">
                          LIX 1 · {service.servers.lix1.price} cr
                        </span>
                      )}
                      {lix2Avail && (
                        <span className="text-xs bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full font-medium">
                          LIX 2 · {service.servers.lix2.price} cr
                        </span>
                      )}
                      {lix3Avail && (
                        <span className="text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                          LIX 3 · {service.servers.lix3.price} cr
                        </span>
                      )}
                    </div>
                    {service.successRate != null && (
                      <div className="mt-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${service.successRate >= 90 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : service.successRate >= 75 ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
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
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Select Server</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectedServer('lix1')}
                  disabled={!selectedService.servers?.lix1?.available}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    selectedServer === 'lix1' ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-brand-300'
                  } ${!selectedService.servers?.lix1?.available ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold bg-brand-600 text-white px-1.5 py-0.5 rounded">LIX 1</span>
                    {selectedServer === 'lix1' && <FiCheckCircle size={13} className="text-brand-600" />}
                  </div>
                  <p className="font-mono-num font-bold text-brand-700 dark:text-brand-300">
                    {selectedService.servers?.lix1?.price ?? '—'} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">cr</span>
                  </p>
                  {selectedService.servers?.lix1?.successRate != null
                    ? <p className={`text-xs mt-0.5 font-medium ${rateColor(selectedService.servers.lix1.successRate)}`}>{selectedService.servers.lix1.successRate}% success</p>
                    : <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Server 1</p>}
                </button>

                <button
                  onClick={() => setSelectedServer('lix2')}
                  disabled={!selectedService.servers?.lix2?.available}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    selectedServer === 'lix2' ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-brand-300'
                  } ${!selectedService.servers?.lix2?.available ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold bg-brand-600 text-white px-1.5 py-0.5 rounded">LIX 2</span>
                    {selectedServer === 'lix2' && <FiCheckCircle size={13} className="text-brand-600" />}
                  </div>
                  <p className="font-mono-num font-bold text-brand-700 dark:text-brand-300">
                    {selectedService.servers?.lix2?.price ?? '—'} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">cr</span>
                  </p>
                  {selectedService.servers?.lix2?.successRate != null
                    ? <p className={`text-xs mt-0.5 font-medium ${rateColor(selectedService.servers.lix2.successRate)}`}>{selectedService.servers.lix2.successRate}% success</p>
                    : <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Server 2</p>}
                </button>

                <button
                  onClick={() => LIX3_ENABLED && setSelectedServer('lix3')}
                  disabled={!LIX3_ENABLED || !selectedService.servers?.lix3?.available}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    selectedServer === 'lix3' ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300'
                  } ${!LIX3_ENABLED || !selectedService.servers?.lix3?.available ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded">LIX 3</span>
                    {LIX3_ENABLED && selectedServer === 'lix3' && <FiCheckCircle size={13} className="text-emerald-600" />}
                  </div>
                  <p className="font-mono-num font-bold text-emerald-700 dark:text-emerald-300">
                    {LIX3_ENABLED ? (selectedService.servers?.lix3?.price ?? '—') : '—'} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">cr</span>
                  </p>
                  {LIX3_ENABLED && selectedService.servers?.lix3?.successRate != null
                    ? <p className={`text-xs mt-0.5 font-medium ${rateColor(selectedService.servers.lix3.successRate)}`}>{selectedService.servers.lix3.successRate}% success</p>
                    : <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{LIX3_ENABLED ? 'Server 3' : 'Unavailable'}</p>}
                </button>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Country</span>
                <span className="font-medium">{country?.flagEmoji} {country?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Service</span>
                <span className="font-medium">{selectedService.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Server</span>
                <span className={`font-medium ${selectedServer === 'lix1' || selectedServer === 'lix2' ? 'text-brand-600 dark:text-brand-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                  {selectedServer === 'lix1' ? 'LIX 1' : selectedServer === 'lix2' ? 'LIX 2' : 'LIX 3'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Estimated cost</span>
                <span className="font-mono-num font-bold text-brand-600 dark:text-brand-300">~{otpPrice} credits</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 dark:border-gray-700 pt-3">
                <span className="text-gray-500 dark:text-gray-400">Balance after</span>
                <span className={`font-mono-num font-semibold ${(user?.creditBalance || 0) - otpPrice < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
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
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              Final price confirmed at order time and may vary slightly.
            </p>
            {(user?.creditBalance || 0) < otpPrice && (
              <p className="text-xs text-red-600 dark:text-red-400 text-center">
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
          <div className="text-center py-10 text-gray-400 dark:text-gray-500">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading pricing…</p>
          </div>
        ) : !rentalData?.available ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">📅</p>
            <p className="font-medium text-gray-700 dark:text-gray-200">Not available for this country</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Try a different platform or country.</p>
            <Button variant="outline" onClick={() => setShowRentalModal(false)} className="mt-4">Close</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Server picker — only rendered when the backend exposes rental tiers */}
            {rentalTiers && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Select Server</p>
                <div className="grid grid-cols-2 gap-2">
                  {['lix1', 'lix2'].map((tier, i) => {
                    const t = rentalTiers[tier];
                    const tierPrice = t?.options?.find((o) => o.days === rentalDays)?.price;
                    return (
                      <button
                        key={tier}
                        onClick={() => t?.available && setRentalTier(tier)}
                        disabled={!t?.available}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          rentalTier === tier ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-brand-300'
                        } ${!t?.available ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs font-bold bg-brand-600 text-white px-1.5 py-0.5 rounded">LIX {i + 1}</span>
                          {rentalTier === tier && <FiCheckCircle size={13} className="text-brand-600" />}
                        </div>
                        <p className="font-mono-num font-bold text-brand-700 dark:text-brand-300">
                          {tierPrice != null ? tierPrice.toLocaleString() : '—'} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">cr</span>
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t?.available ? `Server ${i + 1}` : 'Unavailable'}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Duration picker */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Duration</p>
              <div className="grid grid-cols-4 gap-2">
                {rentalOptions.map((opt) => (
                  <button
                    key={opt.days}
                    onClick={() => setRentalDays(opt.days)}
                    className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                      rentalDays === opt.days
                        ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-brand-300'
                    }`}
                  >
                    <div className="font-semibold text-sm text-gray-900 dark:text-white">{opt.label}</div>
                    <div className="font-mono-num text-xs text-brand-700 dark:text-brand-300 mt-0.5">{opt.price ? `${opt.price.toLocaleString()} cr` : '—'}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Country</span>
                <span className="font-medium">{country?.flagEmoji} {country?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Platform</span>
                <span className="font-medium text-brand-700 dark:text-brand-300">{rentalService.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Duration</span>
                <span className="font-medium">{rentalOptions.find(o => o.days === rentalDays)?.label || `${rentalDays} days`}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Total cost</span>
                <span className="font-mono-num font-bold text-brand-600 dark:text-brand-300">
                  {rentalPrice > 0 ? `${rentalPrice} credits` : '— credits'}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 dark:border-gray-700 pt-3">
                <span className="text-gray-500 dark:text-gray-400">Balance after</span>
                <span className={`font-mono-num font-semibold ${(user?.creditBalance || 0) - rentalPrice < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                  {(user?.creditBalance || 0) - rentalPrice} credits
                </span>
              </div>
            </div>

            <div className="flex gap-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5">
              <FiAlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-300" />
              <div>
                <p className="font-semibold mb-0.5">Rentals are non-refundable</p>
                <p className="leading-relaxed">
                  Number is dedicated to {rentalService.name} for {rentalOptions.find(o => o.days === rentalDays)?.label || `${rentalDays} days`}.
                  No refund is issued if SMS doesn't arrive, if the service rejects the number, or for any other reason after order is placed.
                </p>
              </div>
            </div>

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
              <p className="text-xs text-red-600 dark:text-red-400 text-center">
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
