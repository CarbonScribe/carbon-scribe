'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowDownUp, Leaf, Loader2, Search } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import {
  searchMarketplaceCredits,
  type MarketplaceCredit,
  type MarketplaceSearchResult,
} from '@/lib/api/marketplace.api';

const PAGE_SIZE = 12;

export default function MarketplacePage() {
  const [results, setResults] = useState<MarketplaceSearchResult | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [methodology, setMethodology] = useState('');
  const [vintage, setVintage] = useState('');
  const [sortBy, setSortBy] = useState<'price' | 'vintage'>('price');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCredits = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchMarketplaceCredits(
        {
          query: query || undefined,
          methodology: methodology || undefined,
          vintageFrom: vintage ? Number(vintage) : undefined,
          vintageTo: vintage ? Number(vintage) : undefined,
          sortBy,
          sortOrder,
          page,
          limit: PAGE_SIZE,
        },
        signal,
      );
      setResults(data);
    } catch (requestError) {
      if (signal.aborted) return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load marketplace credits.',
      );
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [methodology, page, query, reload, sortBy, sortOrder, vintage]);

  useEffect(() => {
    const controller = new AbortController();
    void loadCredits(controller.signal);
    return () => controller.abort();
  }, [loadCredits]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setQuery(searchInput.trim());
  };

  const updateMethodology = (value: string) => {
    setPage(1);
    setMethodology(value);
  };

  const updateVintage = (value: string) => {
    setPage(1);
    setVintage(value);
  };

  const updateSort = (value: string) => {
    setPage(1);
    if (value === 'price-desc') {
      setSortBy('price');
      setSortOrder('desc');
    } else if (value === 'vintage-desc') {
      setSortBy('vintage');
      setSortOrder('desc');
    } else if (value === 'vintage-asc') {
      setSortBy('vintage');
      setSortOrder('asc');
    } else {
      setSortBy('price');
      setSortOrder('asc');
    }
  };

  const totalPages = results ? Math.max(1, Math.ceil(results.total / PAGE_SIZE)) : 1;
  const methodologies = results?.facets.methodologies ?? [];
  const vintages = results?.facets.vintageYears ?? [];

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="rounded-2xl bg-linear-to-r from-emerald-600 to-teal-700 p-6 text-white">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-100">
          Available carbon credits
        </p>
        <h1 className="text-2xl font-bold md:text-3xl">Carbon Credit Marketplace</h1>
        <p className="mt-2 max-w-2xl text-emerald-50">
          Explore available credits from regenerative projects and discover the details behind each listing.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm" aria-label="Marketplace filters">
        <form onSubmit={handleSearch} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(150px,200px))_auto]">
          <label className="relative block">
            <span className="sr-only">Search credits</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search projects, countries, methodology"
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label>
            <span className="sr-only">Filter by methodology</span>
            <select
              value={methodology}
              onChange={(event) => updateMethodology(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All methodologies</option>
              {methodologies.map(({ value }) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by vintage year</span>
            <select
              value={vintage}
              onChange={(event) => updateVintage(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All vintage years</option>
              {vintages.map(({ value }) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Sort listings</span>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(event) => updateSort(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="vintage-desc">Vintage: newest first</option>
              <option value="vintage-asc">Vintage: oldest first</option>
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </button>
        </form>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
          <h2 className="font-semibold text-red-900">Unable to load marketplace credits</h2>
          <p className="mt-1 text-sm text-red-800">{error}</p>
          <button
            type="button"
            onClick={() => setReload((current) => current + 1)}
            className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="flex min-h-56 items-center justify-center gap-3 text-gray-600" role="status">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" aria-hidden="true" />
          <span>Loading available credits...</span>
        </div>
      ) : !results?.data.length ? (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <EmptyState
            icon={<Leaf className="h-7 w-7" />}
            title="No credits found"
            description="There are no available credits matching your search. Try changing or clearing the filters."
            action={query || methodology || vintage ? {
              label: 'Clear filters',
              onClick: () => {
                setSearchInput('');
                setQuery('');
                setMethodology('');
                setVintage('');
                setPage(1);
              },
            } : undefined}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-600" aria-live="polite">
              Showing {results.data.length} of {results.total.toLocaleString()} available credits
            </p>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" />
              Sorted by {sortBy}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.data.map((credit) => (
              <CreditCard key={credit.id} credit={credit} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-4 py-2" aria-label="Marketplace pagination">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function CreditCard({ credit }: { credit: MarketplaceCredit }) {
  const currency = credit.currency || 'USD';
  const price = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(credit.pricePerTon));
  const amount = new Intl.NumberFormat().format(Number(credit.availableAmount));

  return (
    <article className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {credit.country || 'Carbon project'}
          </p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">{credit.projectName}</h2>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          {credit.status}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-gray-500">Price per tonne</dt>
          <dd className="mt-1 font-semibold text-gray-900">{price}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Available</dt>
          <dd className="mt-1 font-semibold text-gray-900">{amount} tCO2e</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Vintage</dt>
          <dd className="mt-1 font-medium text-gray-800">{credit.vintage ?? 'Not specified'}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Methodology</dt>
          <dd className="mt-1 truncate font-medium text-gray-800" title={credit.methodology || 'Not specified'}>
            {credit.methodology || 'Not specified'}
          </dd>
        </div>
      </dl>

      {credit.verificationStandard && (
        <p className="mt-4 text-xs text-gray-500">Standard: {credit.verificationStandard}</p>
      )}

      <Link
        href={`/projects/${encodeURIComponent(credit.projectId)}`}
        className="mt-5 inline-flex items-center justify-center rounded-lg border border-emerald-700 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
      >
        View project
      </Link>
    </article>
  );
}
