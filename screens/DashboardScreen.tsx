import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image, RefreshControl, Switch, Alert, Modal, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { pagesApi, triggersApi } from '../lib/api';
import { registerForPushNotifications } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { useActivePage } from '../context/PageContext';
import type { TabParamList, HomeStackParamList } from '../navigation';

type DashboardNav = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'Dashboard'>,
  BottomTabNavigationProp<TabParamList>
>;

type Page = {
  id: string;
  page_name: string;
  facebook_page_id: string;
  is_active: boolean;
};

type PageStats = {
  messages_today: number;
  bot_handled_today: number;
  conversation_count: number;
  unread_count: number;
  orders_today: number;
  revenue_today: number;
};

export default function DashboardScreen() {
  const navigation = useNavigation<DashboardNav>();
  const { setActivePage } = useActivePage();
  const insets = useSafeAreaInsets();

  const [pages, setPages] = useState<Page[]>([]);
  const [triggerCounts, setTriggerCounts] = useState<Record<string, number>>({});
  const [pageStats, setPageStats] = useState<Record<string, PageStats>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [menuPage, setMenuPage] = useState<Page | null>(null);
  const [showLogout, setShowLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await pagesApi.getAll();
      setPages(data);

      if (data.length > 0) {
        setActivePage({ id: data[0].id, name: data[0].page_name });
      }

      const counts: Record<string, number> = {};
      const stats: Record<string, PageStats> = {};
      await Promise.all(
        data.map(async (page: Page) => {
          const [triggers, s] = await Promise.all([
            triggersApi.getAll(page.id),
            pagesApi.getStats(page.id),
          ]);
          counts[page.id] = triggers.length;
          stats[page.id] = s;
        })
      );
      setTriggerCounts(counts);
      setPageStats(stats);
    } catch {
      setError('Failed to load pages. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleToggle(page: Page) {
    setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, is_active: !p.is_active } : p));
    try {
      await pagesApi.toggleActive(page.id);
    } catch {
      setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, is_active: page.is_active } : p));
      Alert.alert('Error', 'Failed to update bot status. Please try again.');
    }
  }

  function handleDisconnect(page: Page) {
    Alert.alert(
      'Disconnect Page?',
      `Remove "${page.page_name}" from Reili? The bot will stop replying to its Messenger messages.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await pagesApi.disconnect(page.id);
              setPages((prev) => prev.filter((p) => p.id !== page.id));
            } catch {
              Alert.alert('Error', 'Failed to disconnect page. Please try again.');
            }
          },
        },
      ],
    );
  }

  function navigateToChats(page: Page) {
    setActivePage({ id: page.id, name: page.page_name });
    navigation.navigate('ChatsTab', {
      screen: 'Conversations',
      params: { pageId: page.id, pageName: page.page_name },
    } as any);
  }

  function navigateToOrders(page: Page) {
    setActivePage({ id: page.id, name: page.page_name });
    navigation.navigate('OrdersTab', {
      screen: 'Orders',
      params: { pageId: page.id, pageName: page.page_name },
    } as any);
  }

  function navigateToTriggers(page: Page) {
    setActivePage({ id: page.id, name: page.page_name });
    navigation.navigate('MoreTab', {
      screen: 'Triggers',
      params: { pageId: page.id, pageName: page.page_name },
    } as any);
  }

  function navigateToAnalytics(page: Page) {
    setActivePage({ id: page.id, name: page.page_name });
    navigation.navigate('MoreTab', {
      screen: 'Analytics',
      params: { pageId: page.id, pageName: page.page_name },
    } as any);
  }

  function navigateToSettings(page: Page) {
    setActivePage({ id: page.id, name: page.page_name });
    navigation.navigate('MoreTab', {
      screen: 'PageSettings',
      params: { pageId: page.id, pageName: page.page_name },
    } as any);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (pages.length === 0) return;
    registerForPushNotifications().then((token) => {
      if (!token) return;
      pages.forEach((page) => {
        pagesApi.savePushToken(page.id, token).catch(() => {});
      });
    });
  }, [pages]);

  const allStats = Object.values(pageStats);
  const totalMessages   = allStats.reduce((s, p) => s + p.messages_today, 0);
  const totalBotHandled = allStats.reduce((s, p) => s + p.bot_handled_today, 0);
  const totalOrders     = allStats.reduce((s, p) => s + (p.orders_today ?? 0), 0);
  const totalRevenue    = allStats.reduce((s, p) => s + (p.revenue_today ?? 0), 0);

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F6F6' }}>
      <StatusBar style="light" />

      {/* ── Header ── */}
      <View style={{
        backgroundColor: '#163172',
        paddingTop: insets.top + 14,
        paddingBottom: 18,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={require('../assets/reili.png')} style={{ width: 30, height: 30 }} resizeMode="contain" />
          <View>
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 }}>Reili</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '500' }}>Bot Dashboard</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setShowLogout(true)}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="person" size={17} color="#D6E4F0" />
        </TouchableOpacity>
      </View>

      {/* ── States ── */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#163172" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Ionicons name="cloud-offline" size={48} color="#CBD5E1" />
          <Text style={{ color: '#65676B', fontSize: 15, marginTop: 12, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity onPress={load} style={{ marginTop: 16, backgroundColor: '#163172', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 28 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#163172" />}
        >
          {/* ── Today's Activity card ── */}
          <View style={{
            backgroundColor: '#163172',
            marginHorizontal: 16,
            marginTop: 16,
            borderRadius: 22,
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 22,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                Today's Activity
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{today}</Text>
            </View>

            <View style={{ flexDirection: 'row' }}>
              <TodayStat icon="chatbubbles"  value={totalMessages}                    label="Messages"   accent="#D6E4F0" />
              <Divider />
              <TodayStat icon="flash"        value={totalBotHandled}                  label="Bot Replies" accent="#A78BFA" />
              <Divider />
              <TodayStat icon="bag"          value={totalOrders}                      label="Orders"     accent="#34D399" />
              <Divider />
              <TodayStat icon="cash"         value={`₱${totalRevenue.toLocaleString()}`} label="Revenue" accent="#FBB040" />
            </View>
          </View>

          {/* ── Connected Pages header ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 26, marginBottom: 12 }}>
            <Text style={{ color: '#65676B', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Connected Pages
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('ConnectPage')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#163172', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}
            >
              <Ionicons name="add" size={13} color="#D6E4F0" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Add Page</Text>
            </TouchableOpacity>
          </View>

          {/* ── Empty state ── */}
          {pages.length === 0 ? (
            <View style={{
              backgroundColor: '#fff',
              marginHorizontal: 16,
              borderRadius: 22,
              alignItems: 'center',
              paddingVertical: 48,
              paddingHorizontal: 32,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.07,
              shadowRadius: 8,
              elevation: 2,
            }}>
              <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: '#163172', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="logo-facebook" size={36} color="#D6E4F0" />
              </View>
              <Text style={{ color: '#1C1E21', fontWeight: '800', fontSize: 16 }}>No pages connected</Text>
              <Text style={{ color: '#65676B', fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
                Connect your Facebook Page to start automating Messenger replies.
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('ConnectPage')}
                style={{ marginTop: 20, backgroundColor: '#163172', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Ionicons name="add" size={16} color="#D6E4F0" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Connect a Page</Text>
              </TouchableOpacity>
            </View>
          ) : (
            pages.map((page) => {
              const stats  = pageStats[page.id];
              const unread = stats?.unread_count ?? 0;
              return (
                <View
                  key={page.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    marginHorizontal: 16,
                    marginBottom: 12,
                    borderRadius: 22,
                    shadowColor: '#163172',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.07,
                    shadowRadius: 10,
                    elevation: 3,
                    overflow: 'hidden',
                  }}
                >
                  {/* ── Card top: identity + toggle ── */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 }}>
                    <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: '#163172', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Ionicons name="logo-facebook" size={22} color="#D6E4F0" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#1C1E21', fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                        {page.page_name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: page.is_active ? '#ECFDF5' : '#F1F5F9',
                          borderRadius: 99,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}>
                          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: page.is_active ? '#10B981' : '#94A3B8' }} />
                          <Text style={{ color: page.is_active ? '#059669' : '#64748B', fontSize: 10, fontWeight: '600' }}>
                            {page.is_active ? 'Bot Active' : 'Bot Paused'}
                          </Text>
                        </View>
                        {unread > 0 && (
                          <View style={{ backgroundColor: '#D6E4F0', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3 }}>
                            <Text style={{ color: '#163172', fontSize: 10, fontWeight: '800' }}>{unread} new</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Switch
                      value={page.is_active}
                      onValueChange={() => handleToggle(page)}
                      trackColor={{ false: '#E4E6EB', true: '#D6E4F0' }}
                      thumbColor={page.is_active ? '#163172' : '#94A3B8'}
                    />
                  </View>

                  {/* ── Stats strip ── */}
                  <View style={{
                    flexDirection: 'row',
                    backgroundColor: '#F8F9FA',
                    marginHorizontal: 16,
                    borderRadius: 14,
                    paddingVertical: 12,
                    marginBottom: 14,
                  }}>
                    <CardStat value={triggerCounts[page.id] ?? 0} label="Triggers" />
                    <View style={{ width: 1, backgroundColor: '#E4E6EB' }} />
                    <CardStat value={stats?.conversation_count ?? 0} label="Chats" />
                    <View style={{ width: 1, backgroundColor: '#E4E6EB' }} />
                    <CardStat value={stats?.messages_today ?? 0} label="Today" />
                  </View>

                  {/* ── Action row ── */}
                  <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
                    <TouchableOpacity
                      onPress={() => navigateToChats(page)}
                      activeOpacity={0.8}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#163172', borderRadius: 12, paddingVertical: 11 }}
                    >
                      <Ionicons name="chatbubbles" size={14} color="#D6E4F0" />
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Chats</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => navigateToOrders(page)}
                      activeOpacity={0.8}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F6F6F6', borderRadius: 12, paddingVertical: 11 }}
                    >
                      <Ionicons name="bag-outline" size={14} color="#1C1E21" />
                      <Text style={{ color: '#1C1E21', fontSize: 12, fontWeight: '700' }}>Orders</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setMenuPage(page)}
                      activeOpacity={0.8}
                      style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F6F6', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 11 }}
                    >
                      <Ionicons name="ellipsis-horizontal" size={17} color="#65676B" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ── Logout modal ── */}
      <Modal visible={showLogout} transparent animationType="fade" onRequestClose={() => setShowLogout(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 }}
          onPress={() => !loggingOut && setShowLogout(false)}
        >
          <Pressable onPress={() => {}} style={{ width: '100%' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.25, shadowRadius: 40, elevation: 24 }}>
              <View style={{ backgroundColor: '#163172', alignItems: 'center', paddingTop: 32, paddingBottom: 24 }}>
                <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Ionicons name="log-out-outline" size={32} color="#D6E4F0" />
                </View>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>Log out?</Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 24 }}>
                  You'll need to sign in again{'\n'}to access your bots.
                </Text>
              </View>
              <View style={{ padding: 20, gap: 10 }}>
                <TouchableOpacity
                  onPress={async () => {
                    setLoggingOut(true);
                    await supabase.auth.signOut();
                    setActivePage(null);
                    setLoggingOut(false);
                    setShowLogout(false);
                  }}
                  disabled={loggingOut}
                  activeOpacity={0.85}
                  style={{ backgroundColor: '#EF4444', borderRadius: 16, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                >
                  {loggingOut
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <><Ionicons name="log-out-outline" size={18} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Log Out</Text></>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowLogout(false)}
                  disabled={loggingOut}
                  activeOpacity={0.7}
                  style={{ backgroundColor: '#F6F6F6', borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}
                >
                  <Text style={{ color: '#1C1E21', fontWeight: '700', fontSize: 15 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Page actions bottom sheet ── */}
      <Modal visible={menuPage !== null} transparent animationType="slide" onRequestClose={() => setMenuPage(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setMenuPage(null)} />
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 20) + 4, paddingTop: 8 }}>
          <View style={{ width: 40, height: 4, backgroundColor: '#E4E6EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F6F6F6' }}>
            <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: '#163172', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="logo-facebook" size={22} color="#D6E4F0" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#1C1E21', fontWeight: '700', fontSize: 16 }} numberOfLines={1}>{menuPage?.page_name}</Text>
              <Text style={{ color: '#65676B', fontSize: 12, marginTop: 1 }}>Facebook Page</Text>
            </View>
          </View>
          <SheetRow icon="flash-outline"     label="Triggers"     onPress={() => { setMenuPage(null); navigateToTriggers(menuPage!); }} />
          <SheetRow icon="bar-chart-outline" label="Analytics"    onPress={() => { setMenuPage(null); navigateToAnalytics(menuPage!); }} />
          <SheetRow icon="settings-outline"  label="Bot Settings" onPress={() => { setMenuPage(null); navigateToSettings(menuPage!); }} />
          <View style={{ height: 1, backgroundColor: '#F6F6F6', marginVertical: 8 }} />
          <SheetRow icon="trash-outline" label="Disconnect Page" danger onPress={() => { setMenuPage(null); handleDisconnect(menuPage!); }} />
          <TouchableOpacity
            style={{ marginTop: 12, backgroundColor: '#F6F6F6', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
            onPress={() => setMenuPage(null)}
            activeOpacity={0.7}
          >
            <Text style={{ color: '#1C1E21', fontWeight: '700', fontSize: 15 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

function TodayStat({ icon, value, label, accent }: { icon: any; value: string | number; label: string; accent: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${accent}22`, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <Ionicons name={icon} size={16} color={accent} />
      </View>
      <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '500', marginTop: 3, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function Divider() {
  return <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 2 }} />;
}

function CardStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: '#1C1E21', fontSize: 17, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '500', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function SheetRow({ icon, label, onPress, danger }: { icon: any; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, gap: 14 }}>
      <View style={{ width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? '#FEF2F2' : '#F6F6F6' }}>
        <Ionicons name={icon} size={18} color={danger ? '#EF4444' : '#1C1E21'} />
      </View>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: danger ? '#EF4444' : '#1C1E21' }}>{label}</Text>
      {!danger && <Ionicons name="chevron-forward" size={16} color="#C4C4C4" />}
    </TouchableOpacity>
  );
}
