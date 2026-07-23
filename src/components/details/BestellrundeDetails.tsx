import type { Bestellrunde, RestaurantSpeisekarte, MeineBestellung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface BestellrundeDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Bestellrunde;
  /** N:1-Ziel „RestaurantSpeisekarte": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  restaurantSpeisekarteList: RestaurantSpeisekarte[];
  /** Klick auf die RestaurantSpeisekarte-Relation → overlay.push auf dessen Detail. */
  onOpenRestaurantSpeisekarte?: (record: RestaurantSpeisekarte) => void;
  /** 1:N „Meine Bestellung": VOLLE Liste — der Block filtert auf diesen Record. */
  meineBestellungList: MeineBestellung[];
  /** Zeilen-Klick → overlay.push auf das MeineBestellung-Detail (nie der Edit-Dialog). */
  onOpenMeineBestellung: (record: MeineBestellung) => void;
  /** Kontextuelles „+": öffnet den MeineBestellung-Dialog mit diesem Record vorgesetzt. */
  onAddMeineBestellung: () => void;
}

export function BestellrundeDetails({
  record,
  restaurantSpeisekarteList,
  onOpenRestaurantSpeisekarte,
  meineBestellungList,
  onOpenMeineBestellung,
  onAddMeineBestellung,
}: BestellrundeDetailsProps) {
  const restaurantTarget = restaurantSpeisekarteList.find(r => r.record_id === extractRecordId(record.fields.restaurant));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Bezeichnung der Bestellrunde" value={record.fields.bezeichnung} format="text" />
        <RecordField label="Bestelldatum und -uhrzeit" value={record.fields.bestelldatum} format="datetime" />
        <RecordField label="Bestellschluss (Uhrzeit)" value={record.fields.bestellschluss} format="text" />
        <RecordField label="Vorname des Koordinators" value={record.fields.koordinator_vorname} format="text" />
        <RecordField label="Nachname des Koordinators" value={record.fields.koordinator_nachname} format="text" />
        <RecordField label="Anmerkungen zur Bestellrunde" value={record.fields.anmerkungen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={1}>
        <RecordRelation
          label="Restaurant"
          name={restaurantTarget?.fields.name ?? '—'}
          meta={[restaurantTarget?.fields.telefon].filter(Boolean).join(' · ') || undefined}
          onClick={restaurantTarget && onOpenRestaurantSpeisekarte ? () => onOpenRestaurantSpeisekarte!(restaurantTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title="Meine Bestellung"
        items={meineBestellungList.filter(r => extractRecordId(r.fields.bestellrunde) === record.record_id)}
        map={r => ({ name: r.fields.vorname ?? 'Meine Bestellung', meta: undefined })}
        onOpen={onOpenMeineBestellung}
        onAdd={onAddMeineBestellung}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.BESTELLRUNDE} recordId={record.record_id} />
    </>
  );
}
