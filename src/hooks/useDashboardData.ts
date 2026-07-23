import { useState, useEffect, useMemo, useCallback } from 'react';
import type { RestaurantSpeisekarte, MeineBestellung, Bestellrunde } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

/** Dashboard data + the OPTIMISTIC-WRITE API.
 *
 *  The per-entity setters (`set<Entity>`) are exported for exactly one job:
 *  optimistic updates on drag writes (onEventDrop / onEventResize /
 *  onCardMove). Call the setter FIRST — the bar/card lands instantly — then
 *  fire the PATCH in the background and call `fetchAll()` ONLY in the catch.
 *  Never await the PATCH before updating state (the UI freezes for the full
 *  round-trip on every drag) and never refetch after a successful write.
 *  There is no other mechanism (no `__optimistic`, no `mutate`).
 */
export function useDashboardData() {
  const [restaurantSpeisekarte, setRestaurantSpeisekarte] = useState<RestaurantSpeisekarte[]>([]);
  const [meineBestellung, setMeineBestellung] = useState<MeineBestellung[]>([]);
  const [bestellrunde, setBestellrunde] = useState<Bestellrunde[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [restaurantSpeisekarteData, meineBestellungData, bestellrundeData] = await Promise.all([
        LivingAppsService.getRestaurantSpeisekarte(),
        LivingAppsService.getMeineBestellung(),
        LivingAppsService.getBestellrunde(),
      ]);
      setRestaurantSpeisekarte(restaurantSpeisekarteData);
      setMeineBestellung(meineBestellungData);
      setBestellrunde(bestellrundeData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [restaurantSpeisekarteData, meineBestellungData, bestellrundeData] = await Promise.all([
          LivingAppsService.getRestaurantSpeisekarte(),
          LivingAppsService.getMeineBestellung(),
          LivingAppsService.getBestellrunde(),
        ]);
        setRestaurantSpeisekarte(restaurantSpeisekarteData);
        setMeineBestellung(meineBestellungData);
        setBestellrunde(bestellrundeData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const restaurantSpeisekarteMap = useMemo(() => {
    const m = new Map<string, RestaurantSpeisekarte>();
    restaurantSpeisekarte.forEach(r => m.set(r.record_id, r));
    return m;
  }, [restaurantSpeisekarte]);

  const bestellrundeMap = useMemo(() => {
    const m = new Map<string, Bestellrunde>();
    bestellrunde.forEach(r => m.set(r.record_id, r));
    return m;
  }, [bestellrunde]);

  return { restaurantSpeisekarte, setRestaurantSpeisekarte, meineBestellung, setMeineBestellung, bestellrunde, setBestellrunde, loading, error, fetchAll, restaurantSpeisekarteMap, bestellrundeMap };
}