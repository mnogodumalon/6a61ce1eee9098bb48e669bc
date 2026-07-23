import type { Bestellrunde, MeineBestellung } from './app';

export type EnrichedMeineBestellung = MeineBestellung & {
  bestellrundeName: string;
};

export type EnrichedBestellrunde = Bestellrunde & {
  restaurantName: string;
};
