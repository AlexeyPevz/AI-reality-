import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Listing, formatPrice } from '@real-estate-bot/shared';
import Image from 'next/image';
import { useInitData } from '@tma.js/sdk-react';
import { MainLayout } from '@/components/layouts/MainLayout';

export default function ListingDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const initData = useInitData();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showContactModal, setShowContactModal] = useState(false);

  useEffect(() => {
    if (id) {
      fetchListing(id as string);
    }
  }, [id]);

  const fetchListing = async (listingId: string) => {
    try {
      const response = await fetch(`/api/listings/${listingId}`, {
        headers: {
          'X-Init-Data': initData?.raw || ''
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch listing');
      
      const data = await response.json();
      setListing(data);
    } catch (error) {
      console.error('Error fetching listing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.shareMessage(
        `Посмотри этот объект: ${listing?.title}\n${formatPrice(listing?.price || 0)}`,
        `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}?start=listing_${listing?.id}`
      );
    }
  };

  const handleContact = () => {
    setShowContactModal(true);
    // Track lead generation
    fetch('/api/leads/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Init-Data': initData?.raw || ''
      },
      body: JSON.stringify({ listingId: listing?.id })
    });
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </MainLayout>
    );
  }

  if (!listing) {
    return (
      <MainLayout>
        <div className="text-center py-8">
          <p>Объект не найден</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        {/* Image Gallery */}
        <div className="relative h-64 md:h-96 bg-gray-200 dark:bg-gray-800">
          {listing.images && listing.images.length > 0 ? (
            <>
              <Image
                src={listing.images[currentImageIndex]}
                alt={listing.title}
                fill
                className="object-cover"
              />
              {listing.images.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex(prev => 
                      prev === 0 ? listing.images!.length - 1 : prev - 1
                    )}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex(prev => 
                      prev === listing.images!.length - 1 ? 0 : prev + 1
                    )}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {listing.images.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`w-2 h-2 rounded-full ${
                          index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {listing.title}
            </h1>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {formatPrice(listing.price)}
            </div>
          </div>

          {/* Location */}
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4">
            <h2 className="font-semibold mb-2">Расположение</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-2">{listing.address}</p>
            <div className="flex flex-wrap gap-2">
              {listing.district && (
                <span className="bg-white dark:bg-gray-700 px-3 py-1 rounded-full text-sm">
                  📍 {listing.district}
                </span>
              )}
              {listing.metro && (
                <span className="bg-white dark:bg-gray-700 px-3 py-1 rounded-full text-sm">
                  🚇 {listing.metro}
                  {listing.metroDistance && ` (${listing.metroDistance.minutes} мин)`}
                </span>
              )}
            </div>
          </div>

          {/* Characteristics */}
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4">
            <h2 className="font-semibold mb-2">Характеристики</h2>
            <div className="grid grid-cols-2 gap-4">
              {listing.rooms > 0 && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400 text-sm">Комнат</span>
                  <p className="font-semibold">{listing.rooms}</p>
                </div>
              )}
              {listing.area && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400 text-sm">Площадь</span>
                  <p className="font-semibold">{listing.area} м²</p>
                </div>
              )}
              {listing.floor && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400 text-sm">Этаж</span>
                  <p className="font-semibold">{listing.floor}/{listing.floors || '?'}</p>
                </div>
              )}
              {listing.price && listing.area && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400 text-sm">Цена за м²</span>
                  <p className="font-semibold">{formatPrice(Math.round(listing.price / listing.area))}</p>
                </div>
              )}
            </div>
          </div>

          {/* Features */}
          {listing.features && listing.features.length > 0 && (
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4">
              <h2 className="font-semibold mb-2">Особенности</h2>
              <div className="flex flex-wrap gap-2">
                {listing.features.map((feature, index) => (
                  <span key={index} className="bg-white dark:bg-gray-700 px-3 py-1 rounded-full text-sm">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {listing.description && (
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4">
              <h2 className="font-semibold mb-2">Описание</h2>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {listing.description}
              </p>
            </div>
          )}

          {/* Match Explanation */}
          {listing.matchExplanation && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
              <h2 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">
                Почему этот объект вам подходит
              </h2>
              <p className="text-blue-800 dark:text-blue-200">
                {listing.matchExplanation}
              </p>
            </div>
          )}

          {/* Subtle offers */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-2">Полезные сервисы (по желанию)</h3>
            <div className="flex flex-wrap gap-3 text-sm">
              <a
                href={`/api/offers?type=${listing.dealType === 'rent' ? 'rent' : 'mortgage'}&listingId=${listing.id}`}
                className="text-blue-600 dark:text-blue-400"
              >
                {listing.dealType === 'rent' ? 'Проверить аренду' : 'Рассчитать ипотеку'}
              </a>
              <span className="text-gray-400">•</span>
              <a
                href={`/api/offers?type=legal&listingId=${listing.id}`}
                className="text-blue-600 dark:text-blue-400"
              >
                Юрпроверка
              </a>
              <span className="text-gray-400">•</span>
              <a
                href={`/api/offers?type=insurance&listingId=${listing.id}`}
                className="text-blue-600 dark:text-blue-400"
              >
                Страховка
              </a>
            </div>
          </div>

          {/* Partner Info */}
          {listing.partnerData && (
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Предложение от партнера
                </span>
                <span className="font-semibold">{listing.partnerData.partnerName}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="max-w-4xl mx-auto flex gap-3">
              <button
                onClick={handleContact}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Связаться
              </button>
              <button
                onClick={handleShare}
                className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a9.001 9.001 0 010-7.684m-9.032 4.026A9.001 9.001 0 0112 3c2.485 0 4.735 1.007 6.368 2.632M8.684 10.658A9.001 9.001 0 0112 21c-2.485 0-4.735-1.007-6.368-2.632" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Contact Modal */}
        {showContactModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
              <h3 className="text-lg font-semibold mb-4">Спасибо за интерес!</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Мы передали вашу заявку партнеру. С вами свяжутся в ближайшее время.
              </p>
              <button
                onClick={() => setShowContactModal(false)}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold"
              >
                Понятно
              </button>
            </div>
          </div>
        )}

        {/* Spacer for fixed buttons */}
        <div className="h-20"></div>
      </div>
    </MainLayout>
  );
}