import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { OrdersStackParamList } from '../navigation';
import { ordersApi } from '../lib/api';
import { useActivePage } from '../context/PageContext';
import PageSwitcherPill from '../components/PageSwitcherPill';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

type Props = NativeStackScreenProps<OrdersStackParamList, 'Orders'>;

type Order = {
  id: string;
  conversation_id: string;
  customer_facebook_id: string;
  conversations?: { customer_name: string | null } | null;
  item: string;
  quantity: string;
  address: string;
  status: string;
  created_at: string;
  order_number?: string | null;
  total_price?: number | null;
};

const STATUSES = ['All', 'Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];

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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:   { label: 'Pending',   color: '#D97706',  bg: 'rgba(217,119,6,0.10)',    icon: 'time-outline' },
  confirmed: { label: 'Confirmed', color: C.blue,     bg: C.light,                   icon: 'checkmark-circle-outline' },
  packed:    { label: 'Packed',    color: '#7C3AED',  bg: 'rgba(124,58,237,0.10)',   icon: 'cube-outline' },
  shipped:   { label: 'Shipped',   color: C.blue,     bg: C.light,                   icon: 'bicycle-outline' },
  delivered: { label: 'Delivered', color: C.green,    bg: C.greenBg,                 icon: 'checkmark-done-circle-outline' },
  cancelled: { label: 'Cancelled', color: C.red,      bg: C.redBg,                   icon: 'close-circle-outline' },
};

