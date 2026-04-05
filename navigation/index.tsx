import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { PageProvider } from '../context/PageContext';

import WelcomeScreen from '../screens/WelcomeScreen';
import OTPVerifyScreen from '../screens/OTPVerifyScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TriggersScreen from '../screens/TriggersScreen';
import CreateTriggerScreen from '../screens/CreateTriggerScreen';
import ConversationsScreen from '../screens/ConversationsScreen';
import ConversationThreadScreen from '../screens/ConversationThreadScreen';
import PageSettingsScreen from '../screens/PageSettingsScreen';
import OrdersScreen from '../screens/OrdersScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import BroadcastScreen from '../screens/BroadcastScreen';
import ConnectPageScreen from '../screens/ConnectPageScreen';
import MoreScreen from '../screens/MoreScreen';

// ─── Param lists ────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Welcome: undefined;
  OTPVerify: { email: string };
  Main: undefined;
};

export type HomeStackParamList = {
  Dashboard: undefined;
  ConnectPage: undefined;
};

export type ChatsStackParamList = {
  Conversations: { pageId?: string; pageName?: string } | undefined;
  ConversationThread: { conversationId: string; customerName: string };
};

export type OrdersStackParamList = {
  Orders: { pageId?: string; pageName?: string } | undefined;
};

export type MoreStackParamList = {
  MoreHome: undefined;
  Triggers: { pageId: string; pageName: string };
  CreateTrigger: { pageId: string; triggerId?: string };
  Analytics: { pageId: string; pageName: string };
  Broadcast: { pageId: string; pageName: string };
  PageSettings: { pageId: string; pageName: string };
  ConnectPage: undefined;
};

export type TabParamList = {
  HomeTab: undefined;
  ChatsTab: undefined;
  OrdersTab: undefined;
  MoreTab: undefined;
};

// ─── Stack navigators ────────────────────────────────────────────────────────

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Dashboard" component={DashboardScreen} />
      <HomeStack.Screen name="ConnectPage" component={ConnectPageScreen} />
    </HomeStack.Navigator>
  );
}

const ChatsStack = createNativeStackNavigator<ChatsStackParamList>();
function ChatsNavigator() {
  return (
    <ChatsStack.Navigator screenOptions={{ headerShown: false }}>
      <ChatsStack.Screen name="Conversations" component={ConversationsScreen} />
      <ChatsStack.Screen name="ConversationThread" component={ConversationThreadScreen} />
    </ChatsStack.Navigator>
  );
}

const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();
function OrdersNavigator() {
  return (
    <OrdersStack.Navigator screenOptions={{ headerShown: false }}>
      <OrdersStack.Screen name="Orders" component={OrdersScreen} />
    </OrdersStack.Navigator>
  );
}

const MoreStack = createNativeStackNavigator<MoreStackParamList>();
function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="MoreHome" component={MoreScreen} />
      <MoreStack.Screen name="Triggers" component={TriggersScreen} />
      <MoreStack.Screen name="CreateTrigger" component={CreateTriggerScreen} />
      <MoreStack.Screen name="Analytics" component={AnalyticsScreen} />
      <MoreStack.Screen name="Broadcast" component={BroadcastScreen} />
      <MoreStack.Screen name="PageSettings" component={PageSettingsScreen} />
      <MoreStack.Screen name="ConnectPage" component={ConnectPageScreen} />
    </MoreStack.Navigator>
  );
}

// ─── Custom Tab Bar ──────────────────────────────────────────────────────────

const TAB_CONFIG: Record<string, { label: string; icon: string; activeIcon: string }> = {
  HomeTab:   { label: 'Home',   icon: 'home-outline',        activeIcon: 'home' },
  ChatsTab:  { label: 'Chats',  icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' },
  OrdersTab: { label: 'Orders', icon: 'bag-outline',         activeIcon: 'bag' },
  MoreTab:   { label: 'More',   icon: 'grid-outline',        activeIcon: 'grid' },
};

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    // Outer shell — matches screen background to create "floating" illusion
    <View style={{
      backgroundColor: '#F0F2F5',
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: Math.max(insets.bottom, 12),
    }}>
      {/* White floating card */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        paddingVertical: 6,
        paddingHorizontal: 6,
        shadowColor: '#0E1C40',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 12,
      }}>
        {state.routes.map((route: any, index: number) => {
          const focused = state.index === index;
          const cfg = TAB_CONFIG[route.name];
          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              activeOpacity={0.7}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              {focused ? (
                // Active: navy rounded rect with cyan icon + white label
                <View style={{
                  backgroundColor: '#0E1C40',
                  borderRadius: 22,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  alignItems: 'center',
                  gap: 3,
                  minWidth: 64,
                }}>
                  <Ionicons name={cfg.activeIcon as any} size={20} color="#00C5FF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.2 }}>
                    {cfg.label}
                  </Text>
                </View>
              ) : (
                // Inactive: just icon + label, muted gray
                <View style={{ alignItems: 'center', gap: 3, paddingVertical: 10 }}>
                  <Ionicons name={cfg.icon as any} size={20} color="#B0B3B8" />
                  <Text style={{ color: '#B0B3B8', fontSize: 10, fontWeight: '500' }}>
                    {cfg.label}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Tab navigator ───────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="HomeTab"   component={HomeNavigator} />
      <Tab.Screen name="ChatsTab"  component={ChatsNavigator} />
      <Tab.Screen name="OrdersTab" component={OrdersNavigator} />
      <Tab.Screen name="MoreTab"   component={MoreNavigator} />
    </Tab.Navigator>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

const RootStack = createNativeStackNavigator<RootStackParamList>();
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function Navigation() {
  const [initialRoute, setInitialRoute] = useState<'Welcome' | 'Main'>('Welcome');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setInitialRoute(session ? 'Main' : 'Welcome');
      setReady(true);
    });
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        conversationId?: string;
        customerName?: string;
      };
      if (data?.conversationId && navigationRef.isReady()) {
        // Navigate into ChatsTab → ConversationThread
        (navigationRef as any).navigate('Main', {
          screen: 'ChatsTab',
          params: {
            screen: 'ConversationThread',
            params: {
              conversationId: data.conversationId,
              customerName: data.customerName ?? 'Customer',
            },
          },
        });
      }
    });
    return () => sub.remove();
  }, []);

  if (!ready) return null;

  return (
    <PageProvider>
      <NavigationContainer ref={navigationRef}>
        <RootStack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Welcome" component={WelcomeScreen} />
          <RootStack.Screen name="OTPVerify" component={OTPVerifyScreen} />
          <RootStack.Screen name="Main" component={MainTabs} />
        </RootStack.Navigator>
      </NavigationContainer>
    </PageProvider>
  );
}
