import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiArrowLeft, FiGlobe, FiGrid, FiStar } from 'react-icons/fi';
import { getCountries, getServiceList, getRecommendations } from '../../api/numbers';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import { SkeletonCard } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ServiceLogo from '../../components/common/ServiceLogo';

const SERVICE_EMOJIS = {
  whatsapp: '💬', telegram: '✈️', google: '🔵', facebook: '📘', instagram: '📸',
  twitter: '🐦', tiktok: '🎵', snapchat: '👻', linkedin: '💼', discord: '🎮',
  uber: '🚗', amazon: '📦', netflix: '🎬', spotify: '🎵', paypal: '💳',
};

export default function BrowseByModePage({ mode }) {
  const navigate = useNavigate();
  const [browse, setBrowse] = useState('country');
  const [search, setSearch] = useState('');

  const isRental = mode === 'rental';
  const accent = isRental ? 'brand' : 'brand';

  const { data: countryData, isLoading: countriesLoading } = useQuery({
    queryKey: ['countries', mode],
    queryFn: () => getCountries(mode).then((r) => r.data.data.countries),
    enabled: browse === 'country',
    staleTime: 5 * 60 * 1000,
  });

  const { data: serviceData, isLoading: servicesLoading } = useQuery({
    queryKey: ['serviceList', mode],
    queryFn: () => getServiceList(mode).then((r) => r.data.data.services),
    enabled: browse === 'service',
    staleTime: 5 * 60 * 1000,
  });

  // Recommendation strip: fetch top countries when a service card is hovered/focused (OTP only)
  const [hoveredService, setHoveredService] = useState(null);
  const { data: recData } = useQuery({
    queryKey: ['recommendations', hoveredService],
    queryFn: () => getRecommendations(hoveredService).then((r) => r.data.data),
    enabled: !isRental && !!hoveredService && browse === 'service',
    staleTime: 5 * 60 * 1000,
  });

  const filteredCountries = (countryData || []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const filteredServices = (serviceData || []).filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.slug.toLowerCase().includes(search.toLowerCase())
  );

  const handleCountryClick = (countryId) =>
    navigate(`/numbers/${isRental ? 'rental' : 'otp'}/${countryId}`);

  const handleServiceClick = (serviceSlug) =>
    navigate(`/numbers/${isRental ? 'rental' : 'otp'}/service/${serviceSlug}`);

  const isLoading = browse === 'country' ? countriesLoading : servicesLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/numbers" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
          <FiArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900 dark:text-white">
            {isRental ? '📅 Rental Numbers' : '⚡ One-Time OTP'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {isRental
              ? 'Numbers active for 1–30 days. Multiple SMS codes on the same number.'
              : 'Numbers active for 20 minutes. One SMS code. Full refund if unused.'}
          </p>
        </div>
      </div>

      {/* Browse by toggle */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => { setBrowse('country'); setSearch(''); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            browse === 'country' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <FiGlobe size={14} /> By Country
        </button>
        <button
          onClick={() => { setBrowse('service'); setSearch(''); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            browse === 'service' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <FiGrid size={14} /> By Service
        </button>
      </div>

      {/* Search */}
      <Input
        type="search"
        placeholder={browse === 'country' ? 'Search countries...' : 'Search services...'}
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
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{country.flagEmoji}</span>
                  {country.successRate != null && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${country.successRate >= 90 ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300' : country.successRate >= 75 ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                      {country.successRate}%
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{country.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{country.serviceCount} service{country.serviceCount !== 1 ? 's' : ''}</p>
                <p className={`text-xs font-medium mt-1 ${isRental ? 'text-brand-600' : 'text-brand-600'}`}>
                  {isRental ? `From ${country.minPrice} cr/day` : `From ${country.minPrice} credits`}
                </p>
              </Card>
            ))}
          </div>
        )
      ) : (
        filteredServices.length === 0 ? (
          <EmptyState icon="📱" title="No services found" description={search ? `No results for "${search}"` : 'No services available.'} />
        ) : (
          <>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredServices.map((service) => (
                <Card
                  key={service.id || service.slug}
                  hover
                  onClick={() => handleServiceClick(service.slug)}
                  onMouseEnter={() => !isRental && setHoveredService(service.slug)}
                  onMouseLeave={() => !isRental && setHoveredService(null)}
                  className="p-5"
                >
                  <div className="w-11 h-11 mb-3 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center">
                    <ServiceLogo slug={service.slug} size={28} />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{service.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{service.countryCount} countr{service.countryCount !== 1 ? 'ies' : 'y'}</p>
                  <p className={`text-xs font-medium mt-1 ${isRental ? 'text-brand-600' : 'text-brand-600'}`}>
                    {isRental ? `From ${service.minPrice} cr/day` : `From ${service.minPrice} credits`}
                  </p>
                </Card>
              ))}
            </div>
            {/* Recommendation strip — shown when a service card is hovered */}
            {!isRental && recData?.recommendations?.length > 0 && (
              <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FiStar size={14} className="text-brand-600" />
                  <span className="text-sm font-semibold text-brand-800 dark:text-brand-300">
                    Best countries for {filteredServices.find((s) => s.slug === hoveredService)?.name || hoveredService}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recData.recommendations.map((rec, i) => (
                    <button
                      key={rec.id}
                      onClick={() => navigate(`/numbers/otp/${rec.id}?service=${hoveredService}`)}
                      className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-brand-200 dark:border-brand-800 hover:border-brand-400 rounded-xl px-3 py-2 text-sm transition-all"
                    >
                      {i === 0 && <span className="text-xs bg-brand-600 text-white px-1.5 py-0.5 rounded-md font-bold">TOP</span>}
                      <span>{rec.flagEmoji} {rec.name}</span>
                      <span className="text-brand-600 font-mono-num font-semibold">{rec.price} cr</span>
                      {rec.successRate > 0 && (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">{rec.successRate}%</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
