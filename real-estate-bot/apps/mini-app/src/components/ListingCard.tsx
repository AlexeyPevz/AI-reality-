import Image from 'next/image';
import { Listing, MatchResult, formatPrice, formatArea } from '@real-estate-bot/shared';
import { MatchScoreBadge } from './MatchScoreBadge';

interface ListingCardProps {
  listing: Listing;
  matchResult?: MatchResult;
  onClick?: () => void;
}

export function ListingCard({ listing, matchResult, onClick }: ListingCardProps) {
  return (
    <div 
      className="bg-telegram-secondary-bg rounded-lg overflow-hidden shadow-md cursor-pointer transition-transform hover:scale-[1.02]"
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative h-48 w-full">
        {listing.photos && listing.photos.length > 0 ? (
          <Image
            src={listing.photos[0]}
            alt={listing.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gray-300 flex items-center justify-center">
            <span className="text-gray-500">Нет фото</span>
          </div>
        )}
        
        {/* Match Score Badge */}
        {matchResult && (
          <div className="absolute top-2 right-2">
            <MatchScoreBadge score={matchResult.matchScore} />
          </div>
        )}

        {/* New Building Badge */}
        {listing.isNewBuilding && (
          <div className="absolute top-2 left-2">
            <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">
              Новостройка
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-2 line-clamp-2">
          {listing.title}
        </h3>

        <p className="text-telegram-hint text-sm mb-3 line-clamp-1">
          📍 {listing.address}
        </p>

        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl font-bold text-telegram-link">
            {formatPrice(listing.price)}
          </span>
          <span className="text-sm text-telegram-hint">
            {formatPrice(Math.round(listing.price / listing.area))}/м²
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm text-telegram-hint">
          <span>🏠 {listing.rooms} комн.</span>
          <span>📐 {formatArea(listing.area)}</span>
          <span>🏢 {listing.floor}/{listing.totalFloors} эт.</span>
        </div>

        {/* Features */}
        <div className="mt-3 flex flex-wrap gap-2">
          {listing.hasParking && (
            <span className="text-xs bg-telegram-bg px-2 py-1 rounded">
              🚗 Парковка
            </span>
          )}
          {listing.stage && (
            <span className="text-xs bg-telegram-bg px-2 py-1 rounded">
              🏗 {listing.stage}
            </span>
          )}
        </div>

        {/* Match explanation */}
        {matchResult && matchResult.explanation && (
          <div className="mt-3 p-3 bg-telegram-bg rounded text-sm">
            <p className="line-clamp-3">{matchResult.explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}