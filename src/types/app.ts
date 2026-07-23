// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface RestaurantSpeisekarte {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    name?: string;
    kueche?: LookupValue;
    telefon?: string;
    bestelllink?: string;
    speisekarte?: string;
    hinweise?: string;
  };
}

export interface Bestellrunde {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    bezeichnung?: string;
    bestelldatum?: string; // Format: YYYY-MM-DD oder ISO String
    bestellschluss?: string;
    restaurant?: string; // applookup -> URL zu 'RestaurantSpeisekarte' Record
    koordinator_vorname?: string;
    koordinator_nachname?: string;
    anmerkungen?: string;
  };
}

export interface MeineBestellung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    bestellrunde?: string; // applookup -> URL zu 'Bestellrunde' Record
    vorname?: string;
    nachname?: string;
    gerichte?: string;
    sonderwuensche?: string;
    betrag?: number;
    bezahlt?: boolean;
  };
}

export const APP_IDS = {
  RESTAURANT_SPEISEKARTE: '6a61ce1f5bb29bc2695c038c',
  BESTELLRUNDE: '6a61ce1f59f6aeaf856ebe80',
  MEINE_BESTELLUNG: '6a61ce1f590b5ccc3e7d6d2f',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'restaurant_speisekarte': {
    kueche: [{ key: "italienisch", label: "Italienisch" }, { key: "asiatisch", label: "Asiatisch" }, { key: "deutsch", label: "Deutsch" }, { key: "tuerkisch", label: "Türkisch" }, { key: "amerikanisch", label: "Amerikanisch" }, { key: "griechisch", label: "Griechisch" }, { key: "indisch", label: "Indisch" }, { key: "mexikanisch", label: "Mexikanisch" }, { key: "sonstiges", label: "Sonstiges" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'restaurant_speisekarte': {
    'name': 'string/text',
    'kueche': 'lookup/select',
    'telefon': 'string/tel',
    'bestelllink': 'string/url',
    'speisekarte': 'string/textarea',
    'hinweise': 'string/textarea',
  },
  'bestellrunde': {
    'bezeichnung': 'string/text',
    'bestelldatum': 'date/datetimeminute',
    'bestellschluss': 'string/text',
    'restaurant': 'applookup/select',
    'koordinator_vorname': 'string/text',
    'koordinator_nachname': 'string/text',
    'anmerkungen': 'string/textarea',
  },
  'meine_bestellung': {
    'bestellrunde': 'applookup/select',
    'vorname': 'string/text',
    'nachname': 'string/text',
    'gerichte': 'string/textarea',
    'sonderwuensche': 'string/textarea',
    'betrag': 'number',
    'bezahlt': 'bool',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateRestaurantSpeisekarte = StripLookup<RestaurantSpeisekarte['fields']>;
export type CreateBestellrunde = StripLookup<Bestellrunde['fields']>;
export type CreateMeineBestellung = StripLookup<MeineBestellung['fields']>;