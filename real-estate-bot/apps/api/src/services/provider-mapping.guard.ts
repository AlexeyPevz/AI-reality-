import { Listing } from '@real-estate-bot/shared';

export function ensureListingShape(l: Listing, source: string): Listing {
  const errs: string[] = [];
  if (!l.id) errs.push('id');
  if (!l.title) errs.push('title');
  if (!l.address) errs.push('address');
  if (typeof l.lat !== 'number' || typeof l.lng !== 'number') errs.push('geo');
  if (typeof l.price !== 'number') errs.push('price');
  if (typeof l.area !== 'number') errs.push('area');
  if (typeof l.rooms !== 'number') errs.push('rooms');

  if (errs.length) {
    console.warn(`[provider:${source}] incomplete mapping fields: ${errs.join(', ')}`);
  }
  return l;
}