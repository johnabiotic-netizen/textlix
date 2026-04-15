import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiZap, FiCalendar, FiGlobe, FiGrid } from 'react-icons/fi';
import { getCountries, getServiceList } from '../../api/numbers';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import { SkeletonCard } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';

const SERVICE_EMOJIS = {
  whatsapp: '💬', telegram: '✈️', google: '🔵', facebook: '📘', instagram: '📸',
  twitter: '🐦', tiktok: '🎵', snapchat: '👻', linkedin: '💼', discord: '🎮',
  uber: '🚗', amazon: '📦', netflix: '🎬', spotify: '🎵', paypal: '💳',
};

export default function BrowseNumbersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const mode = searchParams.get('mode') || 'otp';
  const browse = searchParams.get('browse') || 'country';
  const [search, setSearch] = useState('');

  const setMode = (m) => { setSearchParams({ mode: m, browse }); setSearch(''); };
  const setBrowse = (b) => { setSearchParams({ mode, browse: b }); setSearch(''); };

  const { data: countryData, isLoading: countriesLoading } = useQuery({
    queryKey: ['countries', mode],
    queryFn: () => getCountries(mode).then((r) => r.data.data.countries),
    enabled: browse === 'country',
  });

  const { data: serviceData, isLoading: servicesLoading } = useQuery({
    queryKey: ['serviceList', mode],
    queryFn: () => getServiceList(mode).then((r) => r.data.data.services),
    enabled: browse === 'service',
  });

  const filteredCountries = (countryData || []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const filteredServices = (serviceData || []).filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.slug.toLowerCase().includes(search.toLowerCase())
  );

  const handleCountryClick = (countryId) => navigate(`/numbers/${countryId}?mode=${mode}`);
  const handleServiceClick = (serviceSlug) => navigate(`/numbers/service/${serviceSlug}?mode=${mode}`);

  const isLoading = browse === 'country' ? countriesLoading : servicesLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl text-gray-900 mb-1">Get a Number</h1>
        <p className="text-gray-500 text-sm">Choose your verification type, then browse by country or service</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => setMode('otp')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl border text-sm font-semibold transition-all ${
            mode === 'otp'
              ? 'bg-brand-600 border-brand-600 text-white shadow-md'
              : 'bg-white border-gray-200 text-gray-700 hover:border-brand-300'
          }`}
        >
          <FiZap size={16} />
          One-Time OTP
          <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${mode === 'otp' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
            Single use
          </span>
        </button>
        <button
          onClick={() => setMode('rental')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl border text-sm font-semibold transition-all ${
            mode === 'rental'
              ? 'bg-purple-600 border-purple-600 text-white shadow-md'
              : 'bg-white border-gray-200 text-gray-700 hover:border-purple-300'
          }`}
        >
          <FiCalendar size={16} />
          Rental Number
          <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${mode === 'rental' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
            1–30 days
          </span>
        </button>
      </div>

      {/* Mode description */}
      <div className={`rounded-xl px-4 py-3 text-sm ${mode === 'otp' ? 'bg-brand-50 text-brand-800' : 'bg-purple-50 text-purple-800'}`}>
        {mode === 'otp'
          ? '⚡ One-time number active for 20 minutes. Receives one SMS code. Full refund if no SMS arrives.'
          : '📅 Rental number stays active for 1–30 days. Receives multiple SMS codes. No refund on cancellation.'}
      </div>

      {/* Browse by toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setBrowse('country')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            browse === 'country' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FiGlobe size={14} /> By Country
        </button>
        <button
          onClick={() => setBrowse('service')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            browse === 'service' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FiGrid size={14} /> By Service
        </button>
      </div>

      {/* Search */}
      <Input
        type="search"
        placeholder={browse === 'country' ? 'Search countries...' : 'Search services (e.g. WhatsApp, Google...)'}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {/* Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : browse === 'country' ? (
        filteredCountries.length === 0 ? (
          <EmptyState icon="🌍" title="No countries found" description={search ? `No results for "${search}"` : 'No countries available.'} />
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredCountries.map((country) => (
              <Card key={country.id} hover onClick={() => handleCountryClick(country.id)} className="p-5">
                <div className="text-3xl mb-3">{country.flagEmoji}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{country.name}</h3>
                <p className="text-xs text-gray-500">{country.serviceCount} services</p>
                <p className={`text-xs font-medium mt-1 ${mode === 'otp' ? 'text-brand-600' : 'text-purple-600'}`}>
                  From {country.minPrice} credits
                </p>
              </Card>
            ))}
          </div>
        )
      ) : (
        filteredServices.length === 0 ? (
          <EmptyState icon="📱" title="No services found" description={search ? `No results for "${search}"` : 'No services available.'} />
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredServices.map((service) => (
              <Card key={service.id} hover onClick={() => handleServiceClick(service.slug)} className="p-5">
                <div className="text-3xl mb-3">{SERVICE_EMOJIS[service.slug] || '📱'}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{service.name}</h3>
                <p className="text-xs text-gray-500">{service.countryCount} countries</p>
                <p className={`text-xs font-medium mt-1 ${mode === 'otp' ? 'text-brand-600' : 'text-purple-600'}`}>
                  From {service.minPrice} credits
                </p>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
