import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { MatchResult } from '@real-estate-bot/shared';
import { apiClient } from '@/lib/api';
import { ListingCard } from '@/components/ListingCard';
import { useTelegram } from '@/hooks/useTelegram';

export default function HomePage() {
  const router = useRouter();
  const { user, isReady } = useTelegram();
  const [selectedPreferencesId, setSelectedPreferencesId] = useState<string | null>(null);

  // Load user preferences
  const { data: preferences, error: preferencesError } = useSWR(
    isReady ? '/preferences' : null,
    () => apiClient.getPreferences()
  );

  // Load search results
  const { data: searchResults, error: searchError, mutate: refreshSearch } = useSWR(
    selectedPreferencesId ? `/search/${selectedPreferencesId}` : null,
    () => apiClient.search(selectedPreferencesId!)
  );

  // Auto-select first preferences
  useEffect(() => {
    if (preferences && preferences.length > 0 && !selectedPreferencesId) {
      setSelectedPreferencesId(preferences[0].id);
    }
  }, [preferences, selectedPreferencesId]);

  const handleListingClick = (result: MatchResult) => {
    router.push(`/listing/${result.listingId}`);
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-telegram-button mx-auto"></div>
          <p className="mt-4 text-telegram-hint">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (preferencesError || searchError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">Произошла ошибка</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-telegram-button text-telegram-button-text px-4 py-2 rounded"
          >
            Перезагрузить
          </button>
        </div>
      </div>
    );
  }

  if (!preferences || preferences.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Добро пожаловать!</h1>
          <p className="text-telegram-hint mb-6">
            Пройдите интервью в боте, чтобы мы могли подобрать для вас идеальную недвижимость
          </p>
          <button
            onClick={() => window.Telegram?.WebApp?.close()}
            className="bg-telegram-button text-telegram-button-text px-6 py-3 rounded-lg"
          >
            Вернуться в бот
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-telegram-bg">
      {/* Header */}
      <header className="bg-telegram-secondary-bg shadow-sm p-4">
        <h1 className="text-xl font-bold mb-2">Подобранная недвижимость</h1>
        
        {/* Preferences selector */}
        {preferences.length > 1 && (
          <select
            value={selectedPreferencesId || ''}
            onChange={(e) => setSelectedPreferencesId(e.target.value)}
            className="w-full p-2 rounded bg-telegram-bg text-telegram-text"
          >
            {preferences.map((pref) => (
              <option key={pref.id} value={pref.id}>
                {pref.mode === 'life' ? '🏠 Для жизни' : '💰 Инвестиции'} - {new Date(pref.createdAt).toLocaleDateString()}
              </option>
            ))}
          </select>
        )}
      </header>

      {/* Content */}
      <main className="p-4">
        {!searchResults ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-telegram-button mx-auto"></div>
            <p className="mt-4 text-telegram-hint">Ищем подходящие варианты...</p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-telegram-hint">По вашим критериям ничего не найдено</p>
            <button
              onClick={() => refreshSearch()}
              className="mt-4 text-telegram-link"
            >
              Обновить поиск
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-telegram-hint mb-4">
              Найдено {searchResults.length} подходящих вариантов
            </p>
            
            {searchResults.map((result) => (
              <ListingCard
                key={result.listingId}
                listing={result.listing!}
                matchResult={result}
                onClick={() => handleListingClick(result)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}