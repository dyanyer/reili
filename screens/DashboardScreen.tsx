import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  RefreshControl,
  Switch,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
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

// ── Brand palette ──────────────────────────────────────────────────────────────
const C = {
  bg:       '#F6F6F6',
  white:    '#FFFFFF',
  light:    '#D6E4F0',
  blue:     '#1E56A0',
  navy:     '#163172',
  navyFade: 'rgba(22,49,114,0.08)',
  navyMid:  'rgba(22,49,114,0.18)',
  text:     '#163172',
  text2:    '#1E56A0',
  text3:    'rgba(22,49,114,0.40)',
  border:   'rgba(22,49,114,0.10)',
  green:    '#16A34A',
  greenBg:  'rgba(22,163,74,0.10)',
  red:      '#DC2626',
  redBg:    'rgba(220,38,38,0.09)',
};

type DashboardNav = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'Dashboard'>,
  BottomTabNavigationProp<TabParamList>
>;
type Page = { id: string; page_name: string; facebook_page_id: string; is_active: boolean };
type PageStats = {
  messages_today: number;
  bot_handled_today: number;
  conversation_count: number;
  unread_count: number;
  orders_today: number;
  revenue_today: number;
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function DashboardScreen() {
  const navigation = useNavigation<DashboardNav>();
  const { setActivePage } = useActivePage();
  const insets = useSafeAreaInsets();

  const [pages, setPages]                   = useState<Page[]>([]);
  const [triggerCounts, setTriggerCounts]   = useState<Record<string, number>>({});
  const [pageStats, setPageStats]           = useState<Record<string, PageStats>>({});
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [error, setError]                   = useState('');
  const [menuPage, setMenuPage]             = useState<Page | null>(null);
  const [showLogout, setShowLogout]         = useState(false);
  const [loggingOut, setLoggingOut]         = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await pagesApi.getAll();
      setPages(data);
      if (data.length > 0) setActivePage({ id: data[0].id, name: data[0].page_name });
      const counts: Record<string, number> = {};
      const stats: Record<string, PageStats> = {};
      await Promise.all(data.map(async (page: Page) => {
        const [triggers, s] = await Promise.all([triggersApi.getAll(page.id), pagesApi.getStats(page.id)]);
        counts[page.id] = triggers.length;
        stats[page.id]  = s;
      }));
      setTriggerCounts(counts);
      setPageStats(stats);
    } catch {
      setError('Failed to load pages. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  async function handleToggle(page: Page) {
    setPages((p) => p.map((x) => x.id === page.id ? { ...x, is_active: !x.is_active } : x));
    try { await pagesApi.toggleActive(page.id); }
    catch {
      setPages((p) => p.map((x) => x.id === page.id ? { ...x, is_active: page.is_active } : x));
      Alert.alert('Error', 'Failed to update bot status.');
    }
  }

  function handleDisconnect(page: Page) {
    Alert.alert('Disconnect Page?', `Remove "${page.page_name}" from Reili? The bot will stop replying.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: async () => {
        try { await pagesApi.disconnect(page.id); setPages((p) => p.filter((x) => x.id !== page.id)); }
        catch { Alert.alert('Error', 'Failed to disconnect page.'); }
      }},
    ]);
  }

  function goChats(p: Page)    { setActivePage({ id: p.id, name: p.page_name }); navigation.navigate('ChatsTab', { screen: 'Conversations', params: { pageId: p.id, pageName: p.page_name } } as any); }
  function goOrders(p: Page)   { setActivePage({ id: p.id, name: p.page_name }); navigation.navigate('OrdersTab', { screen: 'Orders', params: { pageId: p.id, pageName: p.page_name } } as any); }
  function goTriggers(p: Page) { setActivePage({ id: p.id, name: p.page_name }); navigation.navigate('MoreTab', { screen: 'Triggers', params: { pageId: p.id, pageName: p.page_name } } as any); }
  function goAnalytics(p: Page){ setActivePage({ id: p.id, name: p.page_name }); navigation.navigate('MoreTab', { screen: 'Analytics', params: { pageId: p.id, pageName: p.page_name } } as any); }
  function goSettings(p: Page) { setActivePage({ id: p.id, name: p.page_name }); navigation.navigate('MoreTab', { screen: 'PageSettings', params: { pageId: p.id, pageName: p.page_name } } as any); }

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    if (!pages.length) return;
    registerForPushNotifications().then((token) => {
      if (!token) return;
      pages.forEach((p) => pagesApi.savePushToken(p.id, token).catch(() => {}));
    });
  }, [pages]);

  const activeCount = pages.filter((p) => p.is_active).length;
  const now         = new Date();
  const hour        = now.getHours();
  const greeting    = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateLabel   = `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View style={{
        paddingTop: insets.top + 14,
        paddingBottom: 18,
        paddingHorizontal: 20,
        backgroundColor: C.white,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
      }}>
        {/* Top row: logo + date + profile */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.light, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={require('../assets/reili.png')} style={{ width: 20, height: 20 }} resizeMode="contain" />
            </View>
            <Text style={{ color: C.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 }}>Reili</Text>
          </View>
          <Text style={{ color: C.text3, fontSize: 12, marginRight: 10 }}>{dateLabel}</Text>
          <TouchableOpacity
            onPress={() => setShowLogout(true)}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.navyFade, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="person-outline" size={15} color={C.navy} />
          </TouchableOpacity>
        </View>

        {/* Greeting + status row */}
        <Text style={{ color: C.text3, fontSize: 13, marginBottom: 4 }}>{greeting} 👋</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>Your Pages</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {activeCount > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.greenBg, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(22,163,74,0.20)' }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.green }} />
                <Text style={{ color: C.green, fontSize: 11, fontWeight: '700' }}>{activeCount} active</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => navigation.navigate('ConnectPage')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.light, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: C.border }}
            >
              <Ionicons name="add" size={14} color={C.navy} />
              <Text style={{ color: C.navy, fontSize: 12, fontWeight: '700' }}>Add Page</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── States ── */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={C.blue} />
          <Text style={{ color: C.text3, fontSize: 13 }}>Loading your pages...</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 }}>
          <View style={{ width: 68, height: 68, borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="cloud-offline-outline" size={32} color={C.text3} />
          </View>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>Connection failed</Text>
          <Text style={{ color: C.text2, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>{error}</Text>
          <TouchableOpacity
            onPress={load}
            style={{ backgroundColor: C.navy, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 }}
          >
            <Ionicons name="refresh-outline" size={15} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}
        >
          {/* ── Empty state ── */}
          {pages.length === 0 ? (
            <View style={{ backgroundColor: C.white, borderRadius: 26, alignItems: 'center', paddingVertical: 56, paddingHorizontal: 32, borderWidth: 1, borderColor: C.border, marginTop: 8 }}>
              <View style={{ width: 80, height: 80, borderRadius: 26, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center', marginBottom: 18, borderWidth: 1, borderColor: C.border }}>
                <Ionicons name="logo-facebook" size={40} color={C.blue} />
              </View>
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 18, letterSpacing: -0.4 }}>No pages yet</Text>
              <Text style={{ color: C.text2, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
                Connect your Facebook Page to start automating Messenger replies instantly.
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('ConnectPage')}
                style={{ marginTop: 24, backgroundColor: C.navy, borderRadius: 16, paddingHorizontal: 28, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Ionicons name="add-circle-outline" size={17} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Connect a Page</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {pages.map((page) => {
                const s      = pageStats[page.id];
                const unread = s?.unread_count ?? 0;
                const trigs  = triggerCounts[page.id] ?? 0;
                const convos = s?.conversation_count ?? 0;
                const msgs   = s?.messages_today ?? 0;

                return (
                  <View
                    key={page.id}
                    style={{ backgroundColor: C.white, borderRadius: 24, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}
                  >
                    {/* Top accent line */}
                    <View style={{ height: 3, backgroundColor: page.is_active ? C.blue : C.light }} />

                    <View style={{ padding: 16 }}>
                      {/* ── Identity row ── */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: C.border }}>
                          <Ionicons name="logo-facebook" size={24} color={C.blue} />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.text, fontWeight: '800', fontSize: 15, letterSpacing: -0.3 }} numberOfLines={1}>
                            {page.page_name}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: page.is_active ? C.greenBg : C.navyFade, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: page.is_active ? 'rgba(22,163,74,0.20)' : C.border }}>
                              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: page.is_active ? C.green : C.text3 }} />
                              <Text style={{ color: page.is_active ? C.green : C.text3, fontSize: 10, fontWeight: '700' }}>
                                {page.is_active ? 'Bot Active' : 'Bot Paused'}
                              </Text>
                            </View>
                            {unread > 0 && (
                              <View style={{ backgroundColor: C.light, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.border }}>
                                <Text style={{ color: C.navy, fontSize: 10, fontWeight: '800' }}>{unread} unread</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        <Switch
                          value={page.is_active}
                          onValueChange={() => handleToggle(page)}
                          trackColor={{ false: C.light, true: C.blue }}
                          thumbColor={C.white}
                        />
                      </View>

                      {/* ── Stats row ── */}
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                        <StatPill icon="flash-outline"       value={trigs}  label="Triggers" color={C.navy} />
                        <StatPill icon="chatbubbles-outline" value={convos} label="Chats"    color={C.blue} />
                        <StatPill icon="trending-up-outline" value={msgs}   label="Today"    color={C.green} />
                      </View>

                      {/* ── Actions ── */}
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => goChats(page)}
                          activeOpacity={0.75}
                          style={{ flex: 2, backgroundColor: C.navy, borderRadius: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                        >
                          <Ionicons name="chatbubbles" size={15} color="#fff" />
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Chats</Text>
                          {unread > 0 && (
                            <View style={{ backgroundColor: C.white, borderRadius: 99, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                              <Text style={{ color: C.navy, fontSize: 9, fontWeight: '800' }}>{unread}</Text>
                            </View>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => goOrders(page)}
                          activeOpacity={0.75}
                          style={{ flex: 2, backgroundColor: C.light, borderRadius: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                        >
                          <Ionicons name="bag-handle-outline" size={15} color={C.navy} />
                          <Text style={{ color: C.navy, fontSize: 13, fontWeight: '700' }}>Orders</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => setMenuPage(page)}
                          activeOpacity={0.75}
                          style={{ flex: 1, backgroundColor: C.navyFade, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Ionicons name="ellipsis-horizontal" size={18} color={C.navy} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}

              {/* Ghost add card */}
              <TouchableOpacity
                onPress={() => navigation.navigate('ConnectPage')}
                activeOpacity={0.7}
                style={{ borderRadius: 20, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', paddingVertical: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="add" size={16} color={C.navy} />
                </View>
                <Text style={{ color: C.text3, fontSize: 13, fontWeight: '600' }}>Connect another page</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Logout modal ── */}
      <Modal visible={showLogout} transparent animationType="fade" onRequestClose={() => setShowLogout(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(22,49,114,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 }}
          onPress={() => !loggingOut && setShowLogout(false)}
        >
          <Pressable onPress={() => {}} style={{ width: '100%' }}>
            <View style={{ backgroundColor: C.white, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
              <View style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.redBg, borderWidth: 1, borderColor: 'rgba(220,38,38,0.20)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Ionicons name="log-out-outline" size={28} color={C.red} />
                </View>
                <Text style={{ color: C.text, fontSize: 20, fontWeight: '800' }}>Log out?</Text>
                <Text style={{ color: C.text2, fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 24 }}>
                  You'll need to sign in again{'\n'}to access your bots.
                </Text>
              </View>
              <View style={{ padding: 20, gap: 10 }}>
                <TouchableOpacity
                  onPress={async () => { setLoggingOut(true); await supabase.auth.signOut(); setActivePage(null); setLoggingOut(false); setShowLogout(false); }}
                  disabled={loggingOut}
                  activeOpacity={0.85}
                  style={{ backgroundColor: C.redBg, borderWidth: 1, borderColor: 'rgba(220,38,38,0.25)', borderRadius: 16, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                >
                  {loggingOut
                    ? <ActivityIndicator size="small" color={C.red} />
                    : <><Ionicons name="log-out-outline" size={17} color={C.red} /><Text style={{ color: C.red, fontWeight: '800', fontSize: 15 }}>Log Out</Text></>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowLogout(false)}
                  disabled={loggingOut}
                  activeOpacity={0.7}
                  style={{ backgroundColor: C.light, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}
                >
                  <Text style={{ color: C.navy, fontWeight: '700', fontSize: 15 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Page actions bottom sheet ── */}
      <Modal visible={menuPage !== null} transparent animationType="slide" onRequestClose={() => setMenuPage(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(22,49,114,0.5)' }} onPress={() => setMenuPage(null)} />
        <View style={{ backgroundColor: C.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 20) + 4, paddingTop: 10, borderTopWidth: 1, borderColor: C.border }}>
          <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 22 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: C.light, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="logo-facebook" size={22} color={C.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>{menuPage?.page_name}</Text>
              <Text style={{ color: C.text3, fontSize: 12, marginTop: 2 }}>Facebook Page</Text>
            </View>
          </View>

          <SheetRow icon="flash-outline"     iconColor={C.navy}  iconBg={C.navyFade}  label="Triggers"     onPress={() => { setMenuPage(null); goTriggers(menuPage!); }} />
          <SheetRow icon="bar-chart-outline" iconColor={C.green} iconBg={C.greenBg}   label="Analytics"    onPress={() => { setMenuPage(null); goAnalytics(menuPage!); }} />
          <SheetRow icon="settings-outline"  iconColor={C.blue}  iconBg={C.navyFade}  label="Bot Settings" onPress={() => { setMenuPage(null); goSettings(menuPage!); }} />
          <View style={{ height: 1, backgroundColor: C.border, marginVertical: 8 }} />
          <SheetRow icon="trash-outline" iconColor={C.red} iconBg={C.redBg} label="Disconnect Page" danger onPress={() => { setMenuPage(null); handleDisconnect(menuPage!); }} />

          <TouchableOpacity
            onPress={() => setMenuPage(null)}
            activeOpacity={0.7}
            style={{ marginTop: 12, backgroundColor: C.light, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}
          >
            <Text style={{ color: C.navy, fontWeight: '700', fontSize: 15 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatPill({ icon, value, label, color }: { icon: any; value: number; label: string; color: string }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.navyFade, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: C.border }}>
      <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={12} color={color} />
      </View>
      <View>
        <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', letterSpacing: -0.3 }}>{value}</Text>
        <Text style={{ color: C.text3, fontSize: 9, fontWeight: '600' }}>{label}</Text>
      </View>
    </View>
  );
}

function SheetRow({ icon, iconColor, iconBg, label, onPress, danger }: { icon: any; iconColor: string; iconBg: string; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 4, gap: 13 }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: iconBg, borderWidth: 1, borderColor: `${iconColor}30` }}>
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: danger ? C.red : C.text }}>{label}</Text>
      {!danger && <Ionicons name="chevron-forward" size={15} color={C.text3} />}
    </TouchableOpacity>
  );
}
