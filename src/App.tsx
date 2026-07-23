import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import RestaurantSpeisekartePage from '@/pages/RestaurantSpeisekartePage';
import RestaurantSpeisekarteDetailPage from '@/pages/RestaurantSpeisekarteDetailPage';
import MeineBestellungPage from '@/pages/MeineBestellungPage';
import MeineBestellungDetailPage from '@/pages/MeineBestellungDetailPage';
import BestellrundePage from '@/pages/BestellrundePage';
import BestellrundeDetailPage from '@/pages/BestellrundeDetailPage';
import PublicFormRestaurantSpeisekarte from '@/pages/public/PublicForm_RestaurantSpeisekarte';
import PublicFormMeineBestellung from '@/pages/public/PublicForm_MeineBestellung';
import PublicFormBestellrunde from '@/pages/public/PublicForm_Bestellrunde';
// <public:imports>
// </public:imports>
// <custom:imports>
const BestellrundeStartenPage = lazy(() => import('@/pages/intents/BestellrundeStartenPage'));
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a61ce1f5bb29bc2695c038c" element={<PublicFormRestaurantSpeisekarte />} />
              <Route path="public/6a61ce1f590b5ccc3e7d6d2f" element={<PublicFormMeineBestellung />} />
              <Route path="public/6a61ce1f59f6aeaf856ebe80" element={<PublicFormBestellrunde />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="restaurant-speisekarte" element={<RestaurantSpeisekartePage />} />
                <Route path="restaurant-speisekarte/:id" element={<RestaurantSpeisekarteDetailPage />} />
                <Route path="meine-bestellung" element={<MeineBestellungPage />} />
                <Route path="meine-bestellung/:id" element={<MeineBestellungDetailPage />} />
                <Route path="bestellrunde" element={<BestellrundePage />} />
                <Route path="bestellrunde/:id" element={<BestellrundeDetailPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                <Route path="intents/bestellrunde-starten" element={<Suspense fallback={null}><BestellrundeStartenPage /></Suspense>} />
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
