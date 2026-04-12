// FILE: /frontend/src/pages/Packages.jsx

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { packagesApi } from '../api/packagesApi';
import PackageCard from '../components/PackageCard';
import { PlusIcon } from '@heroicons/react/24/outline';

export default function Packages() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: () => packagesApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => packagesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });

  const packages = data?.data || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Packages</h1>
          <p className="text-sm text-surface-400 mt-0.5">{packages.length} travel packages</p>
        </div>
        <button onClick={() => navigate('/packages/new')} className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          New Package
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card h-72 animate-pulse">
              <div className="h-40 bg-surface-700/30" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-surface-700/30 rounded w-2/3" />
                <div className="h-3 bg-surface-700/20 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-surface-500 mb-4">No packages created yet</p>
          <button onClick={() => navigate('/packages/new')} className="btn-primary">
            Create your first package
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              onEdit={() => navigate(`/packages/${pkg.id}/edit`)}
              onDelete={() => deleteMutation.mutate(pkg.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
