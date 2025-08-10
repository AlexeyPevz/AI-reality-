import { useState, useEffect } from 'react';
import { useInitData, useMainButton, useBackButton } from '@tma.js/sdk-react';
import { Listing } from '@real-estate-bot/shared';
import { ListingCard } from '@/components/ListingCard';
import { MainLayout } from '@/components/layouts/MainLayout';

export default function HomePage() {
  const initData = useInitData();
  const mainButton = useMainButton();
  const backButton = useBackButton();
  
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'price' | 'date'>('score');

  useEffect(() => {
    fetchListings();
    loadFavorites();
    
    // Setup main button
    mainButton.setText('Новый поиск');
    mainButton.show();
    mainButton.onClick(() => {
      // Return to bot to start new search
      window.Telegram?.WebApp.close();
    });

    // Hide back button on main page
    backButton.hide();

    return () => {
      mainButton.hide();
    };
  }, [mainButton, backButton]);

  const fetchListings = async () => {
    try {
      const response = await fetch('/api/listings', {
        headers: {
          'X-Init-Data': initData?.raw || ''
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch listings');
      
      const data = await response.json();
      setListings(data.listings || []);
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = () => {
    const saved = localStorage.getItem('favorites');
    if (saved) {
      setFavorites(new Set(JSON.parse(saved)));
    }
  };

  const toggleFavorite = (listingId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(listingId)) {
      newFavorites.delete(listingId);
    } else {
      newFavorites.add(listingId);
    }
    setFavorites(newFavorites);
    localStorage.setItem('favorites', JSON.stringify(Array.from(newFavorites)));
  };

  const sortedListings = [...listings].sort((a, b) => {
    switch (sortBy) {
      case 'score':
        return (b.matchScore || 0) - (a.matchScore || 0);
      case 'price':
        return a.price - b.price;
      case 'date':
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      default:
        return 0;
    }
  });

  const filteredListings = filter === 'favorites' 
    ? sortedListings.filter(l => favorites.has(l.id))
    : sortedListings;

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Подобранные объекты
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Найдено {listings.length} объектов по вашим критериям
          </p>
        </div>

        {/* Filters and Sort */}
        <div className="mb-6 space-y-3">
          {/* Filter Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'all' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Все ({listings.length})
            </button>
            <button
              onClick={() => setFilter('favorites')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'favorites' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Избранное ({favorites.size})
            </button>
          </div>

          {/* Sort Options */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Сортировка:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-lg text-sm"
            >
              <option value="score">По соответствию</option>
              <option value="price">По цене</option>
              <option value="date">По дате</option>
            </select>
          </div>
        </div>

        {/* Empty State */}
        {filteredListings.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {filter === 'favorites' 
                ? 'Вы еще не добавили объекты в избранное' 
                : 'Нет объектов по вашим критериям'}
            </p>
            <button
              onClick={() => window.Telegram?.WebApp.close()}
              className="text-blue-600 dark:text-blue-400 font-medium"
            >
              Изменить критерии поиска
            </button>
          </div>
        )}

        {/* Listings Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              matchScore={listing.matchScore}
              isFavorite={favorites.has(listing.id)}
              onFavorite={toggleFavorite}
            />
          ))}
        </div>

        {/* Stats Footer */}
        {listings.length > 0 && (
          <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <h3 className="font-semibold mb-2">Статистика поиска</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Средний score:</span>
                <p className="font-semibold">
                  {(listings.reduce((sum, l) => sum + (l.matchScore || 0), 0) / listings.length).toFixed(1)}
                </p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Диапазон цен:</span>
                <p className="font-semibold">
                  {Math.min(...listings.map(l => l.price / 1000000)).toFixed(1)} - 
                  {Math.max(...listings.map(l => l.price / 1000000)).toFixed(1)} млн ₽
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}