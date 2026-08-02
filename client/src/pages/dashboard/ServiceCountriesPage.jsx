import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiArrowLeft } from 'react-icons/fi';
import { getCountriesForService } from '../../api/numbers';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import { SkeletonCard } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ServiceLogo from '../../components/common/ServiceLogo';

function CountryCard({ country, mode, onClick, highlight }) {
  return (
    <Card hover onClick={onClick} className={`p-5 relative ${highlight ? 'ring-2 ring-brand-500 dark:ring-brand-400' : ''}`}>
      {highlight && (
        <span className="absolute -top-2 left-3 bg-brand-600 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shadow-sm">
          ★ Top pick
        </span>
      )}
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{country.flagEmoji}</span>
        {/* Success score intentionally omitted here — it was only LIX 1's (usually
            low). Per-server scores show in the order modal after picking a country. */}
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{country.name}</h3>
      <p className="text-xs font-medium mt-1 text-brand-600">
        {mode === 'rental' ? `${country.pricePerDay} cr / day` : `From ${country.minPrice} credits`}
      </p>
      {highlight && country.availableCount != null && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{country.availableCount} numbers in stock</p>
      )}
    </Card>
  );
}

export default function ServiceCountriesPage({ mode: modeProp }) {
  const { serviceSlug } = useParams();
  const navigate = useNavigate();
  const mode = modeProp || 'otp';
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['countriesForService', serviceSlug, mode],
    queryFn: () => getCountriesForService(serviceSlug, mode).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const allCountries = data?.countries || [];
  const isSearching = search.trim().length > 0;

  const filtered = allCountries.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  // Top picks (provider-recommended) only when not actively searching.
  const recommended = isSearching ? [] : allCountries.filter((c) => c.recommended);
  // The rest of the grid: when showing top picks, don't repeat them below.
  const rest = isSearching ? filtered : filtered.filter((c) => !c.recommended);

  const serviceName = data?.service?.name || serviceSlug;

  const handleCountryClick = (countryId) => {
    navigate(`/numbers/${mode === 'rental' ? 'rental' : 'otp'}/${countryId}?service=${serviceSlug}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/numbers/${mode === 'rental' ? 'rental' : 'otp'}?browse=service`} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
          <FiArrowLeft size={20} />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <ServiceLogo slug={serviceSlug} size={30} />
            <h1 className="font-display font-bold text-2xl text-gray-900 dark:text-white">{serviceName}</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {mode === 'otp' ? 'Select a country for a one-time OTP number' : 'Select a country to rent a number'}
          </p>
        </div>
      </div>

      {/* Mode badge */}
      <div className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${mode === 'otp' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-200' : 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-200'}`}>
        {mode === 'otp' ? '⚡ One-Time OTP' : '📅 Rental — 1 to 30 days'}
      </div>

      {/* Search */}
      <Input
        type="search"
        placeholder="Search countries..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {/* Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🌍"
          title="No countries available"
          description={search ? `No results for "${search}"` : `${serviceName} is not available for ${mode === 'rental' ? 'rental' : 'OTP'} in any country right now.`}
        />
      ) : (
        <div className="space-y-6">
          {/* Top recommended — highest current success rate */}
          {recommended.length > 0 && (
            <div className="space-y-3">
              <div>
                <h2 className="font-display font-semibold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <span>✨</span> AI Recommended
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Best chance of getting your {serviceName} code — ranked by live success rate</p>
              </div>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {recommended.map((country) => (
                  <CountryCard key={country.id} country={country} mode={mode} highlight onClick={() => handleCountryClick(country.id)} />
                ))}
              </div>
            </div>
          )}

          {/* All countries (sorted by success rate) */}
          {rest.length > 0 && (
            <div className="space-y-3">
              {recommended.length > 0 && (
                <h2 className="font-display font-semibold text-lg text-gray-900 dark:text-white">All countries</h2>
              )}
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {rest.map((country) => (
                  <CountryCard key={country.id} country={country} mode={mode} onClick={() => handleCountryClick(country.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
