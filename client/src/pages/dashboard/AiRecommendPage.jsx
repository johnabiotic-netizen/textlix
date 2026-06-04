import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiArrowLeft, FiCheck } from 'react-icons/fi';
import { getServiceList, getCountriesForService } from '../../api/numbers';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import { SkeletonCard } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';

// Service `icon` from the API is a slug (e.g. "netflix"), not an image URL —
// render an emoji by slug like the other browse pages, falling back to 📱.
const SERVICE_EMOJIS = {
  whatsapp: '💬', telegram: '✈️', google: '🔵', facebook: '📘', instagram: '📸',
  twitter: '🐦', tiktok: '🎵', snapchat: '👻', linkedin: '💼', discord: '🎮',
  uber: '🚗', amazon: '📦', netflix: '🎬', spotify: '🎵', paypal: '💳',
};

function rateBadge(sr) {
  if (sr == null) return null;
  const tone = sr >= 90
    ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
    : sr >= 75
    ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
    : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tone}`}>{sr}%</span>;
}

function CountryCard({ country, onClick, highlight }) {
  return (
    <Card hover onClick={onClick} className={`p-5 relative ${highlight ? 'ring-2 ring-brand-500 dark:ring-brand-400' : ''}`}>
      {highlight && (
        <span className="absolute -top-2 left-3 bg-brand-600 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shadow-sm">
          ★ Best chance
        </span>
      )}
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{country.flagEmoji}</span>
        {rateBadge(country.successRate)}
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{country.name}</h3>
      <p className="text-xs font-medium mt-1 text-brand-600">From {country.minPrice} credits</p>
      {highlight && country.availableCount != null && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{country.availableCount} numbers in stock</p>
      )}
    </Card>
  );
}

export default function AiRecommendPage() {
  const navigate = useNavigate();
  const [serviceSearch, setServiceSearch] = useState('');
  const [selected, setSelected] = useState(null); // { slug, name, icon }

  const { data: serviceData, isLoading: loadingServices } = useQuery({
    queryKey: ['serviceList', 'otp'],
    queryFn: () => getServiceList('otp').then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const services = (serviceData?.services || []).filter((s) =>
    s.name.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const { data: countryData, isLoading: loadingCountries } = useQuery({
    queryKey: ['countriesForService', selected?.slug, 'otp'],
    queryFn: () => getCountriesForService(selected.slug, 'otp').then((r) => r.data.data),
    enabled: !!selected,
    staleTime: 5 * 60 * 1000,
  });

  const allCountries = countryData?.countries || [];
  const recommended = allCountries.filter((c) => c.recommended);
  const rest = allCountries.filter((c) => !c.recommended);

  const go = (countryId) => navigate(`/numbers/otp/${countryId}?service=${selected.slug}`);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-r from-[#0A1831] to-brand-600 rounded-2xl p-6 md:p-8 text-white">
        <div className="flex items-center gap-2 text-brand-100 text-sm mb-1">
          <span>✨</span> AI Recommendation
        </div>
        <h1 className="font-display font-bold text-2xl md:text-3xl">
          {selected ? `Best countries for ${selected.name}` : 'Pick a service — we find your best country'}
        </h1>
        <p className="text-brand-100 text-sm mt-2 max-w-xl">
          {selected
            ? 'Ranked by live success rate — the countries with the highest chance of receiving your code right now.'
            : 'Choose what you’re verifying and we’ll instantly rank the countries with the highest chance of getting your code.'}
        </p>
      </div>

      {/* Step 1 — pick a service */}
      {!selected && (
        <>
          <Input
            type="search"
            placeholder="Search a service (WhatsApp, Telegram, Google…)"
            value={serviceSearch}
            onChange={(e) => setServiceSearch(e.target.value)}
            className="max-w-md"
          />
          {loadingServices ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : services.length === 0 ? (
            <EmptyState icon="🔍" title="No services found" description={`No results for "${serviceSearch}"`} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {services.map((s) => (
                <Card key={s.id} hover onClick={() => setSelected({ slug: s.slug, name: s.name })} className="p-4 text-center">
                  <div className="text-2xl mb-2">{SERVICE_EMOJIS[s.slug] || '📱'}</div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.name}</p>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Step 2 — ranked countries for the chosen service */}
      {selected && (
        <>
          <button
            onClick={() => setSelected(null)}
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <FiArrowLeft size={16} /> Choose a different service
          </button>

          {loadingCountries ? (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : allCountries.length === 0 ? (
            <EmptyState icon="🌍" title="No countries available" description={`${selected.name} has no numbers in stock right now. Try another service.`} />
          ) : (
            <div className="space-y-6">
              {/* AI picks */}
              {recommended.length > 0 && (
                <div className="space-y-3">
                  <div>
                    <h2 className="font-display font-semibold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                      <FiCheck className="text-green-500" /> Recommended for you
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full">LIX 1</span>
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Highest chance of receiving your {selected.name} code — ranked by live LIX 1 success rate</p>
                  </div>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {recommended.map((c) => (
                      <CountryCard key={c.id} country={c} highlight onClick={() => go(c.id)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Everything else, still rate-sorted */}
              {rest.length > 0 && (
                <div className="space-y-3">
                  {recommended.length > 0 && (
                    <h2 className="font-display font-semibold text-lg text-gray-900 dark:text-white">Other countries</h2>
                  )}
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {rest.map((c) => (
                      <CountryCard key={c.id} country={c} onClick={() => go(c.id)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
