import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { MeineBestellung, Bestellrunde } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { MeineBestellungDialog } from '@/components/dialogs/MeineBestellungDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/MeineBestellung';
import { evalComputed } from '@/config/form-enhancements/types';

export default function MeineBestellungDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<MeineBestellung | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [bestellrundeList, setBestellrundeList] = useState<Bestellrunde[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, bestellrundeData] = await Promise.all([
        LivingAppsService.getMeineBestellung(),
        LivingAppsService.getBestellrunde(),
      ]);
      setBestellrundeList(bestellrundeData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: MeineBestellung['fields']) {
    if (!record) return;
    await LivingAppsService.updateMeineBestellungEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteMeineBestellungEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/meine-bestellung');
  }

  function getBestellrundeDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return bestellrundeList.find(r => r.record_id === refId)?.fields.bezeichnung ?? '—';
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title="Eintrag nicht gefunden"
        action={
          <Button variant="ghost" onClick={() => navigate('/meine-bestellung')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            Zurück
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/meine-bestellung')}
      onEdit={() => setEditing(true)}
      backLabel="Zurück"
      editLabel="Bearbeiten"
    >
      <RecordHeader title={record.fields.vorname ?? 'Meine Bestellung'} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          bestellrunde: bestellrundeList,
        };
        const fmtComputed = (k: string, n: number) =>
          /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k)
            ? n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
        const computedFacts = Object.entries(formEnhancements.computed)
          .map(([key, formula]) => {
            const v = evalComputed(formula, record!.fields as Record<string, unknown>, { lookupLists });
            return v != null
              ? { label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), value: fmtComputed(key, v) }
              : null;
          })
          .filter((f): f is { label: string; value: string } => f !== null);
        return computedFacts.length > 0 ? <RecordKeyFacts items={computedFacts} /> : null;
      })()}

      <RecordSection title="Details" cols={2}>
        <RecordField label="Bestellrunde" value={getBestellrundeDisplayName(record.fields.bestellrunde)} format="text" />
        <RecordField label="Vorname" value={record.fields.vorname} format="text" />
        <RecordField label="Nachname" value={record.fields.nachname} format="text" />
        <RecordField label="Gewünschte Gerichte" value={record.fields.gerichte} format="longtext" className="md:col-span-2" />
        <RecordField label="Sonderwünsche / Anmerkungen" value={record.fields.sonderwuensche} format="longtext" className="md:col-span-2" />
        <RecordField label="Gesamtbetrag (€)" value={record.fields.betrag} format="text" />
        <RecordField label="Bereits bezahlt" value={record.fields.bezahlt} format="bool" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.MEINE_BESTELLUNG} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          Löschen
        </Button>
      </div>

      <MeineBestellungDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        bestellrundeList={bestellrundeList}
        enablePhotoScan={AI_PHOTO_SCAN['MeineBestellung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['MeineBestellung']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Meine Bestellung löschen"
        description="Soll dieser Eintrag wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
      />
    </RecordView>
  );
}
