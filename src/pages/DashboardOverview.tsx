import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBestellrunde, enrichMeineBestellung } from '@/lib/enrich';
import type { EnrichedBestellrunde, EnrichedMeineBestellung } from '@/types/enriched';
import type { RestaurantSpeisekarte, Bestellrunde, MeineBestellung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDateTime, formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { useState, useMemo, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { IconAlertCircle, IconTool, IconRefresh, IconCheck, IconUsers, IconCurrencyEuro, IconShoppingCart, IconClock, IconPlus, IconCircleCheck, IconToolsKitchen2 } from '@tabler/icons-react';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatCardRow, StatCard } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import {
  TableWidget, TableSkeleton, TableError, TableEmpty,
  type TableColumn, type TableRow,
} from '@/components/widgets/TableWidget';
import {
  ChartWidget, ChartSkeleton, ChartError,
  type ChartRow,
} from '@/components/widgets/ChartWidget';
import {
  RecordOverlay, RecordHeader, RecordOverlayHost, useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { BestellrundeDetails } from '@/components/details/BestellrundeDetails';
import { MeineBestellungDetails } from '@/components/details/MeineBestellungDetails';
import { RestaurantSpeisekarteDetails } from '@/components/details/RestaurantSpeisekarteDetails';
import { BestellrundeDialog } from '@/components/dialogs/BestellrundeDialog';
import { MeineBestellungDialog } from '@/components/dialogs/MeineBestellungDialog';
import { RestaurantSpeisekarteDialog } from '@/components/dialogs/RestaurantSpeisekarteDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';

type OverlayItem =
  | { type: 'meineBestellung'; record: MeineBestellung }
  | { type: 'bestellrunde'; record: Bestellrunde }
  | { type: 'restaurant'; record: RestaurantSpeisekarte };

const APPGROUP_ID = '6a61ce1eee9098bb48e669bc';
const REPAIR_ENDPOINT = '/claude/build/repair';

export default function DashboardOverview() {
  const {
    restaurantSpeisekarte, setRestaurantSpeisekarte,
    bestellrunde, setBestellrunde,
    meineBestellung, setMeineBestellung,
    restaurantSpeisekarteMap, bestellrundeMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedBestellrunde = enrichBestellrunde(bestellrunde, { restaurantSpeisekarteMap });
  const enrichedMeineBestellung = enrichMeineBestellung(meineBestellung, { bestellrundeMap });

  const clock = useClock();

  // Dialog state
  const [bestellrundeDialogOpen, setBestellrundeDialogOpen] = useState(false);
  const [bestellrundeEditRecord, setBestellrundeEditRecord] = useState<Bestellrunde | null>(null);
  const [meineBestellungDialogOpen, setMeineBestellungDialogOpen] = useState(false);
  const [meineBestellungEditRecord, setMeineBestellungEditRecord] = useState<MeineBestellung | null>(null);
  const [meineBestellungDefaultBestellrunde, setMeineBestellungDefaultBestellrunde] = useState<string | undefined>(undefined);
  const [restaurantDialogOpen, setRestaurantDialogOpen] = useState(false);

  // Overlay stack
  const overlay = useRecordOverlayStack<OverlayItem>();

  // KPI filter
  const [filter, setFilter] = useState<'all' | 'unbezahlt' | 'heute'>('all');

  // --- Derived data ---
  const today = format(clock, 'yyyy-MM-dd');
  const nowStr = format(clock, "yyyy-MM-dd'T'HH:mm");

  const unbezahlt = useMemo(
    () => meineBestellung.filter(r => !r.fields.bezahlt),
    [meineBestellung]
  );

  const heutigeBestellrunden = useMemo(
    () => enrichedBestellrunde.filter(r => r.fields.bestelldatum?.slice(0, 10) === today),
    [enrichedBestellrunde, today]
  );

  const gesamtBetrag = useMemo(
    () => meineBestellung.reduce((s, r) => s + (r.fields.betrag ?? 0), 0),
    [meineBestellung]
  );

  // filtered bestellungen for the table
  const filteredBestellungen: EnrichedMeineBestellung[] = useMemo(() => {
    if (filter === 'unbezahlt') return enrichedMeineBestellung.filter(r => !r.fields.bezahlt);
    if (filter === 'heute') {
      const todayBestellrundeIds = new Set(heutigeBestellrunden.map(r => r.record_id));
      return enrichedMeineBestellung.filter(r => {
        const id = extractRecordId(r.fields.bestellrunde);
        return id ? todayBestellrundeIds.has(id) : false;
      });
    }
    return enrichedMeineBestellung;
  }, [enrichedMeineBestellung, filter, heutigeBestellrunden]);

  // Aktive Bestellrunde (nächste in der Zukunft oder heute)
  const aktiveBestellrunde: EnrichedBestellrunde | undefined = useMemo(() => {
    const sorted = [...enrichedBestellrunde].sort((a, b) =>
      (a.fields.bestelldatum ?? '').localeCompare(b.fields.bestelldatum ?? '')
    );
    return sorted.find(r => (r.fields.bestelldatum ?? '') >= nowStr)
      ?? sorted[sorted.length - 1];
  }, [enrichedBestellrunde, clock]);

  // Offene Bestellrunde: Bestellschluss noch nicht überschritten
  const offeneBestellrunden = useMemo(
    () => enrichedBestellrunde.filter(r => !r.fields.bestelldatum || r.fields.bestelldatum >= nowStr),
    [enrichedBestellrunde, nowStr]
  );

  // Context line
  const kontextLine = useMemo(() => {
    if (enrichedBestellrunde.length === 0) return 'Noch keine Bestellrunden angelegt.';
    if (heutigeBestellrunden.length > 0) {
      const rNames = heutigeBestellrunden.map(r => r.restaurantName || r.fields.bezeichnung || '');
      return `Heute wird bestellt bei ${namen(rNames)}.`;
    }
    if (aktiveBestellrunde) {
      return `Nächste Bestellrunde: ${aktiveBestellrunde.fields.bezeichnung ?? '—'} bei ${aktiveBestellrunde.restaurantName}.`;
    }
    return `${enrichedBestellrunde.length} Bestellrunde${enrichedBestellrunde.length !== 1 ? 'n' : ''} angelegt.`;
  }, [heutigeBestellrunden, aktiveBestellrunde, enrichedBestellrunde]);

  // Advance: mark bezahlt
  const markBezahlt = useCallback((record: MeineBestellung) => {
    const prev = record.fields.bezahlt;
    setMeineBestellung(prev2 =>
      prev2.map(r => r.record_id === record.record_id ? { ...r, fields: { ...r.fields, bezahlt: true } } : r)
    );
    LivingAppsService.updateMeineBestellungEntry(record.record_id, { bezahlt: true })
      .catch(() => {
        setMeineBestellung(prev2 =>
          prev2.map(r => r.record_id === record.record_id ? { ...r, fields: { ...r.fields, bezahlt: prev } } : r)
        );
        fetchAll();
      });
    undoToast(
      `${record.fields.vorname ?? ''} ${record.fields.nachname ?? ''} als bezahlt markiert.`,
      () => {
        setMeineBestellung(prev2 =>
          prev2.map(r => r.record_id === record.record_id ? { ...r, fields: { ...r.fields, bezahlt: false } } : r)
        );
        LivingAppsService.updateMeineBestellungEntry(record.record_id, { bezahlt: false }).catch(() => fetchAll());
      }
    );
  }, [setMeineBestellung, fetchAll]);

  // Table columns
  const columns: TableColumn<EnrichedMeineBestellung>[] = [
    {
      key: 'name',
      label: 'Name',
      accessor: r => `${r.data.fields.vorname ?? ''} ${r.data.fields.nachname ?? ''}`.trim(),
      format: 'text',
      priority: 100,
      cardRole: 'title',
    },
    {
      key: 'bestellrunde',
      label: 'Bestellrunde',
      accessor: r => r.data.bestellrundeName || r.data.fields.bestellrunde || '',
      format: 'text',
      cardRole: 'subtitle',
    },
    {
      key: 'gerichte',
      label: 'Gerichte',
      accessor: r => r.data.fields.gerichte ?? '',
      format: 'text',
      priority: 80,
    },
    {
      key: 'betrag',
      label: 'Betrag',
      accessor: r => r.data.fields.betrag ?? null,
      format: 'currency',
      priority: 90,
      aggregate: 'sum',
    },
    {
      key: 'bezahlt',
      label: 'Bezahlt',
      accessor: r => r.data.fields.bezahlt ?? false,
      format: 'bool',
      priority: 100,
      responsive: 'keep',
      filterable: true,
    },
  ];

  const tableRows: TableRow<EnrichedMeineBestellung>[] = filteredBestellungen.map(r => ({
    id: `meineBestellung:${r.record_id}`,
    data: r,
    tone: r.fields.bezahlt ? 'default' : (unbezahlt.length > 0 ? 'warning' : 'default'),
  }));

  // Chart rows for Küche-Verteilung (use all meineBestellung)
  const chartRestaurantRows: ChartRow<EnrichedBestellrunde>[] = enrichedBestellrunde.map(r => ({
    id: `bestellrunde:${r.record_id}`,
    data: r,
  }));

  // Overlay opener helpers
  const openBestellrundeOverlay = useCallback((r: Bestellrunde) => {
    overlay.push({ type: 'bestellrunde', record: r });
  }, [overlay]);

  const openMeineBestellungOverlay = useCallback((r: MeineBestellung) => {
    overlay.push({ type: 'meineBestellung', record: r });
  }, [overlay]);

  const openRestaurantOverlay = useCallback((r: RestaurantSpeisekarte) => {
    overlay.push({ type: 'restaurant', record: r });
  }, [overlay]);

  // Hero: unbezahlte Bestellungen
  const heroVisible = unbezahlt.length > 0;

  // WorkList: Bestellrunden heute / demnächst
  const workListItems = offeneBestellrunden.slice(0, 5).map(r => ({
    id: r.record_id,
    title: r.fields.bezeichnung ?? '—',
    secondLine: (
      <span className="text-muted-foreground text-xs">
        {r.restaurantName ? <span className="font-medium text-foreground">{r.restaurantName}</span> : null}
        {r.fields.bestelldatum ? <> · {formatDateTime(r.fields.bestelldatum)}</> : null}
        {r.fields.bestellschluss ? <> · Schluss: {r.fields.bestellschluss}</> : null}
      </span>
    ),
    action: {
      label: '+ Bestellung',
      onClick: () => {
        setMeineBestellungDefaultBestellrunde(r.record_id);
        setMeineBestellungEditRecord(null);
        setMeineBestellungDialogOpen(true);
      },
    },
  }));

  // WorkList: Unbezahlte
  const unbezahltItems = unbezahlt.slice(0, 5).map(r => {
    const bestellrundeName = bestellrundeMap.get(extractRecordId(r.fields.bestellrunde) ?? '')?.fields.bezeichnung;
    return {
      id: r.record_id,
      title: `${r.fields.vorname ?? ''} ${r.fields.nachname ?? ''}`.trim() || '—',
      secondLine: (
        <span className="text-muted-foreground text-xs">
          <span className="font-medium text-amber-600">Offen</span>
          {r.fields.betrag != null ? <> · {formatCurrency(r.fields.betrag)}</> : null}
          {bestellrundeName ? <> · {bestellrundeName}</> : null}
        </span>
      ),
      action: {
        label: '✓ Bezahlt',
        onClick: () => markBezahlt(r),
      },
    };
  });

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Empty state
  if (meineBestellung.length === 0 && bestellrunde.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <IconToolsKitchen2 size={48} className="text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold mb-1">Gemeinsam Essen Bestellen</h2>
          <p className="text-sm text-muted-foreground max-w-xs">Lege eine Bestellrunde an, wähle ein Restaurant und sammle Bestellungen vom Team.</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          <Button size="sm" variant="outline" onClick={() => { setRestaurantDialogOpen(true); }}>
            <IconPlus size={14} className="mr-1" />Restaurant anlegen
          </Button>
          <Button size="sm" onClick={() => { setBestellrundeDialogOpen(true); }}>
            <IconPlus size={14} className="mr-1" />Erste Bestellrunde starten
          </Button>
        </div>
        <RestaurantSpeisekarteDialog
          open={restaurantDialogOpen}
          onClose={() => setRestaurantDialogOpen(false)}
          onSubmit={async (fields) => { await LivingAppsService.createRestaurantSpeisekarteEntry(fields); fetchAll(); }}
          enablePhotoScan={AI_PHOTO_SCAN['RestaurantSpeisekarte']}
          enablePhotoLocation={AI_PHOTO_LOCATION['RestaurantSpeisekarte']}
        />
        <BestellrundeDialog
          open={bestellrundeDialogOpen}
          onClose={() => setBestellrundeDialogOpen(false)}
          onSubmit={async (fields) => { await LivingAppsService.createBestellrundeEntry(fields); fetchAll(); }}
          restaurantSpeisekarteList={restaurantSpeisekarte}
          enablePhotoScan={AI_PHOTO_SCAN['Bestellrunde']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Bestellrunde']}
        />
      </div>
    );
  }

  return (
    <>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{kontextLine}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => { setBestellrundeDialogOpen(true); setBestellrundeEditRecord(null); }}>
            <IconPlus size={14} className="mr-1 shrink-0" />Bestellrunde
          </Button>
          <Button size="sm" onClick={() => { setMeineBestellungDialogOpen(true); setMeineBestellungEditRecord(null); setMeineBestellungDefaultBestellrunde(undefined); }}>
            <IconPlus size={14} className="mr-1 shrink-0" />Bestellung
          </Button>
        </div>
      </div>

      <DashboardGrid
        variant="wide"
        hero={heroVisible && (
          <HeroBanner
            icon={<IconCurrencyEuro size={18} />}
            tone="warning"
            action={{
              label: `${unbezahlt.length > 1 ? 'Alle als bezahlt markieren' : 'Als bezahlt markieren'}`,
              onClick: () => {
                unbezahlt.forEach(r => markBezahlt(r));
              },
            }}
          >
            <b>{namen(unbezahlt.map(r => `${r.fields.vorname ?? ''} ${r.fields.nachname ?? ''}`.trim()))}</b>
            {' '}{unbezahlt.length === 1 ? 'hat' : 'haben'} noch nicht bezahlt
            {unbezahlt[0]?.fields.betrag != null ? ` — offen: ${formatCurrency(unbezahlt.reduce((s, r) => s + (r.fields.betrag ?? 0), 0))}` : ''}.
          </HeroBanner>
        )}
        kpis={
          <StatCardRow>
            <StatCard
              title="Bestellungen"
              value={filteredBestellungen.length}
              description={filter === 'all' ? 'Alle Bestellrunden' : filter === 'unbezahlt' ? 'Filter: Unbezahlt' : 'Filter: Heute'}
              icon={<IconShoppingCart size={18} className="text-muted-foreground" />}
              tone="default"
            />
            <StatCard
              title="Unbezahlt"
              value={unbezahlt.length}
              description={unbezahlt.length > 0 ? `${formatCurrency(unbezahlt.reduce((s, r) => s + (r.fields.betrag ?? 0), 0))} offen` : 'Alles beglichen'}
              icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
              tone={unbezahlt.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilter(f => f === 'unbezahlt' ? 'all' : 'unbezahlt')}
              active={filter === 'unbezahlt'}
            />
            <StatCard
              title="Heute bestellen"
              value={heutigeBestellrunden.length}
              description={heutigeBestellrunden.length > 0 ? heutigeBestellrunden.map(r => r.restaurantName || r.fields.bezeichnung).join(', ') : 'Keine Bestellrunde heute'}
              icon={<IconClock size={18} className="text-muted-foreground" />}
              tone={heutigeBestellrunden.length > 0 ? 'primary' : 'default'}
              onClick={() => setFilter(f => f === 'heute' ? 'all' : 'heute')}
              active={filter === 'heute'}
            />
            <StatCard
              title="Teilnehmer"
              value={new Set(meineBestellung.map(r => `${r.fields.vorname ?? ''}${r.fields.nachname ?? ''}`)).size}
              description={`${formatCurrency(gesamtBetrag)} Gesamtbetrag`}
              icon={<IconUsers size={18} className="text-muted-foreground" />}
              tone="default"
            />
          </StatCardRow>
        }
        primary={
          tableRows.length === 0 ? (
            <TableEmpty
              title="Keine Bestellungen"
              description={filter !== 'all' ? 'Kein Ergebnis für diesen Filter.' : 'Noch keine Bestellungen eingetragen.'}
              action={filter !== 'all'
                ? <Button size="sm" variant="outline" onClick={() => setFilter('all')}>Filter zurücksetzen</Button>
                : <Button size="sm" onClick={() => { setMeineBestellungDialogOpen(true); setMeineBestellungEditRecord(null); }}><IconPlus size={14} className="mr-1" />Bestellung eintragen</Button>
              }
            />
          ) : (
            <TableWidget
              columns={columns}
              rows={tableRows}
              onRowClick={row => {
                const id = row.id.split(':')[1] ?? '';
                const record = meineBestellung.find(r => r.record_id === id);
                if (record) overlay.push({ type: 'meineBestellung', record });
              }}
              toneForRow={row => row.data.fields.bezahlt ? 'default' : 'warning'}
              actions={[
                {
                  icon: IconCircleCheck,
                  label: 'Bezahlt',
                  onClick: row => {
                    const id = row.id.split(':')[1] ?? '';
                    const record = meineBestellung.find(r => r.record_id === id);
                    if (record && !record.fields.bezahlt) markBezahlt(record);
                  },
                },
              ]}
              toolbarEnd={
                <Button size="sm" onClick={() => { setMeineBestellungDialogOpen(true); setMeineBestellungEditRecord(null); setMeineBestellungDefaultBestellrunde(undefined); }}>
                  <IconPlus size={14} className="mr-1 shrink-0" />Bestellung
                </Button>
              }
            />
          )
        }
        aside={
          <>
            <WorkList
              title="Bestellrunden"
              icon={<IconClock size={14} />}
              items={workListItems}
              onItemClick={id => {
                const record = bestellrunde.find(r => r.record_id === id);
                if (record) overlay.push({ type: 'bestellrunde', record });
              }}
              empty={{
                text: 'Keine offenen Bestellrunden.',
                action: { label: 'Bestellrunde anlegen', onClick: () => { setBestellrundeDialogOpen(true); setBestellrundeEditRecord(null); } },
              }}
            />
            {chartRestaurantRows.length > 0 ? (
              <ChartWidget
                title="Bestellrunden nach Restaurant"
                rows={chartRestaurantRows}
                dimension={{ kind: 'category', accessor: r => r.data.restaurantName || 'Unbekannt' }}
              />
            ) : (
              <WorkList
                title="Restaurants"
                icon={<IconToolsKitchen2 size={14} />}
                items={restaurantSpeisekarte.slice(0, 5).map(r => ({
                  id: r.record_id,
                  title: r.fields.name ?? '—',
                  secondLine: (
                    <span className="text-muted-foreground text-xs">
                      {r.fields.kueche?.label ? <span>{r.fields.kueche.label}</span> : null}
                      {r.fields.telefon ? <> · {r.fields.telefon}</> : null}
                    </span>
                  ),
                }))}
                onItemClick={id => {
                  const record = restaurantSpeisekarte.find(r => r.record_id === id);
                  if (record) overlay.push({ type: 'restaurant', record });
                }}
                empty={{
                  text: 'Noch keine Restaurants.',
                  action: { label: 'Restaurant anlegen', onClick: () => setRestaurantDialogOpen(true) },
                }}
              />
            )}
          </>
        }
      />

      {/* Overlay host */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          if (top.type === 'meineBestellung') {
            return (
              <>
                <RecordHeader
                  title={`${top.record.fields.vorname ?? ''} ${top.record.fields.nachname ?? ''}`.trim() || 'Bestellung'}
                  subtitle={bestellrundeMap.get(extractRecordId(top.record.fields.bestellrunde) ?? '')?.fields.bezeichnung}
                />
                <MeineBestellungDetails
                  record={top.record}
                  bestellrundeList={bestellrunde}
                  onOpenBestellrunde={openBestellrundeOverlay}
                />
              </>
            );
          }
          if (top.type === 'bestellrunde') {
            return (
              <>
                <RecordHeader
                  title={top.record.fields.bezeichnung ?? 'Bestellrunde'}
                  subtitle={restaurantSpeisekarteMap.get(extractRecordId(top.record.fields.restaurant) ?? '')?.fields.name}
                />
                <BestellrundeDetails
                  record={top.record}
                  restaurantSpeisekarteList={restaurantSpeisekarte}
                  onOpenRestaurantSpeisekarte={openRestaurantOverlay}
                  meineBestellungList={meineBestellung}
                  onOpenMeineBestellung={openMeineBestellungOverlay}
                  onAddMeineBestellung={() => {
                    setMeineBestellungDefaultBestellrunde(top.record.record_id);
                    setMeineBestellungEditRecord(null);
                    setMeineBestellungDialogOpen(true);
                  }}
                />
              </>
            );
          }
          if (top.type === 'restaurant') {
            return (
              <>
                <RecordHeader
                  title={top.record.fields.name ?? 'Restaurant'}
                  subtitle={top.record.fields.kueche?.label}
                />
                <RestaurantSpeisekarteDetails
                  record={top.record}
                  bestellrundeList={bestellrunde}
                  onOpenBestellrunde={openBestellrundeOverlay}
                  onAddBestellrunde={() => {
                    setBestellrundeEditRecord(null);
                    setBestellrundeDialogOpen(true);
                  }}
                />
              </>
            );
          }
          return null;
        }}
        footer={top => {
          if (top.type === 'meineBestellung' && !top.record.fields.bezahlt) {
            return (
              <Button size="sm" onClick={() => markBezahlt(top.record)}>
                <IconCircleCheck size={14} className="mr-1" />Als bezahlt markieren
              </Button>
            );
          }
          if (top.type === 'meineBestellung') {
            return (
              <Button size="sm" variant="outline" onClick={() => {
                setMeineBestellungEditRecord(top.record);
                setMeineBestellungDialogOpen(true);
              }}>
                Bearbeiten
              </Button>
            );
          }
          if (top.type === 'bestellrunde') {
            return (
              <Button size="sm" variant="outline" onClick={() => {
                setBestellrundeEditRecord(top.record);
                setBestellrundeDialogOpen(true);
              }}>
                Bearbeiten
              </Button>
            );
          }
          return null;
        }}
      />

      {/* Dialogs */}
      <BestellrundeDialog
        open={bestellrundeDialogOpen}
        onClose={() => { setBestellrundeDialogOpen(false); setBestellrundeEditRecord(null); }}
        onSubmit={async (fields) => {
          if (bestellrundeEditRecord) {
            await LivingAppsService.updateBestellrundeEntry(bestellrundeEditRecord.record_id, fields);
          } else {
            await LivingAppsService.createBestellrundeEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={bestellrundeEditRecord?.fields}
        recordId={bestellrundeEditRecord?.record_id}
        restaurantSpeisekarteList={restaurantSpeisekarte}
        enablePhotoScan={AI_PHOTO_SCAN['Bestellrunde']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Bestellrunde']}
      />

      <MeineBestellungDialog
        open={meineBestellungDialogOpen}
        onClose={() => { setMeineBestellungDialogOpen(false); setMeineBestellungEditRecord(null); setMeineBestellungDefaultBestellrunde(undefined); }}
        onSubmit={async (fields) => {
          if (meineBestellungEditRecord) {
            await LivingAppsService.updateMeineBestellungEntry(meineBestellungEditRecord.record_id, fields);
          } else {
            await LivingAppsService.createMeineBestellungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={meineBestellungEditRecord?.fields ?? (meineBestellungDefaultBestellrunde ? { bestellrunde: createRecordUrl(APP_IDS.BESTELLRUNDE, meineBestellungDefaultBestellrunde) } : undefined)}
        recordId={meineBestellungEditRecord?.record_id}
        bestellrundeList={bestellrunde}
        enablePhotoScan={AI_PHOTO_SCAN['MeineBestellung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['MeineBestellung']}
      />

      <RestaurantSpeisekarteDialog
        open={restaurantDialogOpen}
        onClose={() => setRestaurantDialogOpen(false)}
        onSubmit={async (fields) => { await LivingAppsService.createRestaurantSpeisekarteEntry(fields); fetchAll(); }}
        enablePhotoScan={AI_PHOTO_SCAN['RestaurantSpeisekarte']}
        enablePhotoLocation={AI_PHOTO_LOCATION['RestaurantSpeisekarte']}
      />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
