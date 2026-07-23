import type { MeineBestellung, Bestellrunde } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';

export interface MeineBestellungDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: MeineBestellung;
  /** N:1-Ziel „Bestellrunde": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  bestellrundeList: Bestellrunde[];
  /** Klick auf die Bestellrunde-Relation → overlay.push auf dessen Detail. */
  onOpenBestellrunde?: (record: Bestellrunde) => void;
}

export function MeineBestellungDetails({
  record,
  bestellrundeList,
  onOpenBestellrunde,
}: MeineBestellungDetailsProps) {
  const bestellrundeTarget = bestellrundeList.find(r => r.record_id === extractRecordId(record.fields.bestellrunde));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Vorname" value={record.fields.vorname} format="text" />
        <RecordField label="Nachname" value={record.fields.nachname} format="text" />
        <RecordField label="Gewünschte Gerichte" value={record.fields.gerichte} format="longtext" className="md:col-span-2" />
        <RecordField label="Sonderwünsche / Anmerkungen" value={record.fields.sonderwuensche} format="longtext" className="md:col-span-2" />
        <RecordField label="Gesamtbetrag (€)" value={record.fields.betrag} format="text" />
        <RecordField label="Bereits bezahlt" value={record.fields.bezahlt} format="bool" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={1}>
        <RecordRelation
          label="Bestellrunde"
          name={bestellrundeTarget?.fields.bezeichnung ?? '—'}
          meta={[bestellrundeTarget?.fields.bestellschluss, bestellrundeTarget?.fields.koordinator_vorname].filter(Boolean).join(' · ') || undefined}
          onClick={bestellrundeTarget && onOpenBestellrunde ? () => onOpenBestellrunde!(bestellrundeTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.MEINE_BESTELLUNG} recordId={record.record_id} />
    </>
  );
}
