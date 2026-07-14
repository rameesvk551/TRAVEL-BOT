// FILE: mobile/src/navigation/AppNavigator.tsx
import React, { useMemo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Menu } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useManifest } from '../hooks/useManifest';
import { buildTabs } from './buildTabs';
import { MODULES } from './registry';
import { resolveLabel } from './useLabel';
import { PlaceholderStack } from './PlaceholderStack';
import { ModuleHub } from './ModuleHub';
import ComponentGallery from '../screens/ComponentGallery';

import { HomeScreen } from '../features/home/screens/HomeScreen';
import { InboxScreen } from '../features/inbox/screens/InboxScreen';
import { ThreadScreen } from '../features/inbox/screens/ThreadScreen';
import { LeadsScreen } from '../features/leads/screens/LeadsScreen';
import { FollowUpsScreen } from '../features/leads/screens/FollowUpsScreen';
import { BookingsScreen } from '../features/bookings/screens/BookingsScreen';
import { BookingFormScreen } from '../features/bookings/screens/BookingFormScreen';
import { PaymentsScreen } from '../features/payments/screens/PaymentsScreen';
import { CustomersScreen } from '../features/customers/screens/CustomersScreen';
import { CustomerDetailScreen } from '../features/customers/screens/CustomerDetailScreen';
import { PackagesScreen } from '../features/packages/screens/PackagesScreen';
import { PackageFormScreen } from '../features/packages/screens/PackageFormScreen';
import { PackageFinanceScreen } from '../features/packages/screens/PackageFinanceScreen';
import { CruisesScreen } from '../features/cruises/screens/CruisesScreen';
import { CruiseFormScreen } from '../features/cruises/screens/CruiseFormScreen';
import { VisasScreen } from '../features/visas/screens/VisasScreen';
import { VisaFormScreen } from '../features/visas/screens/VisaFormScreen';
import { ServicesScreen } from '../features/services/screens/ServicesScreen';
import { ServiceFormScreen } from '../features/services/screens/ServiceFormScreen';
import { PropertiesScreen } from '../features/properties/screens/PropertiesScreen';
import { PropertyFormScreen } from '../features/properties/screens/PropertyFormScreen';
import { PropertyDetailsScreen } from '../features/properties/screens/PropertyDetailsScreen';
import { QuotationsScreen } from '../features/quotations/screens/QuotationsScreen';
import { QuotationFormScreen } from '../features/quotations/screens/QuotationFormScreen';
import { ItinerariesScreen } from '../features/itineraries/screens/ItinerariesScreen';
import { ItineraryBuilderScreen } from '../features/itineraries/screens/ItineraryBuilderScreen';
import { CampaignsScreen } from '../features/campaigns/screens/CampaignsScreen';
import { CampaignDetailScreen } from '../features/campaigns/screens/CampaignDetailScreen';
import { CampaignFormScreen } from '../features/campaigns/screens/CampaignFormScreen';
import { TemplatesScreen } from '../features/templates/screens/TemplatesScreen';
import { TemplateFormScreen } from '../features/templates/screens/TemplateFormScreen';
import { ReviewsScreen } from '../features/reviews/screens/ReviewsScreen';
import { ReviewDetailScreen } from '../features/reviews/screens/ReviewDetailScreen';
import { SocialScreen } from '../features/social/screens/SocialScreen';
import { AdsScreen } from '../features/ads/screens/AdsScreen';
import { ReferralsScreen } from '../features/referrals/screens/ReferralsScreen';
import { AutomationsScreen } from '../features/automations/screens/AutomationsScreen';
import { FlowBuilderScreen } from '../features/automations/screens/FlowBuilderScreen';
import { AccountingScreen } from '../features/accounting/screens/AccountingScreen';
import { InvoicesScreen } from '../features/accounting/screens/InvoicesScreen';
import { VendorsScreen } from '../features/vendors/screens/VendorsScreen';
import { VendorPaymentsScreen } from '../features/vendors/screens/VendorPaymentsScreen';
import { AnalyticsScreen } from '../features/insights/screens/AnalyticsScreen';
import { CRMReportScreen } from '../features/insights/screens/CRMReportScreen';
import { CallingReportScreen } from '../features/insights/screens/CallingReportScreen';
import { HRMScreen } from '../features/hrm/screens/HRMScreen';
import { AgentsScreen } from '../features/agents/screens/AgentsScreen';
import { AgentFormScreen } from '../features/agents/screens/AgentFormScreen';
import { SettingsScreen } from '../features/settings/screens/SettingsScreen';
import { BusinessProfileScreen } from '../features/settings/screens/BusinessProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function createModuleStack(moduleKey: string) {
  return function StackNav() {
    const { theme } = useTheme();
    const defaultScreenOptions = {
      headerStyle: { backgroundColor: theme.colors.bg.surface },
      headerTintColor: theme.colors.text.primary,
      headerShadowVisible: false,
    };

    if (moduleKey === 'home') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={HomeScreen} />
        </Stack.Navigator>
      );
    }
    
    if (moduleKey === 'inbox') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Inbox" component={InboxScreen} />
          <Stack.Screen name="Thread" component={ThreadScreen} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'leads') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Leads" component={LeadsScreen} />
          <Stack.Screen name="FollowUps" component={FollowUpsScreen} />
          <Stack.Screen name="Customers" component={CustomersScreen} />
          <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'bookings') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Bookings" component={BookingsScreen} />
          <Stack.Screen name="BookingForm" component={BookingFormScreen} options={{ presentation: 'modal' }} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'payments') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Payments" component={PaymentsScreen} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'packages') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Packages" component={PackagesScreen} />
          <Stack.Screen name="PackageForm" component={PackageFormScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="PackageFinance" component={PackageFinanceScreen} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'cruises') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Cruises" component={CruisesScreen} />
          <Stack.Screen name="CruiseForm" component={CruiseFormScreen} options={{ presentation: 'modal' }} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'visas') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Visas" component={VisasScreen} />
          <Stack.Screen name="VisaForm" component={VisaFormScreen} options={{ presentation: 'modal' }} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'services') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Services" component={ServicesScreen} />
          <Stack.Screen name="ServiceForm" component={ServiceFormScreen} options={{ presentation: 'modal' }} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'properties') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Properties" component={PropertiesScreen} />
          <Stack.Screen name="PropertyForm" component={PropertyFormScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="PropertyDetails" component={PropertyDetailsScreen} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'quotations') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Quotations" component={QuotationsScreen} />
          <Stack.Screen name="QuotationForm" component={QuotationFormScreen} options={{ presentation: 'modal' }} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'itineraries') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Itineraries" component={ItinerariesScreen} />
          <Stack.Screen name="ItineraryBuilder" component={ItineraryBuilderScreen} options={{ presentation: 'modal' }} />
        </Stack.Navigator>
      );
    }
    if (moduleKey === 'campaigns') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Campaigns" component={CampaignsScreen} />
          <Stack.Screen name="CampaignDetail" component={CampaignDetailScreen} />
          <Stack.Screen name="CampaignForm" component={CampaignFormScreen} options={{ presentation: 'modal' }} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'templates') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Templates" component={TemplatesScreen} />
          <Stack.Screen name="TemplateForm" component={TemplateFormScreen} options={{ presentation: 'modal' }} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'reviews') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Reviews" component={ReviewsScreen} />
          <Stack.Screen name="ReviewDetail" component={ReviewDetailScreen} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'social') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Social" component={SocialScreen} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'ads') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Ads" component={AdsScreen} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'referrals') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Referrals" component={ReferralsScreen} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'automations') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Automations" component={AutomationsScreen} />
          <Stack.Screen name="FlowBuilder" component={FlowBuilderScreen} options={{ presentation: 'modal' }} />
        </Stack.Navigator>
      );
    }
    if (moduleKey === 'accounting') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Accounting" component={AccountingScreen} />
          <Stack.Screen name="Invoices" component={InvoicesScreen} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'vendors') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Vendors" component={VendorsScreen} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'vendorPayments') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="VendorPayments" component={VendorPaymentsScreen} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'analytics') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Analytics" component={AnalyticsScreen} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'crmReport') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="CRMReport" component={CRMReportScreen} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'callingReport') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="CallingReport" component={CallingReportScreen} />
        </Stack.Navigator>
      );
    }
    if (moduleKey === 'hrm') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="HRM" component={HRMScreen} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'agents') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Agents" component={AgentsScreen} />
          <Stack.Screen name="AgentForm" component={AgentFormScreen} options={{ presentation: 'modal' }} />
        </Stack.Navigator>
      );
    }

    if (moduleKey === 'settings') {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="BusinessProfile" component={BusinessProfileScreen} />
        </Stack.Navigator>
      );
    }

    return (
      <Stack.Navigator screenOptions={defaultScreenOptions}>
        <Stack.Screen 
          name={`${moduleKey}_Root`} 
          component={PlaceholderStack} 
          initialParams={{ moduleName: moduleKey }}
          options={{ title: moduleKey }}
        />
      </Stack.Navigator>
    );
  }
}

