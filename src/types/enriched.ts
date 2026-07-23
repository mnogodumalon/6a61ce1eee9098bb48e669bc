import type { Bestellrunde, MeineBestellung } from './app';

export type EnrichedBestellrunde = Bestellrunde & {
  restaurantName: string;
};

export type EnrichedMeineBestellung = MeineBestellung & {
  bestellrundeName: string;
};
