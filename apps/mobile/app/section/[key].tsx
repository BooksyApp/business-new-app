import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Header, Screen, StateView } from '@/components/ui';
import { CustomReports } from '@/screens/CustomReports';
import { Expenses } from '@/screens/Expenses';
import { Finance } from '@/screens/Finance';
import { Integrations } from '@/screens/Integrations';
import { Inventory } from '@/screens/Inventory';
import { Marketing } from '@/screens/Marketing';
import { Payroll } from '@/screens/Payroll';
import { Profile } from '@/screens/Profile';
import { Roles } from '@/screens/Roles';
import { Branches, Offers, OnlineShop, RotaView, Support } from '@/screens/More2';
import { Combos } from '@/screens/Combos';
import { Promotion } from '@/screens/Promotion';
import { Suppliers } from '@/screens/Suppliers';
import { Groups } from '@/screens/Groups';
import { Looks } from '@/screens/Looks';
import { Reports } from '@/screens/Reports';
import { Reviews } from '@/screens/Reviews';
import { Messages } from '@/screens/Messages';
import { Sales } from '@/screens/Sales';
import { Services } from '@/screens/Services';
import { GiftCards } from '@/screens/GiftCards';
import { Settings } from '@/screens/Settings';
import { NotifTextsEditor, ResourceTypes, RevenuePlan } from '@/screens/HubExtras';
import { HoursEditor } from '@/screens/SettingsMore';
import { Team } from '@/screens/Team';
import { t as tr, type StringKey } from '@/i18n';
import { canOpen } from '@/lib/access';
import { useApp } from '@/lib/app';

/** Sections of "Daha çox". Services, team, sales, messages and settings are real screens; looks and reviews stay a clean "coming soon" (no fake data). */
const ICONS: Record<string, string> = { views: 'spark', services: 'scissors', team: 'users', reviews: 'star', messages: 'chat', settings: 'gear', sales: 'wallet' };

export default function Section() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/more'));
  const { salon } = useApp();
  if (!canOpen(salon, String(key))) return <Screen><Header title={tr('ob.noAccessTitle')} onBack={back} /><StateView icon="shield" title={tr('ob.noAccessTitle')} body={tr('ob.noAccessBody')} /></Screen>;
  switch (key) {
    case 'services': return <Services onBack={back} />;
    case 'groups': return <Groups onBack={back} />;
    case 'promotion': return <Promotion onBack={back} />;
    case 'suppliers': return <Suppliers onBack={back} />;
    case 'combos': return <Combos onBack={back} />;
    case 'inventory': return <Inventory onBack={back} />;
    case 'expenses': return <Expenses onBack={back} />;
    case 'marketing': return <Marketing onBack={back} />;
    case 'finance': return <Finance onBack={back} />;
    case 'payroll': return <Payroll onBack={back} />;
    case 'roles': return <Roles onBack={back} />;
    case 'integrations': return <Integrations onBack={back} />;
    case 'custom': return <CustomReports onBack={back} />;
    case 'profile': return <Profile onBack={back} />;
    case 'support': return <Support onBack={back} />;
    case 'offers': return <Offers onBack={back} />;
    case 'branches': return <Branches onBack={back} />;
    case 'shop': return <OnlineShop onBack={back} />;
    case 'rota': return <RotaView onBack={back} />;
    case 'views': return <Looks onBack={back} />;
    case 'reviews': return <Reviews onBack={back} />;
    case 'reports': return <Reports onBack={back} />;
    case 'team': return <Team onBack={back} />;
    case 'sales': return <Sales onBack={back} />;
    case 'messages': return <Messages onBack={back} />;
    case 'giftcards': return <GiftCards onBack={back} />;
    case 'settings': return <Settings onBack={back} />;
    case 'resources': return <ResourceTypes onBack={back} />;
    case 'plan': return <RevenuePlan onBack={back} />;
    case 'loyaltycards': return <Marketing onBack={back} initialView="loyalty" />;
    case 'texts': return <NotifTextsEditor onBack={back} />;
    case 'hours': return <HoursEditor onBack={back} />;
    default: {
      const k = ICONS[key] ? key : 'views';
      return (
        <Screen>
          <Header title={tr(`sections.${k}` as StringKey)} onBack={back} />
          <StateView icon={ICONS[k]} title={tr('soon.title')} body={tr('soon.body')} />
        </Screen>
      );
    }
  }
}

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenError';