const NEXT_STATUSES: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'], confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [],
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function OrdersScreen({ route }: Props) {
  const { activePage } = useActivePage();
  const rootNav = useNavigation<any>();

  function openConversation(conversationId: string, customerName: string) {
    rootNav.navigate('ChatsTab', { screen: 'ConversationThread', params: { conversationId, customerName } });
  }

  const [pageId, setPageId] = useState(route.params?.pageId ?? activePage?.id ?? '');
  const [pageName, setPageName] = useState(route.params?.pageName ?? activePage?.name ?? '');

  useEffect(() => {
    if (activePage && activePage.id !== pageId) { setPageId(activePage.id); setPageName(activePage.name); }
  }, [activePage]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');

  const loadOrders = useCallback(async () => {
    if (!pageId) { setLoading(false); return; }
    try { setError(''); const data = await ordersApi.getAll(pageId); setOrders(data); }
    catch { setError('Failed to load orders'); }
    finally { setLoading(false); }
  }, [pageId]);

  async function onRefresh() { setRefreshing(true); await loadOrders(); setRefreshing(false); }
  useEffect(() => { loadOrders(); }, [loadOrders]);

  const filtered = orders.filter((o) => activeFilter === 'All' ? true : o.status === activeFilter.toLowerCase());

  function handleUpdateStatus(order: Order) {
    const next = NEXT_STATUSES[order.status] ?? [];
    if (next.length === 0) return;
    const doUpdate = async (s: string) => {
      try {
        const updated = await ordersApi.updateStatus(order.id, s);
        setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: updated.status } : o)));
      } catch { Alert.alert('Error', 'Failed to update order status'); }
    };
    const options = next.map((s) => ({
      text: STATUS_CONFIG[s]?.label ?? s,
      style: s === 'cancelled' ? ('destructive' as const) : ('default' as const),
      onPress: () => {
        if (s === 'cancelled') {
          Alert.alert('Cancel Order?', `Are you sure you want to cancel "${order.item} × ${order.quantity}"?`, [
            { text: 'No', style: 'cancel' },
            { text: 'Yes, Cancel', style: 'destructive', onPress: () => doUpdate(s) },
          ]);
        } else { doUpdate(s); }
      },
    }));
    Alert.alert('Update Status', `${order.item} × ${order.quantity}`, [...options, { text: 'Cancel', style: 'cancel' as const }]);
  }

  async function handleSavePrice(orderId: string) {
    const val = priceInput.trim();
    const parsed = val === '' ? null : parseFloat(val);
    if (val !== '' && (isNaN(parsed!) || parsed! < 0)) { Alert.alert('Invalid', 'Enter a valid price (e.g. 250)'); return; }
    try {
      const updated = await ordersApi.updatePrice(orderId, parsed);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, total_price: updated.total_price } : o)));
      setEditingPriceId(null); setPriceInput('');
    } catch { Alert.alert('Error', 'Failed to update price'); }
  }

  async function exportCSV() {
    if (orders.length === 0) { Alert.alert('No orders', 'There are no orders to export yet.'); return; }
    const escape = (val: string) => `"${(val ?? '').replace(/"/g, '""')}"`;
    const header = ['Order ID', 'Customer', 'Item', 'Qty', 'Address', 'Status', 'Price', 'Date'];
    const rows = orders.map((o) => [
      escape(o.order_number ?? o.id),
      escape(o.conversations?.customer_name ?? `···${o.customer_facebook_id.slice(-4)}`),
      escape(o.item), escape(o.quantity), escape(o.address), escape(o.status),
      escape(o.total_price != null ? `₱${o.total_price}` : ''),
      escape(new Date(o.created_at).toLocaleString()),
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const fileUri = FileSystem.cacheDirectory + `orders_${Date.now()}.csv`;
    try {
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Orders' });
    } catch { Alert.alert('Export failed', 'Could not export orders.'); }
  }

  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  if (!pageId) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar style="light" />
        <View style={{ backgroundColor: C.navy, paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>Orders</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: C.light, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="bag-outline" size={36} color={C.blue} />
          </View>
          <Text style={{ color: C.text, fontWeight: '800', fontSize: 16, letterSpacing: -0.3 }}>No page selected</Text>
          <Text style={{ color: C.text3, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
            Go to Home and tap a page to view its orders.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />

      {/* Header — navy */}
      <View style={{ backgroundColor: C.navy, paddingTop: 56, paddingBottom: 14, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <View style={{ flex: 1, marginRight: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>Orders</Text>
            {pendingCount > 0 && (
              <View style={{ backgroundColor: 'rgba(217,119,6,0.25)', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(217,119,6,0.40)' }}>
                <Text style={{ color: '#FDBA74', fontSize: 11, fontWeight: '800' }}>{pendingCount} pending</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <PageSwitcherPill
              currentPageId={pageId}
              currentPageName={pageName}
              onSwitch={(id, name) => { setPageId(id); setPageName(name); }}
            />
            <TouchableOpacity onPress={exportCSV} activeOpacity={0.75} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="download-outline" size={17} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
          {STATUSES.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setActiveFilter(f)}
              activeOpacity={0.8}
              style={{ paddingHorizontal: 13, paddingVertical: 7, borderRadius: 99, backgroundColor: activeFilter === f ? '#FFFFFF' : 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: activeFilter === f ? '#FFFFFF' : 'rgba(255,255,255,0.18)' }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: activeFilter === f ? C.navy : 'rgba(255,255,255,0.85)' }}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.navy} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Ionicons name="cloud-offline" size={48} color={C.text3} />
          <Text style={{ color: C.text2, fontSize: 15, marginTop: 12, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity style={{ marginTop: 16, backgroundColor: C.navy, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }} onPress={loadOrders}>
            <Text style={{ color: C.white, fontWeight: '700' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: C.light, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="bag-outline" size={36} color={C.blue} />
          </View>
          <Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }}>No orders yet</Text>
          <Text style={{ color: C.text2, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
            When customers say "order" or "bili", the bot guides them through the order flow automatically.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy} />}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((order) => {
            const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
            const canUpdate = (NEXT_STATUSES[order.status] ?? []).length > 0;
            const customerName = order.conversations?.customer_name ?? `···${order.customer_facebook_id.slice(-4)}`;

            return (
              <View
                key={order.id}
                style={{ backgroundColor: C.white, borderRadius: 20, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.border, shadowColor: C.navy, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 }}
              >
                {/* Status accent top bar */}
                <View style={{ height: 3, backgroundColor: cfg.color }} />

                {/* Card header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ color: C.text, fontWeight: '800', fontSize: 15, letterSpacing: -0.3 }} numberOfLines={1}>{order.item}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                      {order.order_number && (
                        <Text style={{ color: C.blue, fontSize: 11, fontWeight: '800' }}>{order.order_number}</Text>
                      )}
                      {order.order_number && <Text style={{ color: C.text3, fontSize: 11 }}>·</Text>}
                      <Text style={{ color: C.text3, fontSize: 11, fontWeight: '600' }}>{customerName}</Text>
                      <Text style={{ color: C.text3, fontSize: 11 }}>·</Text>
                      <Text style={{ color: C.text3, fontSize: 11 }}>{timeAgo(order.created_at)}</Text>
                    </View>
                  </View>
                  <View style={{ borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: cfg.bg, borderWidth: 1, borderColor: `${cfg.color}40`, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name={cfg.icon as any} size={10} color={cfg.color} />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: cfg.color }}>{cfg.label}</Text>
                  </View>
                </View>

                {/* Details */}
                <View style={{ paddingHorizontal: 14, paddingVertical: 13, gap: 9 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: C.navyFade, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="cube-outline" size={12} color={C.navy} />
                    </View>
                    <Text style={{ color: C.text2, fontSize: 13 }}>Qty: <Text style={{ color: C.text, fontWeight: '700' }}>{order.quantity}</Text></Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: C.navyFade, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                      <Ionicons name="location-outline" size={12} color={C.navy} />
                    </View>
                    <Text style={{ color: C.text2, fontSize: 13, flex: 1, lineHeight: 18 }}>{order.address}</Text>
                  </View>

                  {/* Price row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
                    <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: C.navyFade, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="cash-outline" size={12} color={C.navy} />
                    </View>
                    {editingPriceId === order.id ? (
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: C.text2, fontSize: 13, fontWeight: '700' }}>₱</Text>
                        <TextInput
                          style={{ flex: 1, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, color: C.navy, fontSize: 13 }}
                          value={priceInput}
                          onChangeText={setPriceInput}
                          placeholder="0.00"
                          placeholderTextColor={C.text3}
                          keyboardType="decimal-pad"
                          autoFocus
                        />
                        <TouchableOpacity activeOpacity={0.85} style={{ backgroundColor: C.navy, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }} onPress={() => handleSavePrice(order.id)}>
                          <Text style={{ color: C.white, fontSize: 12, fontWeight: '700' }}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setEditingPriceId(null); setPriceInput(''); }} style={{ padding: 4 }}>
                          <Ionicons name="close" size={16} color={C.text3} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }}
                        onPress={() => { setEditingPriceId(order.id); setPriceInput(order.total_price != null ? String(order.total_price) : ''); }}
                      >
                        {order.total_price != null ? (
                          <Text style={{ color: C.navy, fontSize: 15, fontWeight: '800', letterSpacing: -0.3 }}>₱{Number(order.total_price).toLocaleString()}</Text>
                        ) : (
                          <Text style={{ color: C.text3, fontSize: 12, fontWeight: '600' }}>+ Set Price</Text>
                        )}
                        <Ionicons name="pencil-outline" size={11} color={C.text3} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Action buttons */}
                <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg }}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13 }}
                    onPress={() => openConversation(order.conversation_id, customerName)}
                  >
                    <Ionicons name="chatbubble-outline" size={14} color={C.text2} />
                    <Text style={{ color: C.text2, fontSize: 12, fontWeight: '700' }}>Message</Text>
                  </TouchableOpacity>
                  {canUpdate && (
                    <>
                      <View style={{ width: 1, backgroundColor: C.border }} />
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13 }}
                        onPress={() => handleUpdateStatus(order)}
                      >
                        <Ionicons name="arrow-forward-circle-outline" size={14} color={C.navy} />
                        <Text style={{ color: C.navy, fontSize: 12, fontWeight: '700' }}>Update Status</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
