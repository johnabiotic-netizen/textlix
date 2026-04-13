import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCountries, updateCountry, getServices, updateService } from '../../api/admin';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import toast from 'react-hot-toast';

function ToggleRow({ label, sub, enabled, onToggle, loading }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <button
        onClick={onToggle}
        disabled={loading}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-brand-600' : 'bg-gray-200'} ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

export default function AdminCatalogPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('countries');
  const [togglingId, setTogglingId] = useState(null);

  const { data: countriesData, isLoading: loadingCountries } = useQuery({
    queryKey: ['adminCountries'],
    queryFn: () => getCountries().then((r) => r.data.data),
  });

  const { data: servicesData, isLoading: loadingServices } = useQuery({
    queryKey: ['adminServices'],
    queryFn: () => getServices().then((r) => r.data.data),
  });

  const countryMutation = useMutation({
    mutationFn: ({ id, data }) => updateCountry(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCountries'] });
      setTogglingId(null);
    },
    onError: () => { toast.error('Update failed'); setTogglingId(null); },
  });

  const serviceMutation = useMutation({
    mutationFn: ({ id, data }) => updateService(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminServices'] });
      setTogglingId(null);
    },
    onError: () => { toast.error('Update failed'); setTogglingId(null); },
  });

  const toggleCountry = (country) => {
    setTogglingId(country._id);
    countryMutation.mutate({ id: country._id, data: { isEnabled: !country.isEnabled } });
  };

  const toggleService = (service) => {
    setTogglingId(service._id);
    serviceMutation.mutate({ id: service._id, data: { isEnabled: !service.isEnabled } });
  };

  const isLoading = tab === 'countries' ? loadingCountries : loadingServices;

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="font-display font-bold text-2xl text-gray-900">Catalog</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {['countries', 'services'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm text-center py-12">Loading...</p>
      ) : tab === 'countries' ? (
        <Card className="px-6 divide-y divide-gray-100">
          {countriesData?.countries?.map((country) => (
            <ToggleRow
              key={country._id}
              label={`${country.flagEmoji} ${country.name}`}
              sub={`Code: ${country.code}`}
              enabled={country.isEnabled}
              loading={togglingId === country._id}
              onToggle={() => toggleCountry(country)}
            />
          ))}
        </Card>
      ) : (
        <Card className="px-6 divide-y divide-gray-100">
          {servicesData?.services?.map((service) => (
            <ToggleRow
              key={service._id}
              label={`${service.icon || '📱'} ${service.name}`}
              sub={`Slug: ${service.slug}`}
              enabled={service.isEnabled}
              loading={togglingId === service._id}
              onToggle={() => toggleService(service)}
            />
          ))}
        </Card>
      )}
    </div>
  );
}