export function AppNavigator() {
  const { theme, themeMode } = useTheme();
  const { manifest } = useManifest();

  // Determine which tabs to render based on manifest
  const tabKeys = useMemo(() => {
    if (!manifest) return ['home', 'more']; // Fallback while loading
    return buildTabs(manifest);
  }, [manifest]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.text.secondary,
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border.hairline,
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : theme.colors.bg.surface,
          elevation: 0,
        },
        tabBarBackground: () => 
          Platform.OS === 'ios' ? (
            <BlurView 
              tint={theme.dark ? 'dark' : 'light'} 
              intensity={80} 
              style={StyleSheet.absoluteFill} 
            />
          ) : null,
      })}
    >
      {tabKeys.map((key) => {
        const isMore = key === 'more';
        const isHome = key === 'home';
        
        let icon: any;
        let label: string;
        let Component: any;

        if (isMore) {
          icon = Menu;
          label = 'More';
          Component = ModuleHub;
        } else if (isHome) {
          icon = MODULES.home.icon;
          label = resolveLabel('home', manifest?.labels);
          Component = createModuleStack('home');
        } else {
          const mod = MODULES[key];
          if (!mod) return null; // Safe guard
          icon = mod.icon;
          label = resolveLabel(key, manifest?.labels);
          Component = createModuleStack(key);
        }

        return (
          <Tab.Screen
            key={key}
            name={key}
            component={Component}
            options={{
              title: label,
              tabBarIcon: ({ color, size }) => {
                const Icon = icon;
                return <Icon color={color} size={28} />;
              },
            }}
          />
        );
      })}
      
      {/* Component gallery — a design-system reference, not a product surface.
          Kept out of release builds so it can't be reached by a real user. */}
      {__DEV__ && (
        <Tab.Screen
          name="Gallery"
          component={ComponentGallery}
          options={{ tabBarButton: () => null }}
        />
      )}
    </Tab.Navigator>
  );
}
