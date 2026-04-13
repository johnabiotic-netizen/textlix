import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCountries } from '../../api/numbers';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import { SkeletonCard } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';

export default function BrowseNumbersPage() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['countries'],
    queryFn: () => getCountries().then((r) => r.data.data.countries),
  });

  const filtered = (data || []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-gray-900 mb-1">Get a Number</h1>
        <p className="text-gray-500">Select a country to see available services</p>
      </div>

      <Input type="search" placeholder="Search countries (e.g. Nigeria, United States...)" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />

      {isLoading ? (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🌍" title="No countries found" description={search ? `No results for "${search}"` : 'No countries available right now.'} />
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((country) => (
            <Card key={country.id} hover onClick={() => navigate(`/numbers/${country.id}`)} className="p-5">
              <div className="text-3xl mb-3">{country.flagEmoji}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{country.name}</h3>
              <p className="text-xs text-gray-500">{country.serviceCount} services</p>
              <p className="text-xs font-medium text-brand-600 mt-1">From {country.minPrice} credits</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
