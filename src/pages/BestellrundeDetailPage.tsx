import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Bestellrunde, RestaurantSpeisekarte } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { BestellrundeDialog } from '@/components/dialogs/BestellrundeDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Bestellrunde';
import { evalComputed } from '@/config/form-enhancements/types';

export default function BestellrundeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Bestellrunde | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restaurantSpeisekarteList, setRestaurantSpeisekarteList] = useState<RestaurantSpeisekarte[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, restaurantSpeisekarteData] = await Promise.all([
        LivingAppsService.getBestellrunde(),
        LivingAppsService.getRestaurantSpeisekarte(),
      ]);
      setRestaurantSpeisekarteList(restaurantSpeisekarteData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Bestellrunde['fields']) {
    if (!record) return;
    await LivingAppsService.updateBestellrundeEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteBestellrundeEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/bestellrunde');
  }

  function getRestaurantSpeisekarteDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return restaurantSpeisekarteList.find(r => r.record_id === refId)?.fields.name ?? '—';
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title="Eintrag nicht gefunden"
        action={
          <Button variant="ghost" onClick={() => navigate('/bestellrunde')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            Zurück
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/bestellrunde')}
      onEdit={() => setEditing(true)}
      backLabel="Zurück"
      editLabel="Bearbeiten"
    >
      <RecordHeader title={record.fields.bezeichnung ?? 'Bestellrunde'} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          restaurant: restaurantSpeisekarteList,
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
        <RecordField label="Bezeichnung der Bestellrunde" value={record.fields.bezeichnung} format="text" />
        <RecordField label="Bestelldatum und -uhrzeit" value={record.fields.bestelldatum} format="datetime" />
        <RecordField label="Bestellschluss (Uhrzeit)" value={record.fields.bestellschluss} format="text" />
        <RecordField label="Restaurant" value={getRestaurantSpeisekarteDisplayName(record.fields.restaurant)} format="text" />
        <RecordField label="Vorname des Koordinators" value={record.fields.koordinator_vorname} format="text" />
        <RecordField label="Nachname des Koordinators" value={record.fields.koordinator_nachname} format="text" />
        <RecordField label="Anmerkungen zur Bestellrunde" value={record.fields.anmerkungen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.BESTELLRUNDE} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          Löschen
        </Button>
      </div>

      <BestellrundeDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        restaurantSpeisekarteList={restaurantSpeisekarteList}
        enablePhotoScan={AI_PHOTO_SCAN['Bestellrunde']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Bestellrunde']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Bestellrunde löschen"
        description="Soll dieser Eintrag wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
      />
    </RecordView>
  );
}
