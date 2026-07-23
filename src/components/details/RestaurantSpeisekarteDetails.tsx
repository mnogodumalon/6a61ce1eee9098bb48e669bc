import type { RestaurantSpeisekarte, Bestellrunde } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface RestaurantSpeisekarteDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: RestaurantSpeisekarte;
  /** 1:N „Bestellrunde": VOLLE Liste — der Block filtert auf diesen Record. */
  bestellrundeList: Bestellrunde[];
  /** Zeilen-Klick → overlay.push auf das Bestellrunde-Detail (nie der Edit-Dialog). */
  onOpenBestellrunde: (record: Bestellrunde) => void;
  /** Kontextuelles „+": öffnet den Bestellrunde-Dialog mit diesem Record vorgesetzt. */
  onAddBestellrunde: () => void;
}

export function RestaurantSpeisekarteDetails({
  record,
  bestellrundeList,
  onOpenBestellrunde,
  onAddBestellrunde,
}: RestaurantSpeisekarteDetailsProps) {
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Restaurantname" value={record.fields.name} format="text" />
        <RecordField label="Küche / Art des Essens" value={record.fields.kueche} format="pill" />
        <RecordField label="Telefonnummer" value={record.fields.telefon} format="text" />
        <RecordField label="Bestelllink (Website)" value={record.fields.bestelllink} format="url" />
        <RecordField label="Speisekarte / Gerichte" value={record.fields.speisekarte} format="longtext" className="md:col-span-2" />
        <RecordField label="Hinweise zum Restaurant" value={record.fields.hinweise} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <SatelliteSection
        title="Bestellrunde"
        items={bestellrundeList.filter(r => extractRecordId(r.fields.restaurant) === record.record_id)}
        map={r => ({ name: r.fields.bezeichnung ?? 'Bestellrunde', meta: r.fields.bestelldatum })}
        onOpen={onOpenBestellrunde}
        onAdd={onAddBestellrunde}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.RESTAURANT_SPEISEKARTE} recordId={record.record_id} />
    </>
  );
}
