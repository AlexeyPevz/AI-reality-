import React from 'react';
import { Listing } from '@real-estate-bot/shared';
import { formatPrice } from '@real-estate-bot/shared';
import Image from 'next/image';
import { useRouter } from 'next/router';

interface ListingCardProps {
  listing: Listing;
  matchScore?: number;
  onFavorite?: (id: string) => void;
  isFavorite?: boolean;
}

export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  matchScore,
  onFavorite,
  isFavorite = false
}) => {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/listing/${listing.id}`);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFavorite?.(listing.id);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-green-500';
    if (score >= 6) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden cursor-pointer transform transition-all hover:scale-105"
      onClick={handleClick}
    >
      {/* Image Section */}
      <div className="relative h-48 w-full">
        {listing.images && listing.images.length > 0 ? (
          <Image
            src={listing.images[0]}
            alt={listing.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
        )}
        
        {/* Match Score Badge */}
        {matchScore !== undefined && (
          <div className={`absolute top-2 right-2 ${getScoreColor(matchScore)} text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg`}>
            {matchScore.toFixed(1)}
          </div>
        )}

        {/* Favorite Button */}
        <button
          onClick={handleFavoriteClick}
          className="absolute top-2 left-2 bg-white dark:bg-gray-800 p-2 rounded-full shadow-lg"
        >
          <svg 
            className={`w-5 h-5 ${isFavorite ? 'text-red-500 fill-current' : 'text-gray-400'}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Content Section */}
      <div className="p-4">
        {/* Price */}
        <div className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {formatPrice(listing.price)}
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
          {listing.title}
        </h3>

        {/* Location */}
        <div className="flex items-center text-gray-600 dark:text-gray-400 mb-3">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm">{listing.district}</span>
          {listing.metro && (
            <>
              <span className="mx-2">•</span>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span className="text-sm">{listing.metro}</span>
            </>
          )}
        </div>

        {/* Features */}
        <div className="flex flex-wrap gap-2 mb-3">
          {listing.rooms > 0 && (
            <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded text-sm">
              {listing.rooms} комн.
            </span>
          )}
          {listing.area && (
            <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded text-sm">
              {listing.area} м²
            </span>
          )}
          {listing.floor && listing.floors && (
            <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded text-sm">
              {listing.floor}/{listing.floors} эт.
            </span>
          )}
        </div>

        {/* Match Explanation Preview */}
        {listing.matchExplanation && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {listing.matchExplanation}
          </p>
        )}

        {/* Partner Badge */}
        {listing.partnerData && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-500">
              от {listing.partnerData.partnerName}
            </span>
            {listing.partnerData.estimatedLeadRevenue && (
              <span className="text-xs text-green-600 dark:text-green-400 font-semibold">
                +{listing.partnerData.estimatedLeadRevenue}₽
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};