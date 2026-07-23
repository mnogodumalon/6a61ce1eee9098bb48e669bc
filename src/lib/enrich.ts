import type { EnrichedBestellrunde, EnrichedMeineBestellung } from '@/types/enriched';
import type { Bestellrunde, MeineBestellung, RestaurantSpeisekarte } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface MeineBestellungMaps {
  bestellrundeMap: Map<string, Bestellrunde>;
}

export function enrichMeineBestellung(
  meineBestellung: MeineBestellung[],
  maps: MeineBestellungMaps
): EnrichedMeineBestellung[] {
  return meineBestellung.map(r => ({
    ...r,
    bestellrundeName: resolveDisplay(r.fields.bestellrunde, maps.bestellrundeMap, 'bezeichnung'),
  }));
}

interface BestellrundeMaps {
  restaurantSpeisekarteMap: Map<string, RestaurantSpeisekarte>;
}

export function enrichBestellrunde(
  bestellrunde: Bestellrunde[],
  maps: BestellrundeMaps
): EnrichedBestellrunde[] {
  return bestellrunde.map(r => ({
    ...r,
    restaurantName: resolveDisplay(r.fields.restaurant, maps.restaurantSpeisekarteMap, 'name'),
  }));
}
