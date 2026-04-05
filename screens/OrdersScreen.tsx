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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:   { label: 'Pending',   color: '#D97706', bg: '#FEF3C7', icon: 'time-outline' },
  confirmed: { label: 'Confirmed', color: '#0E1C40', bg: '#E8F8FF', icon: 'checkmark-circle-outline' },
  packed:    { label: 'Packed',    color: '#7C3AED', bg: '#F3E8FF', icon: 'cube-outline' },
  shipped:   { label: 'Shipped',   color: '#0099CC', bg: '#DBEAFE', icon: 'bicycle-outline' },
  delivered: { label: 'Delivered', color: '#059669', bg: '#D1FAE5', icon: 'checkmark-done-circle-outline' },
  cancelled: { label: 'Cancelled', color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle-outline' },
};

const NEXT_STATUSES: Record<string, string[]> = {
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed:    ['shipped', 'cancelled'],
  shipped:   ['delivered'],
  delivered: [],
  cancelled: [],
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
    rootNav.navigate('ChatsTab', {
      screen: 'ConversationThread',
      params: { conversationId, customerName },
    });
  }
  const [pageId, setPageId] = useState(route.params?.pageId ?? activePage?.id ?? '');
  const [pageName, setPageName] = useState(route.params?.pageName ?? activePage?.name ?? '');

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');

  const loadOrders = useCallback(async () => {
    if (!pageId) { setLoading(false); return; }
    try {
      setError('');
      const data = await ordersApi.getAll(pageId);
      setOrders(data);
    } catch {
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  async function onRefresh() {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const filtered = orders.filter((o) =>
    activeFilter === 'All' ? true : o.status === activeFilter.toLowerCase()
  );

  function handleUpdateStatus(order: Order) {
    const next = NEXT_STATUSES[order.status] ?? [];
    if (next.length === 0) return;

    const doUpdate = async (s: string) => {
      try {
        const updated = await ordersApi.updateStatus(order.id, s);
        setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: updated.status } : o)));
      } catch {
        Alert.alert('Error', 'Failed to update order status');
      }
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
        } else {
          doUpdate(s);
        }
      },
    }));
    Alert.alert('Update Status', `${order.item} × ${order.quantity}`, [...options, { text: 'Cancel', style: 'cancel' as const }]);
  }

  async function handleSavePrice(orderId: string) {
    const val = priceInput.trim();
    const parsed = val === '' ? null : parseFloat(val);
    if (val !== '' && (isNaN(parsed!) || parsed! < 0)) {
      Alert.alert('Invalid', 'Enter a valid price (e.g. 250)');
      return;
    }
    try {
      const updated = await ordersApi.updatePrice(orderId, parsed);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, total_price: updated.total_price } : o)));
      setEditingPriceId(null);
      setPriceInput('');
    } catch {
      Alert.alert('Error', 'Failed to update price');
    }
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
    } catch {
      Alert.alert('Export failed', 'Could not export orders.');
    }
  }

  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  if (!pageId) {
    return (
      <View className="flex-1 bg-[#F0F2F5]">
        <StatusBar style="dark" />
        <View className="bg-white pt-14 pb-4 px-4 border-b border-[#E4E6EB]">
          <Text className="text-[#1C1E21] text-xl font-bold">Orders</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <View className="bg-[#E8F8FF] rounded-full p-6 mb-4">
            <Ionicons name="bag-outline" size={40} color="#0E1C40" />
          </View>
          <Text className="text-[#1C1E21] font-bold text-base">No page selected</Text>
          <Text className="text-[#65676B] text-sm mt-2 text-center leading-5">
            Go to Home and tap a page to view its orders.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F0F2F5]">
      <StatusBar style="dark" />

      {/* Header */}
      <View className="bg-white pt-14 pb-3 px-4 border-b border-[#E4E6EB]">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-1 mr-3 flex-row items-center gap-2">
            <Text className="text-[#1C1E21] text-xl font-bold">Orders</Text>
            {pendingCount > 0 && (
              <View className="bg-[#FEF3C7] rounded-full px-2 py-0.5">
                <Text className="text-[#D97706] text-xs font-bold">{pendingCount} pending</Text>
              </View>
            )}
          </View>
          <View className="flex-row items-center">
            <PageSwitcherPill
              currentPageId={pageId}
              currentPageName={pageName}
              onSwitch={(id, name) => { setPageId(id); setPageName(name); }}
            />
            <TouchableOpacity onPress={exportCSV} className="p-2">
              <Ionicons name="download-outline" size={20} color="#65676B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {STATUSES.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-full ${activeFilter === f ? 'bg-navy' : 'bg-[#E4E6EB]'}`}
            >
              <Text className={`text-xs font-semibold ${activeFilter === f ? 'text-white' : 'text-[#65676B]'}`}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0E1C40" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cloud-offline" size={48} color="#cbd5e1" />
          <Text className="text-[#65676B] text-base mt-3 text-center">{error}</Text>
          <TouchableOpacity className="mt-4 bg-navy rounded-xl px-6 py-3" onPress={loadOrders}>
            <Text className="text-white font-semibold">Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="bg-[#E8F8FF] rounded-full p-6 mb-4">
            <Ionicons name="bag-outline" size={40} color="#0E1C40" />
          </View>
          <Text className="text-[#1C1E21] font-bold text-base">No orders yet</Text>
          <Text className="text-[#65676B] text-sm mt-2 text-center leading-5">
            When customers say "order" or "bili", the bot guides them through the order flow automatically.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0E1C40" />}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((order) => {
            const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
            const canUpdate = (NEXT_STATUSES[order.status] ?? []).length > 0;
            const customerName = order.conversations?.customer_name ?? `···${order.customer_facebook_id.slice(-4)}`;

            return (
              <View
                key={order.id}
                className="bg-white rounded-2xl mb-3 overflow-hidden"
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}
              >
                {/* Card header */}
                <View className="flex-row items-center justify-between px-4 pt-3.5 pb-3 border-b border-[#F0F2F5]">
                  <View className="flex-1 mr-3">
                    <Text className="text-[#1C1E21] font-bold text-sm" numberOfLines={1}>{order.item}</Text>
                    <View className="flex-row items-center gap-2 mt-0.5 flex-wrap">
                      {order.order_number && (
                        <Text className="text-[#0E1C40] text-xs font-bold">{order.order_number}</Text>
                      )}
                      <Text className="text-[#65676B] text-xs">·</Text>
                      <Text className="text-[#65676B] text-xs">{customerName}</Text>
                      <Text className="text-[#65676B] text-xs">·</Text>
                      <Text className="text-[#65676B] text-xs">{timeAgo(order.created_at)}</Text>
                    </View>
                  </View>
                  <View className="rounded-xl px-2.5 py-1" style={{ backgroundColor: cfg.bg }}>
                    <Text className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</Text>
                  </View>
                </View>

                {/* Details */}
                <View className="px-4 py-3 gap-2">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="cube-outline" size={13} color="#65676B" />
                    <Text className="text-[#65676B] text-sm">Qty: <Text className="text-[#1C1E21] font-medium">{order.quantity}</Text></Text>
                  </View>
                  <View className="flex-row items-start gap-2">
                    <Ionicons name="location-outline" size={13} color="#65676B" style={{ marginTop: 1 }} />
                    <Text className="text-[#65676B] text-sm flex-1 leading-5">{order.address}</Text>
                  </View>

                  {/* Price row */}
                  <View className="flex-row items-center gap-2 pt-2 border-t border-[#F0F2F5]">
                    <Ionicons name="cash-outline" size={13} color="#65676B" />
                    {editingPriceId === order.id ? (
                      <View className="flex-1 flex-row items-center gap-2">
                        <Text className="text-[#65676B] text-sm">₱</Text>
                        <TextInput
                          className="flex-1 bg-[#F0F2F5] rounded-lg px-3 py-1.5 text-[#1C1E21] text-sm"
                          value={priceInput}
                          onChangeText={setPriceInput}
                          placeholder="0.00"
                          placeholderTextColor="#65676B"
                          keyboardType="decimal-pad"
                          autoFocus
                        />
                        <TouchableOpacity className="bg-navy rounded-lg px-3 py-1.5" onPress={() => handleSavePrice(order.id)}>
                          <Text className="text-white text-xs font-semibold">Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setEditingPriceId(null); setPriceInput(''); }}>
                          <Ionicons name="close" size={16} color="#65676B" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        className="flex-1 flex-row items-center gap-1"
                        onPress={() => { setEditingPriceId(order.id); setPriceInput(order.total_price != null ? String(order.total_price) : ''); }}
                      >
                        {order.total_price != null ? (
                          <Text className="text-[#0E1C40] text-sm font-bold">₱{Number(order.total_price).toLocaleString()}</Text>
                        ) : (
                          <Text className="text-[#00C5FF] text-xs font-semibold">+ Set Price</Text>
                        )}
                        <Ionicons name="pencil-outline" size={11} color="#65676B" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Actions */}
                <View className="flex-row border-t border-[#F0F2F5]">
                  <TouchableOpacity
                    className="flex-row flex-1 items-center justify-center gap-1.5 py-3"
                    onPress={() => openConversation(order.conversation_id, customerName)}
                  >
                    <Ionicons name="chatbubble-outline" size={15} color="#65676B" />
                    <Text className="text-[#65676B] text-xs font-medium">Message</Text>
                  </TouchableOpacity>
                  {canUpdate && (
                    <>
                      <View className="w-px bg-[#F0F2F5]" />
                      <TouchableOpacity
                        className="flex-row flex-1 items-center justify-center gap-1.5 py-3"
                        onPress={() => handleUpdateStatus(order)}
                      >
                        <Ionicons name="arrow-forward-circle-outline" size={15} color="#0E1C40" />
                        <Text className="text-[#0E1C40] text-xs font-semibold">Update Status</Text>
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
