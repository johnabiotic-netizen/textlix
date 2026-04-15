import { useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiArrowLeft } from 'react-icons/fi';
import { getCountriesForService } from '../../api/numbers';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import { SkeletonCard } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';

const SERVICE_EMOJIS = {
  whatsapp: '💬', telegram: '✈️', google: '🔵', facebook: '📘', instagram: '📸',
  twitter: '🐦', tiktok: '🎵', snapchat: '👻', linkedin: '💼', discord: '🎮',
  uber: '🚗', amazon: '📦', netflix: '🎬', spotify: '🎵', paypal: '💳',
};

export default function ServiceCountriesPage() {
  const { serviceSlug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = searchParams.get('mode') || 'otp';
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['countriesForService', serviceSlug, mode],
    queryFn: () => getCountriesForService(serviceSlug, mode).then((r) => r.data.data),
  });

  const countries = (data?.countries || []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const serviceName = data?.service?.name || serviceSlug;
  const emoji = SERVICE_EMOJIS[serviceSlug] || '📱';

  const handleCountryClick = (countryId) => {
    navigate(`/numbers/${countryId}?mode=${mode}&service=${serviceSlug}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/numbers?mode=${mode}&browse=service`} className="text-gray-400 hover:text-gray-600">
          <FiArrowLeft size={20} />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{emoji}</span>
            <h1 className="font-display font-bold text-2xl text-gray-900">{serviceName}</h1>
          </div>
          <p className="text-sm text-gray-500">
            {mode === 'otp' ? 'Select a country for a one-time OTP number' : 'Select a country to rent a number'}
          </p>
        </div>
      </div>

      {/* Mode badge */}
      <div className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${mode === 'otp' ? 'bg-brand-50 text-brand-700' : 'bg-purple-50 text-purple-700'}`}>
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
      ) : countries.length === 0 ? (
        <EmptyState
          icon="🌍"
          title="No countries available"
          description={search ? `No results for "${search}"` : `${serviceName} is not available for ${mode === 'rental' ? 'rental' : 'OTP'} in any country right now.`}
        />
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {countries.map((country) => (
            <Card key={country.id} hover onClick={() => handleCountryClick(country.id)} className="p-5">
              <div className="text-3xl mb-3">{country.flagEmoji}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{country.name}</h3>
              <p className={`text-xs font-medium mt-1 ${mode === 'otp' ? 'text-brand-600' : 'text-purple-600'}`}>
                {mode === 'rental'
                  ? `${country.pricePerDay} cr / day`
                  : `From ${country.minPrice} credits`}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
