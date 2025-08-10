import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import { formatPrice, formatArea } from '@real-estate-bot/shared';
import { apiClient } from '@/lib/api';
import { MatchScoreBadge } from '@/components/MatchScoreBadge';
import { useTelegram } from '@/hooks/useTelegram';

export default function ListingPage() {
  const router = useRouter();
  const { id } = router.query;
  const { showMainButton, hideMainButton, showBackButton, hideBackButton, openLink } = useTelegram();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // Load listing data
  const { data: listing, error } = useSWR(
    id ? `/listings/${id}` : null,
    () => apiClient.getListing(id as string)
  );

  // Setup navigation
  useEffect(() => {
    showBackButton(() => router.back());
    
    return () => {
      hideBackButton();
      hideMainButton();
    };
  }, [showBackButton, hideBackButton, hideMainButton, router]);

  // Setup main button for external link
  useEffect(() => {
    if (listing?.partnerDeeplinkTemplate) {
      showMainButton('Смотреть на сайте', () => {
        // Track click
        apiClient.trackClick(listing.id);
        // Open link
        openLink(listing.partnerDeeplinkTemplate!);
      });
    }
  }, [listing, showMainButton, openLink]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">Ошибка загрузки</p>
          <button
            onClick={() => router.back()}
            className="text-telegram-link"
          >
            Вернуться назад
          </button>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-telegram-button"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-telegram-bg pb-20">
      {/* Photo Gallery */}
      <div className="relative h-64 bg-gray-200">
        {listing.photos && listing.photos.length > 0 ? (
          <>
            <Image
              src={listing.photos[currentPhotoIndex]}
              alt={listing.title}
              fill
              className="object-cover"
            />
            
            {/* Photo navigation */}
            {listing.photos.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentPhotoIndex((prev) => (prev - 1 + listing.photos.length) % listing.photos.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
                >
                  ←
                </button>
                <button
                  onClick={() => setCurrentPhotoIndex((prev) => (prev + 1) % listing.photos.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
                >
                  →
                </button>
                
                {/* Photo indicators */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {listing.photos.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full ${
                        index === currentPhotoIndex ? 'bg-white' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <span className="text-gray-500">Нет фото</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title and badges */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold mb-2">{listing.title}</h1>
          
          <div className="flex flex-wrap gap-2 mb-3">
            {listing.isNewBuilding && (
              <span className="bg-blue-500 text-white text-sm px-3 py-1 rounded">
                Новостройка
              </span>
            )}
            {listing.stage && (
              <span className="bg-gray-500 text-white text-sm px-3 py-1 rounded">
                {listing.stage}
              </span>
            )}
          </div>
        </div>

        {/* Price */}
        <div className="mb-6">
          <div className="text-3xl font-bold text-telegram-link mb-1">
            {formatPrice(listing.price)}
          </div>
          <div className="text-telegram-hint">
            {formatPrice(Math.round(listing.price / listing.area))}/м²
          </div>
        </div>

        {/* Main specs */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-telegram-secondary-bg rounded">
            <div className="text-2xl mb-1">🏠</div>
            <div className="font-semibold">{listing.rooms}</div>
            <div className="text-sm text-telegram-hint">комнат</div>
          </div>
          <div className="text-center p-3 bg-telegram-secondary-bg rounded">
            <div className="text-2xl mb-1">📐</div>
            <div className="font-semibold">{listing.area}</div>
            <div className="text-sm text-telegram-hint">м²</div>
          </div>
          <div className="text-center p-3 bg-telegram-secondary-bg rounded">
            <div className="text-2xl mb-1">🏢</div>
            <div className="font-semibold">{listing.floor}/{listing.totalFloors}</div>
            <div className="text-sm text-telegram-hint">этаж</div>
          </div>
        </div>

        {/* Address */}
        <div className="mb-6">
          <h2 className="font-semibold text-lg mb-2">Адрес</h2>
          <p className="text-telegram-hint">📍 {listing.address}</p>
        </div>

        {/* Features */}
        <div className="mb-6">
          <h2 className="font-semibold text-lg mb-3">Особенности</h2>
          <div className="space-y-2">
            {listing.hasParking && (
              <div className="flex items-center gap-2">
                <span className="text-xl">🚗</span>
                <span>Есть парковка</span>
              </div>
            )}
            {listing.year && (
              <div className="flex items-center gap-2">
                <span className="text-xl">📅</span>
                <span>Год постройки: {listing.year}</span>
              </div>
            )}
            {listing.developer && (
              <div className="flex items-center gap-2">
                <span className="text-xl">👷</span>
                <span>Застройщик: {listing.developer}</span>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {listing.description && (
          <div className="mb-6">
            <h2 className="font-semibold text-lg mb-2">Описание</h2>
            <p className="text-telegram-hint whitespace-pre-wrap">{listing.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}