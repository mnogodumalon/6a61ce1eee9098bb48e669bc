import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDashboardData } from '@/hooks/useDashboardData';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { RestaurantSpeisekarte, MeineBestellung } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  IconToolsKitchen2Off,
  IconMapPin,
  IconPhone,
  IconExternalLink,
  IconChevronDown,
  IconChevronUp,
  IconPlus,
  IconCheck,
  IconCurrencyEuro,
  IconUser,
  IconNotes,
  IconAlertCircle,
  IconArrowLeft,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Restaurant' },
  { label: 'Bestellrunde' },
  { label: 'Bestellungen' },
  { label: 'Zusammenfassung' },
];

function formatDateTime(val: string | undefined): string {
  if (!val) return '—';
  try {
    const d = new Date(val);
    return d.toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return val;
  }
}

function formatCurrency(val: number | undefined): string {
  if (val === undefined || val === null) return '0,00 €';
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

// --- Schritt 1: Restaurant wählen ---
function RestaurantKachel({
  restaurant,
  onSelect,
}: {
  restaurant: RestaurantSpeisekarte;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const f = restaurant.fields;

  return (
    <div
      className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col"
    >
      <button
        type="button"
        className="p-4 text-left flex-1 flex flex-col gap-2 active:bg-muted/50 transition-colors"
        onClick={() => onSelect(restaurant.record_id)}
      >
        <div className="flex items-start justify-between gap-2 min-w-0">
          <h3 className="font-semibold text-base text-foreground truncate">{f.name ?? '(Kein Name)'}</h3>
          {f.kueche && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              {(f.kueche as any).label ?? f.kueche}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {f.telefon && (
            <span className="flex items-center gap-1">
              <IconPhone size={13} stroke={1.5} />
              {f.telefon}
            </span>
          )}
          {f.bestelllink && (
            <span className="flex items-center gap-1">
              <IconMapPin size={13} stroke={1.5} />
              Online-Bestellung verfügbar
            </span>
          )}
        </div>
      </button>

      {/* Aktionsleiste */}
      <div className="px-4 pb-4 flex flex-wrap gap-2">
        {f.bestelllink && (
          <a
            href={f.bestelllink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <IconExternalLink size={13} stroke={1.5} />
            Speisekarte öffnen
          </a>
        )}
        {f.speisekarte && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            onClick={() => setExpanded((p) => !p)}
          >
            {expanded ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
            {expanded ? 'Weniger anzeigen' : 'Speisekarte ansehen'}
          </button>
        )}
        <div className="flex-1" />
        <Button
          size="sm"
          onClick={() => onSelect(restaurant.record_id)}
          className="text-xs"
        >
          Auswählen
        </Button>
      </div>

      {f.speisekarte && expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3">
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans">{f.speisekarte}</pre>
        </div>
      )}
    </div>
  );
}

// --- Schritt 2: Bestellrunde anlegen ---
interface RundeForm {
  bezeichnung: string;
  bestelldatum: string;
  bestellschluss: string;
  koordinator_vorname: string;
  koordinator_nachname: string;
  anmerkungen: string;
}

// --- Schritt 3: Bestellungen erfassen ---
interface BestellungForm {
  vorname: string;
  nachname: string;
  gerichte: string;
  sonderwuensche: string;
  betrag: string;
  bezahlt: boolean;
}

const EMPTY_BESTELLUNG: BestellungForm = {
  vorname: '',
  nachname: '',
  gerichte: '',
  sonderwuensche: '',
  betrag: '',
  bezahlt: false,
};

export default function BestellrundeStartenPage() {
  const [searchParams] = useSearchParams();
  const { restaurantSpeisekarte, meineBestellung, loading, error, fetchAll } = useDashboardData();

  // Wizard-Zustand
  const [step, setStep] = useState<number>(() => {
    const urlStep = parseInt(searchParams.get('step') ?? '', 10);
    return urlStep >= 1 && urlStep <= 4 ? urlStep : 1;
  });

  // Schritt 1
  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);

  // Schritt 2
  const [rundeForm, setRundeForm] = useState<RundeForm>({
    bezeichnung: '',
    bestelldatum: '',
    bestellschluss: '',
    koordinator_vorname: '',
    koordinator_nachname: '',
    anmerkungen: '',
  });
  const [rundeSubmitting, setRundeSubmitting] = useState(false);
  const [rundeError, setRundeError] = useState<string | null>(null);
  const [bestellrundeId, setBestellrundeId] = useState<string | null>(null);
  const [bestellrundeName, setBestellrundeName] = useState('');

  // Schritt 3
  const [bestellungForm, setBestellungForm] = useState<BestellungForm>(EMPTY_BESTELLUNG);
  const [bestellungSubmitting, setBestellungSubmitting] = useState(false);
  const [bestellungError, setBestellungError] = useState<string | null>(null);

  // URL-Sync: step → URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (step > 1) {
      params.set('step', String(step));
    } else {
      params.delete('step');
    }
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}${window.location.hash ? '' : ''}`);
  }, [step, searchParams]);

  // Bestellungen für die aktuelle Runde
  const rundeBestellungen: MeineBestellung[] = bestellrundeId
    ? meineBestellung.filter((b) => {
        const id = extractRecordId(b.fields.bestellrunde);
        return id === bestellrundeId;
      })
    : [];

  const totalBetrag = rundeBestellungen.reduce((s, b) => s + (b.fields.betrag ?? 0), 0);
  const bezahltBetrag = rundeBestellungen
    .filter((b) => b.fields.bezahlt)
    .reduce((s, b) => s + (b.fields.betrag ?? 0), 0);
  const offenerBetrag = totalBetrag - bezahltBetrag;

  const selectedRestaurant = restaurantSpeisekarte.find((r) => r.record_id === selectedRestaurantId);

  // Schritt 1 — Restaurants filtern
  const filteredRestaurants = restaurantSpeisekarte.filter((r) => {
    if (!restaurantSearch.trim()) return true;
    const q = restaurantSearch.toLowerCase();
    return (
      (r.fields.name ?? '').toLowerCase().includes(q) ||
      ((r.fields.kueche as any)?.label ?? '').toLowerCase().includes(q)
    );
  });

  // Handler: Restaurant wählen
  function handleRestaurantSelect(id: string) {
    setSelectedRestaurantId(id);
    setStep(2);
  }

  // Handler: Bestellrunde anlegen
  async function handleRundeErstellen() {
    if (!rundeForm.bezeichnung.trim()) {
      setRundeError('Bitte gib eine Bezeichnung ein.');
      return;
    }
    if (!rundeForm.bestelldatum) {
      setRundeError('Bitte wähle Datum und Uhrzeit für die Bestellung.');
      return;
    }
    if (!selectedRestaurantId) return;
    setRundeSubmitting(true);
    setRundeError(null);
    try {
      const result = await LivingAppsService.createBestellrundeEntry({
        bezeichnung: rundeForm.bezeichnung,
        bestelldatum: rundeForm.bestelldatum.slice(0, 16),
        bestellschluss: rundeForm.bestellschluss || undefined,
        restaurant: createRecordUrl(APP_IDS.RESTAURANT_SPEISEKARTE, selectedRestaurantId),
        koordinator_vorname: rundeForm.koordinator_vorname || undefined,
        koordinator_nachname: rundeForm.koordinator_nachname || undefined,
        anmerkungen: rundeForm.anmerkungen || undefined,
      });
      // Neue Bestellrunden-ID aus API-Response lesen
      let newId: string | null = null;
      if (result && typeof result === 'object') {
        if ('record_id' in result) {
          newId = (result as any).record_id;
        } else {
          const keys = Object.keys(result as object);
          if (keys.length > 0) newId = keys[0];
        }
      }
      setBestellrundeId(newId);
      setBestellrundeName(rundeForm.bezeichnung);
      await fetchAll();
      setStep(3);
    } catch (err) {
      setRundeError(err instanceof Error ? err.message : 'Fehler beim Erstellen der Bestellrunde.');
    } finally {
      setRundeSubmitting(false);
    }
  }

  // Handler: Bestellung hinzufügen
  async function handleBestellungHinzufuegen() {
    if (!bestellungForm.gerichte.trim()) {
      setBestellungError('Bitte gib die Gerichte ein.');
      return;
    }
    if (!bestellrundeId) return;
    setBestellungSubmitting(true);
    setBestellungError(null);
    try {
      await LivingAppsService.createMeineBestellungEntry({
        bestellrunde: createRecordUrl(APP_IDS.BESTELLRUNDE, bestellrundeId),
        vorname: bestellungForm.vorname || undefined,
        nachname: bestellungForm.nachname || undefined,
        gerichte: bestellungForm.gerichte,
        sonderwuensche: bestellungForm.sonderwuensche || undefined,
        betrag: parseFloat(bestellungForm.betrag) || 0,
        bezahlt: bestellungForm.bezahlt,
      });
      await fetchAll();
      setBestellungForm(EMPTY_BESTELLUNG);
    } catch (err) {
      setBestellungError(err instanceof Error ? err.message : 'Fehler beim Hinzufügen der Bestellung.');
    } finally {
      setBestellungSubmitting(false);
    }
  }

  // Reset
  function handleReset() {
    setStep(1);
    setSelectedRestaurantId(null);
    setRestaurantSearch('');
    setRundeForm({
      bezeichnung: '',
      bestelldatum: '',
      bestellschluss: '',
      koordinator_vorname: '',
      koordinator_nachname: '',
      anmerkungen: '',
    });
    setRundeError(null);
    setBestellrundeId(null);
    setBestellrundeName('');
    setBestellungForm(EMPTY_BESTELLUNG);
    setBestellungError(null);
  }

  return (
    <IntentWizardShell
      title="Bestellrunde starten"
      subtitle="Restaurant wählen, Runde anlegen und Bestellungen erfassen"
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ===== SCHRITT 1: Restaurant wählen ===== */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Restaurant wählen</h2>
            <p className="text-sm text-muted-foreground">Wähle ein Restaurant für die Bestellrunde aus.</p>
          </div>

          <Input
            placeholder="Restaurant oder Küche suchen…"
            value={restaurantSearch}
            onChange={(e) => setRestaurantSearch(e.target.value)}
            className="max-w-sm"
          />

          {filteredRestaurants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                <IconToolsKitchen2Off size={22} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {restaurantSearch
                  ? 'Kein Restaurant gefunden. Passe deine Suche an.'
                  : 'Es sind noch keine Restaurants vorhanden.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredRestaurants.map((r) => (
                <RestaurantKachel key={r.record_id} restaurant={r} onSelect={handleRestaurantSelect} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== SCHRITT 2: Bestellrunde anlegen ===== */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Kontext-Banner */}
          {selectedRestaurant && (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconMapPin size={18} className="text-primary" stroke={1.5} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{selectedRestaurant.fields.name}</p>
                {selectedRestaurant.fields.kueche && (
                  <p className="text-xs text-muted-foreground">
                    {(selectedRestaurant.fields.kueche as any).label ?? selectedRestaurant.fields.kueche}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto shrink-0 text-xs text-muted-foreground"
                onClick={() => setStep(1)}
              >
                <IconArrowLeft size={14} className="mr-1" />
                Ändern
              </Button>
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Bestellrunde anlegen</h2>
            <p className="text-sm text-muted-foreground">Gib die Details zur neuen Bestellrunde ein.</p>
          </div>

          <div className="space-y-4">
            {/* Bezeichnung */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                Bezeichnung <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="z.B. Mittagessen Freitag Team A"
                value={rundeForm.bezeichnung}
                onChange={(e) => setRundeForm((p) => ({ ...p, bezeichnung: e.target.value }))}
              />
            </div>

            {/* Bestelldatum */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                Bestelldatum &amp; Uhrzeit <span className="text-destructive">*</span>
              </label>
              <Input
                type="datetime-local"
                value={rundeForm.bestelldatum}
                onChange={(e) => setRundeForm((p) => ({ ...p, bestelldatum: e.target.value }))}
              />
            </div>

            {/* Bestellschluss */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Bestellschluss</label>
              <Input
                placeholder="z.B. 11:30 Uhr"
                value={rundeForm.bestellschluss}
                onChange={(e) => setRundeForm((p) => ({ ...p, bestellschluss: e.target.value }))}
              />
            </div>

            {/* Koordinator */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Vorname Koordinator</label>
                <Input
                  placeholder="Vorname"
                  value={rundeForm.koordinator_vorname}
                  onChange={(e) => setRundeForm((p) => ({ ...p, koordinator_vorname: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Nachname Koordinator</label>
                <Input
                  placeholder="Nachname"
                  value={rundeForm.koordinator_nachname}
                  onChange={(e) => setRundeForm((p) => ({ ...p, koordinator_nachname: e.target.value }))}
                />
              </div>
            </div>

            {/* Anmerkungen */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Anmerkungen</label>
              <textarea
                className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Besondere Hinweise zur Bestellrunde…"
                value={rundeForm.anmerkungen}
                onChange={(e) => setRundeForm((p) => ({ ...p, anmerkungen: e.target.value }))}
              />
            </div>
          </div>

          {rundeError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <IconAlertCircle size={16} />
              {rundeError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Zurück
            </Button>
            <Button onClick={handleRundeErstellen} disabled={rundeSubmitting} className="flex-1 sm:flex-none">
              {rundeSubmitting ? 'Wird erstellt…' : 'Runde erstellen'}
            </Button>
          </div>
        </div>
      )}

      {/* ===== SCHRITT 3: Bestellungen erfassen ===== */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Kontext-Banner */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-1">
            <p className="font-semibold text-foreground">{bestellrundeName}</p>
            <p className="text-xs text-muted-foreground">
              {selectedRestaurant?.fields.name ?? '—'}
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Bestellungen erfassen</h2>
            <p className="text-sm text-muted-foreground">
              Füge alle Bestellungen der Runde hinzu.
            </p>
          </div>

          {/* Erfasstes Liste */}
          {rundeBestellungen.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Bereits erfasst ({rundeBestellungen.length})
              </p>
              <div className="space-y-2">
                {rundeBestellungen.map((b) => (
                  <div
                    key={b.record_id}
                    className="bg-card rounded-xl border border-border p-3 flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <IconUser size={15} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {[b.fields.vorname, b.fields.nachname].filter(Boolean).join(' ') || 'Unbekannt'}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{b.fields.gerichte}</p>
                    </div>
                    <div className="shrink-0 text-right space-y-1">
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(b.fields.betrag)}</p>
                      {b.fields.bezahlt ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                          <IconCheck size={12} stroke={2.5} /> bezahlt
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">offen</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Live-Totals */}
              <div className="bg-muted rounded-xl p-3 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Bestellungen</p>
                  <p className="text-base font-bold text-foreground">{rundeBestellungen.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gesamtbetrag</p>
                  <p className="text-base font-bold text-foreground">{formatCurrency(totalBetrag)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bezahlt</p>
                  <p className="text-base font-bold text-green-600">{formatCurrency(bezahltBetrag)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Neue Bestellung Formular */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <IconPlus size={16} />
              Neue Bestellung hinzufügen
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Vorname</label>
                <Input
                  placeholder="Vorname"
                  value={bestellungForm.vorname}
                  onChange={(e) => setBestellungForm((p) => ({ ...p, vorname: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Nachname</label>
                <Input
                  placeholder="Nachname"
                  value={bestellungForm.nachname}
                  onChange={(e) => setBestellungForm((p) => ({ ...p, nachname: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Gerichte <span className="text-destructive">*</span>
              </label>
              <textarea
                className="w-full min-h-[72px] rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Gericht aus der Speisekarte eintragen"
                value={bestellungForm.gerichte}
                onChange={(e) => setBestellungForm((p) => ({ ...p, gerichte: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Sonderwünsche</label>
              <textarea
                className="w-full min-h-[56px] rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="z.B. ohne Zwiebeln, laktosefrei…"
                value={bestellungForm.sonderwuensche}
                onChange={(e) => setBestellungForm((p) => ({ ...p, sonderwuensche: e.target.value }))}
              />
            </div>

            <div className="flex gap-3 items-end">
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium text-muted-foreground">Betrag (€)</label>
                <div className="relative">
                  <IconCurrencyEuro size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-8"
                    value={bestellungForm.betrag}
                    onChange={(e) => setBestellungForm((p) => ({ ...p, betrag: e.target.value }))}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-primary"
                  checked={bestellungForm.bezahlt}
                  onChange={(e) => setBestellungForm((p) => ({ ...p, bezahlt: e.target.checked }))}
                />
                <span className="text-sm text-foreground">Bezahlt</span>
              </label>
            </div>

            {bestellungError && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <IconAlertCircle size={16} />
                {bestellungError}
              </div>
            )}

            <Button
              onClick={handleBestellungHinzufuegen}
              disabled={bestellungSubmitting}
              className="w-full"
            >
              {bestellungSubmitting ? 'Wird hinzugefügt…' : (
                <>
                  <IconPlus size={16} className="mr-2" />
                  Bestellung hinzufügen
                </>
              )}
            </Button>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              Zurück
            </Button>
            <Button
              onClick={() => setStep(4)}
              disabled={rundeBestellungen.length === 0}
              className="flex-1 sm:flex-none"
            >
              Bestellung abschließen
            </Button>
          </div>
        </div>
      )}

      {/* ===== SCHRITT 4: Zusammenfassung ===== */}
      {step === 4 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Zusammenfassung</h2>
            <p className="text-sm text-muted-foreground">Deine Bestellrunde wurde erfolgreich gestartet.</p>
          </div>

          {/* Runden-Details */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="bg-primary/5 px-4 py-3 border-b border-border">
              <p className="font-semibold text-foreground">{bestellrundeName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedRestaurant?.fields.name ?? '—'}
                {selectedRestaurant?.fields.kueche && (
                  <> · {(selectedRestaurant.fields.kueche as any).label ?? selectedRestaurant.fields.kueche}</>
                )}
              </p>
            </div>
            <div className="px-4 py-3 grid grid-cols-2 gap-y-2 text-sm">
              {rundeForm.bestelldatum && (
                <>
                  <span className="text-muted-foreground">Bestelldatum</span>
                  <span className="font-medium text-foreground">{formatDateTime(rundeForm.bestelldatum)}</span>
                </>
              )}
              {rundeForm.bestellschluss && (
                <>
                  <span className="text-muted-foreground">Bestellschluss</span>
                  <span className="font-medium text-foreground">{rundeForm.bestellschluss}</span>
                </>
              )}
              {(rundeForm.koordinator_vorname || rundeForm.koordinator_nachname) && (
                <>
                  <span className="text-muted-foreground">Koordinator</span>
                  <span className="font-medium text-foreground">
                    {[rundeForm.koordinator_vorname, rundeForm.koordinator_nachname].filter(Boolean).join(' ')}
                  </span>
                </>
              )}
              {rundeForm.anmerkungen && (
                <>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <IconNotes size={13} /> Anmerkung
                  </span>
                  <span className="text-foreground">{rundeForm.anmerkungen}</span>
                </>
              )}
            </div>
          </div>

          {/* Bestellungen-Tabelle */}
          {rundeBestellungen.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Name</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Gerichte</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Betrag</th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Bezahlt</th>
                  </tr>
                </thead>
                <tbody>
                  {rundeBestellungen.map((b, idx) => (
                    <tr
                      key={b.record_id}
                      className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap text-foreground font-medium">
                        {[b.fields.vorname, b.fields.nachname].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate">
                        {b.fields.gerichte ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-foreground font-medium whitespace-nowrap">
                        {formatCurrency(b.fields.betrag)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {b.fields.bezahlt ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600">
                            <IconCheck size={12} stroke={2.5} />
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted">
                    <td colSpan={2} className="px-4 py-2.5 text-sm font-semibold text-foreground">
                      Gesamt ({rundeBestellungen.length} Bestellungen)
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-foreground whitespace-nowrap">
                      {formatCurrency(totalBetrag)}
                    </td>
                    <td />
                  </tr>
                  {offenerBetrag > 0 && (
                    <tr className="bg-destructive/5">
                      <td colSpan={2} className="px-4 py-2 text-xs text-destructive font-medium">
                        Noch offen
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-destructive font-semibold whitespace-nowrap">
                        {formatCurrency(offenerBetrag)}
                      </td>
                      <td />
                    </tr>
                  )}
                  {bezahltBetrag > 0 && (
                    <tr className="bg-green-50/50">
                      <td colSpan={2} className="px-4 py-2 text-xs text-green-700 font-medium">
                        Bereits bezahlt
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-green-700 font-semibold whitespace-nowrap">
                        {formatCurrency(bezahltBetrag)}
                      </td>
                      <td />
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}

          {rundeBestellungen.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center text-muted-foreground">
              <IconToolsKitchen2Off size={24} stroke={1.5} />
              <p className="text-sm">Keine Bestellungen erfasst.</p>
            </div>
          )}

          {/* Abschluss-Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep(3)} className="sm:flex-none">
              Bestellungen bearbeiten
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={handleReset}>
              Neue Runde starten
            </Button>
            <a href="#/">
              <Button>Zurück zum Dashboard</Button>
            </a>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
