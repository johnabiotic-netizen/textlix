import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiArrowLeft, FiCheckCircle, FiSearch, FiCalendar, FiStar } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { getServices, getServiceList, getRentalPrice, orderNumber, orderRental, getRecommendations } from '../../api/numbers';
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

  // Rental state — default slug so pricing query starts immediately
  const [lix1Service, setLix1Service] = useState({ id: null, slug: preselectedService || 'whatsapp', name: null });
  const [lix2Days, setLix2Days] = useState(7);
  const [rentalModal, setRentalModal] = useState(null); // 'lix1' | 'lix2' | null
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

  // Rental: list of hosting services (with IDs) for LIX 1 service picker
  const { data: rentalServicesData } = useQuery({
    queryKey: ['serviceList', 'rental'],
    queryFn: () => getServiceList('rental').then((r) => r.data.data),
    enabled: mode === 'rental',
    staleTime: 60 * 60 * 1000,
  });

  // Populate lix1Service ID once the service list loads
  useEffect(() => {
    if (!rentalServicesData?.services?.length) return;
    const services = rentalServicesData.services;
    const match = preselectedService ? services.find((s) => s.slug === preselectedService) : null;
    const target = match || services[0];
    if (target && (!lix1Service.id || lix1Service.slug !== target.slug)) {
      setLix1Service({ id: target.id, slug: target.slug, name: target.name });
    }
  }, [rentalServicesData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rental: pricing (re-fetches when LIX 1 service slug changes)
  const { data: rentalData, isLoading: rentalLoading } = useQuery({
    queryKey: ['rentalPrice', countryId, lix1Service.slug],
    queryFn: () => getRentalPrice(countryId, { serviceSlug: lix1Service.slug }).then((r) => r.data.data),
    enabled: mode === 'rental',
    staleTime: 5 * 60 * 1000,
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  const country = mode === 'otp' ? servicesData?.country : rentalData?.country;

  const topCountryIds = new Set((recData?.recommendations || []).map((r) => String(r.id)));
  const isTopCountry = topCountryIds.has(String(countryId));
  const myRec = (recData?.recommendations || []).find((r) => String(r.id) === String(countryId));

  const lix1Data = rentalData?.servers?.lix1;
  const lix2Data = rentalData?.servers?.lix2;
  const lix1Price = lix1Data?.options?.[0]?.price || 0;
  const lix2Price = lix2Data?.options?.find((o) => o.days === lix2Days)?.price || 0;

  const otpPrice = selectedService
    ? (selectedServer === 'lix2'
        ? selectedService.servers?.lix2?.price
        : selectedService.servers?.lix1?.price) || 0
    : 0;

  const filteredServices = (servicesData?.services || []).filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.slug.toLowerCase().includes(search.toLowerCase())
  );

  const rentalHostingServices = rentalServicesData?.services || [];

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

  const handleLix1RentalOrder = async () => {
    setOrdering(true);
    try {
      const { data: res } = await orderRental({ countryId, serviceId: lix1Service.id, server: 'lix1' });
      const actualCharge = res.data.order.creditsCharged;
      toast.success(`Rental number: ${res.data.order.phoneNumber} — ${actualCharge} credits charged`);
      useAuthStore.setState((s) => ({ user: { ...s.user, creditBalance: s.user.creditBalance - actualCharge } }));
      qc.invalidateQueries(['activeOrders']);
      setRentalModal(null);
      navigate('/numbers/active');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not get rental number');
    } finally {
      setOrdering(false);
    }
  };

  const handleLix2RentalOrder = async () => {
    setOrdering(true);
    try {
      const { data: res } = await orderRental({ countryId, server: 'lix2', days: lix2Days });
      const actualCharge = res.data.order.creditsCharged;
      toast.success(`Rental number: ${res.data.order.phoneNumber} — ${actualCharge} credits charged`);
      useAuthStore.setState((s) => ({ user: { ...s.user, creditBalance: s.user.creditBalance - actualCharge } }));
      qc.invalidateQueries(['activeOrders']);
      setRentalModal(null);
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
        <>
          {rentalLoading ? (
            <div className="grid md:grid-cols-2 gap-5">
              <SkeletonCard className="h-64" />
              <SkeletonCard className="h-64" />
            </div>
          ) : !rentalData?.available ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">📅</p>
              <p className="font-medium text-gray-600">Rental not available for this country</p>
              <p className="text-sm mt-1">Try a different country or use one-time OTP instead.</p>
              <Link to="/numbers/otp" className="text-brand-600 text-sm hover:underline mt-3 inline-block">Browse OTP numbers →</Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-5">

              {/* LIX 1 card */}
              <div className={`border-2 rounded-2xl p-5 ${lix1Data?.available ? 'border-brand-200 bg-gradient-to-b from-brand-50 to-white' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-brand-600 text-white px-2 py-0.5 rounded-full">LIX 1</span>
                    <span className="font-semibold text-gray-900">Service-Specific</span>
                  </div>
                  {lix1Data?.available
                    ? <span className="text-xs text-green-600 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" />Available</span>
                    : <span className="text-xs text-gray-400">Unavailable</span>}
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  {lix1Data?.notice || 'Active for 24 hours. Dedicated to one platform only.'}
                </p>

                {/* Service picker */}
                {rentalHostingServices.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Platform</p>
                    <div className="flex gap-1.5 flex-wrap mb-4">
                      {rentalHostingServices.map((svc) => (
                        <button
                          key={svc.slug}
                          onClick={() => setLix1Service({ id: svc.id, slug: svc.slug, name: svc.name })}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                            lix1Service.slug === svc.slug
                              ? 'bg-brand-600 border-brand-600 text-white'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-brand-300'
                          }`}
                        >
                          {serviceEmoji(svc.slug)} {svc.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="flex items-end justify-between mt-2">
                  <div>
                    <p className="text-xs text-gray-400">24 Hours</p>
                    <p className="font-mono-num font-bold text-xl text-brand-700">
                      {lix1Price} <span className="text-sm font-normal text-gray-500">credits</span>
                    </p>
                  </div>
                  <Button
                    onClick={() => setRentalModal('lix1')}
                    disabled={!lix1Data?.available || !lix1Service.id || (user?.creditBalance || 0) < lix1Price}
                    size="sm"
                  >
                    <FiCalendar size={14} /> Rent LIX 1
                  </Button>
                </div>
                {lix1Data?.available && (user?.creditBalance || 0) < lix1Price && (
                  <p className="text-xs text-red-600 mt-2">
                    Insufficient credits. <Link to="/credits" className="underline">Buy more →</Link>
                  </p>
                )}
              </div>

              {/* LIX 2 card */}
              <div className={`border-2 rounded-2xl p-5 ${lix2Data?.available ? 'border-purple-200 bg-gradient-to-b from-purple-50 to-white' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full">LIX 2</span>
                    <span className="font-semibold text-gray-900">Any Platform</span>
                  </div>
                  {lix2Data?.available
                    ? <span className="text-xs text-green-600 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" />Available</span>
                    : <span className="text-xs text-gray-400">Unavailable</span>}
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  {lix2Data?.notice || 'Receives SMS from any platform — WhatsApp, Telegram, Google, and more.'}
                </p>

                {lix2Data?.available ? (
                  <>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Duration</p>
                    <div className="flex gap-2 flex-wrap mb-4">
                      {(lix2Data.options || []).map((opt) => (
                        <button
                          key={opt.days}
                          onClick={() => setLix2Days(opt.days)}
                          className={`px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${
                            lix2Days === opt.days
                              ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-purple-300'
                          }`}
                        >
                          {opt.label} <span className="font-mono-num ml-1">{opt.price} cr</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-end justify-between mt-2">
                      <div>
                        <p className="text-xs text-gray-400">{lix2Days} Days</p>
                        <p className="font-mono-num font-bold text-xl text-purple-700">
                          {lix2Price} <span className="text-sm font-normal text-gray-500">credits</span>
                        </p>
                      </div>
                      <Button
                        onClick={() => setRentalModal('lix2')}
                        disabled={(user?.creditBalance || 0) < lix2Price}
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <FiCalendar size={14} /> Rent LIX 2
                      </Button>
                    </div>
                    {(user?.creditBalance || 0) < lix2Price && (
                      <p className="text-xs text-red-600 mt-2">
                        Insufficient credits. <Link to="/credits" className="underline">Buy more →</Link>
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400 mt-2">
                    Long-term rental (7/28 days) is currently available for US, UK, and Canada only.
                  </p>
                )}
              </div>
            </div>
          )}
        </>
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
                const anyAvail = lix1Avail || lix2Avail;
                return (
                  <Card
                    key={service.id}
                    hover={anyAvail}
                    onClick={() => {
                      if (!anyAvail) return;
                      // Auto-select server: prefer lix1, fallback to lix2
                      setSelectedServer(lix1Avail ? 'lix1' : 'lix2');
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
                        <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                          LIX 2 · {service.servers.lix2.price} cr
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
              <div className="grid grid-cols-2 gap-3">
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
                    selectedServer === 'lix2' ? 'border-purple-600 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
                  } ${!selectedService.servers?.lix2?.available ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold bg-purple-600 text-white px-1.5 py-0.5 rounded">LIX 2</span>
                    {selectedServer === 'lix2' && <FiCheckCircle size={13} className="text-purple-600" />}
                  </div>
                  <p className="font-mono-num font-bold text-purple-700">
                    {selectedService.servers?.lix2?.price ?? '—'} <span className="text-xs font-normal text-gray-500">cr</span>
                  </p>
                  {selectedService.servers?.lix2?.successRate != null
                    ? <p className={`text-xs mt-0.5 font-medium ${rateColor(selectedService.servers.lix2.successRate)}`}>{selectedService.servers.lix2.successRate}% success</p>
                    : <p className="text-xs text-gray-400 mt-0.5">Server 2</p>}
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
                <span className={`font-medium ${selectedServer === 'lix1' ? 'text-brand-600' : 'text-purple-600'}`}>
                  {selectedServer === 'lix1' ? 'LIX 1' : 'LIX 2'}
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

      {/* ─── RENTAL LIX 1 CONFIRM MODAL ─────────────────────────────────────── */}
      <Modal
        isOpen={rentalModal === 'lix1'}
        onClose={() => !ordering && setRentalModal(null)}
        title="Confirm LIX 1 Rental"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Country</span>
              <span className="font-medium">{country?.flagEmoji} {country?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Platform</span>
              <span className="font-medium text-brand-700">{lix1Service.name || lix1Service.slug}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Server</span>
              <span className="font-medium text-brand-600">LIX 1</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Duration</span>
              <span className="font-medium">24 Hours</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total cost</span>
              <span className="font-mono-num font-bold text-brand-600">{lix1Price} credits</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-200 pt-3">
              <span className="text-gray-500">Balance after</span>
              <span className={`font-mono-num font-semibold ${(user?.creditBalance || 0) - lix1Price < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {(user?.creditBalance || 0) - lix1Price} credits
              </span>
            </div>
          </div>
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            Number is dedicated to {lix1Service.name || lix1Service.slug} only and expires after 24 hours.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setRentalModal(null)} disabled={ordering} className="flex-1">Cancel</Button>
            <Button onClick={handleLix1RentalOrder} loading={ordering} disabled={(user?.creditBalance || 0) < lix1Price} className="flex-1">
              <FiCalendar size={16} /> Confirm Rental
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── RENTAL LIX 2 CONFIRM MODAL ─────────────────────────────────────── */}
      <Modal
        isOpen={rentalModal === 'lix2'}
        onClose={() => !ordering && setRentalModal(null)}
        title="Confirm LIX 2 Rental"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Country</span>
              <span className="font-medium">{country?.flagEmoji} {country?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Platform</span>
              <span className="font-medium text-purple-700">Any Service</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Server</span>
              <span className="font-medium text-purple-600">LIX 2</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Duration</span>
              <span className="font-medium">{lix2Days} Days</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total cost</span>
              <span className="font-mono-num font-bold text-purple-600">{lix2Price} credits</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-200 pt-3">
              <span className="text-gray-500">Balance after</span>
              <span className={`font-mono-num font-semibold ${(user?.creditBalance || 0) - lix2Price < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {(user?.creditBalance || 0) - lix2Price} credits
              </span>
            </div>
          </div>
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            No refund if cancelled early — rental credits cover the full {lix2Days}-day duration.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setRentalModal(null)} disabled={ordering} className="flex-1">Cancel</Button>
            <Button onClick={handleLix2RentalOrder} loading={ordering} disabled={(user?.creditBalance || 0) < lix2Price} className="flex-1 bg-purple-600 hover:bg-purple-700">
              <FiCalendar size={16} /> Confirm Rental
            </Button>
          </div>
        </div>
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
