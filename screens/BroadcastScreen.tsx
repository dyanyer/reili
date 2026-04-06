import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  RefreshControl, Switch, Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../navigation';
import { broadcastsApi, pagesApi } from '../lib/api';
import PageSwitcherPill from '../components/PageSwitcherPill';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinary } from '../lib/cloudinary';

type Props = NativeStackScreenProps<MoreStackParamList, 'Broadcast'>;

type Broadcast = {
  id: string;
  message_text: string;
  image_url: string | null;
  status: 'sending' | 'done' | 'pending' | 'failed' | 'scheduled';
  sent_count: number;
  total_count: number;
  created_at: string;
  scheduled_at: string | null;
  segment: string | null;
};

const SEGMENTS = [
  { key: 'all',            label: 'All Contacts',   icon: 'people',              desc: 'Everyone who has messaged'  },
  { key: 'active_7d',      label: 'Active (7 days)', icon: 'time',                desc: 'Messaged in the last week'  },
  { key: 'with_orders',    label: 'Customers',       icon: 'cart',                desc: 'Placed at least 1 order'    },
  { key: 'without_orders', label: 'No Orders',       icon: 'chatbubble-ellipses', desc: 'Never ordered — re-engage'  },
] as const;

const STATUS_CONFIG = {
  sending:   { label: 'Sending...',  color: '#FBBF24',  bg: 'rgba(251,191,36,0.14)',   icon: 'time'             },
  done:      { label: 'Sent',        color: '#16A34A',  bg: 'rgba(22,163,74,0.10)',    icon: 'checkmark-circle' },
  pending:   { label: 'Pending',     color: '#1E56A0',  bg: 'rgba(22,49,114,0.08)',    icon: 'hourglass'        },
  failed:    { label: 'Failed',      color: '#DC2626',  bg: 'rgba(220,38,38,0.09)',    icon: 'close-circle'     },
  scheduled: { label: 'Scheduled',   color: '#1E56A0',  bg: 'rgba(30,86,160,0.12)',    icon: 'calendar'         },
} as const;

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

const AMBER = '#D97706';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatScheduled(dateStr: string) {
  return new Date(dateStr).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function BroadcastScreen({ route, navigation }: Props) {
  const { pageId, pageName } = route.params;
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [segment, setSegment] = useState<string>('all');
  const [segmentCounts, setSegmentCounts] = useState<Record<string, number>>({});
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date>(() => { const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0); return d; });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const load = useCallback(async () => {
    try {
      setHistoryError('');
      const [history, stats, counts] = await Promise.all([broadcastsApi.getAll(pageId), pagesApi.getStats(pageId), broadcastsApi.getRecipientCounts(pageId)]);
      setBroadcasts(history); setContactCount(stats.conversation_count); setSegmentCounts(counts);
    } catch { setHistoryError('Failed to load broadcast history.'); }
    finally { setLoadingHistory(false); }
  }, [pageId]);

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }
  useEffect(() => { load(); }, [load]);

  async function handleSend() {
    const text = messageText.trim();
    if (!text && !pendingImage) return;
    const segCount = segmentCounts[segment] ?? contactCount ?? 0;
    if (segCount === 0) { Alert.alert('No contacts', 'No contacts match this segment.'); return; }
    if (scheduleEnabled && scheduledAt <= new Date()) { Alert.alert('Invalid time', 'Scheduled time must be in the future.'); return; }

    const segLabel = SEGMENTS.find((s) => s.key === segment)?.label ?? 'All';
    const scheduledLabel = scheduleEnabled
      ? `scheduled for ${formatScheduled(scheduledAt.toISOString())}`
      : `sent now to ${segCount} contact${segCount !== 1 ? 's' : ''} (${segLabel})`;

    Alert.alert(
      scheduleEnabled ? 'Schedule Broadcast' : 'Send Broadcast',
      `This message will be ${scheduledLabel}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: scheduleEnabled ? 'Schedule' : 'Send', onPress: async () => {
          setSending(true);
          let imageUrl: string | undefined;
          if (pendingImage) {
            setUploadingImage(true);
            try { imageUrl = await uploadImageToCloudinary(pendingImage); }
            catch { Alert.alert('Error', 'Failed to upload image'); setUploadingImage(false); setSending(false); return; }
            setUploadingImage(false);
          }
          try {
            const result = await broadcastsApi.send(pageId, text, scheduleEnabled ? scheduledAt.toISOString() : undefined, segment, imageUrl);
            setMessageText(''); setPendingImage(null); setScheduleEnabled(false);
            setBroadcasts((prev) => [result, ...prev]);
            Alert.alert(
              scheduleEnabled ? 'Broadcast scheduled!' : 'Broadcast started',
              scheduleEnabled ? `Will send on ${formatScheduled(scheduledAt.toISOString())}.` : `Sending to ${result.total_count} contacts.`,
            );
          } catch { Alert.alert('Error', 'Failed to send broadcast.'); }
          finally { setSending(false); }
        }},
      ],
    );
  }

  const minDate = new Date();
  const hasContent = messageText.trim().length > 0 || !!pendingImage;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar style="light" />

        {/* Header */}
        <View style={{ backgroundColor: C.navy, paddingTop: 56, paddingBottom: 18, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="arrow-back" size={18} color={C.white} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.white, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 }}>Broadcast</Text>
            </View>
            <PageSwitcherPill
              currentPageId={pageId}
              currentPageName={pageName}
              onSwitch={(id, name) => navigation.replace('Broadcast', { pageId: id, pageName: name })}
            />
            {contactCount !== null && (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                <Text style={{ color: 'rgba(214,228,240,0.90)', fontSize: 11, fontWeight: '700' }}>{contactCount} contacts</Text>
              </View>
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy} />}
        >
          {/* Compose card */}
          <View style={{ backgroundColor: C.white, borderRadius: 20, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: C.border, shadowColor: C.navy, shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
            {/* Card header strip */}
            <View style={{ backgroundColor: 'rgba(251,191,36,0.08)', borderBottomWidth: 1, borderBottomColor: 'rgba(251,191,36,0.18)', paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(251,191,36,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(217,119,6,0.20)' }}>
                <Ionicons name="megaphone" size={17} color={AMBER} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.navy, fontWeight: '800', fontSize: 15 }}>New Broadcast</Text>
                <Text style={{ color: C.text3, fontSize: 11, marginTop: 1 }}>Send a message to your contacts</Text>
              </View>
            </View>
            <View style={{ padding: 16 }}>

            <TextInput
              style={{ backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: C.navy, fontSize: 14, minHeight: 120, textAlignVertical: 'top' }}
              value={messageText}
              onChangeText={setMessageText}
              placeholder={'E.g. Sale ngayon! 50% off lahat ng items 🔥\n\nMessage lang para mag-order!'}
              placeholderTextColor={C.text3}
              multiline
              maxLength={2000}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 14 }}>
              <Text style={{ color: C.text3, fontSize: 11 }}>{messageText.length}/2000</Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.light, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: C.border }}
                onPress={async () => {
                  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true });
                  if (!result.canceled && result.assets?.[0]) setPendingImage(result.assets[0].uri);
                }}
              >
                <Ionicons name="image-outline" size={14} color={C.blue} />
                <Text style={{ color: C.blue, fontSize: 12, fontWeight: '600' }}>Add Image</Text>
              </TouchableOpacity>
            </View>
            {pendingImage && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 }}>
                <Image source={{ uri: pendingImage }} style={{ width: 72, height: 72, borderRadius: 12 }} resizeMode="cover" />
                <TouchableOpacity onPress={() => setPendingImage(null)}>
                  <Ionicons name="close-circle" size={22} color={C.text3} />
                </TouchableOpacity>
                {uploadingImage && <ActivityIndicator size="small" color={C.blue} />}
              </View>
            )}

            {/* Segment selector */}
            <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14, marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: C.navyFade, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="people" size={12} color={C.blue} />
                </View>
                <Text style={{ color: C.navy, fontWeight: '700', fontSize: 13 }}>Send to</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SEGMENTS.map((seg) => {
                  const active = segment === seg.key;
                  const count = segmentCounts[seg.key];
                  return (
                    <TouchableOpacity
                      key={seg.key}
                      onPress={() => setSegment(seg.key)}
                      style={{ borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: active ? C.navy : C.light, borderWidth: 1, borderColor: active ? C.navy : C.border }}
                    >
                      <Ionicons name={seg.icon as any} size={12} color={active ? C.white : C.blue} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? C.white : C.text }}>{seg.label}</Text>
                      {count !== undefined && (
                        <View style={{ borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: active ? 'rgba(255,255,255,0.20)' : C.navyFade }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: active ? C.white : C.text2 }}>{count}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {segment !== 'all' && (
                <Text style={{ color: C.text3, fontSize: 11, marginTop: 8, fontStyle: 'italic' }}>
                  {SEGMENTS.find((s) => s.key === segment)?.desc}
                </Text>
              )}
            </View>

            {/* Schedule toggle */}
            <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14, marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: scheduleEnabled ? C.navyFade : C.navyFade, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="calendar-outline" size={12} color={scheduleEnabled ? C.navy : C.blue} />
                  </View>
                  <Text style={{ color: C.navy, fontWeight: '700', fontSize: 13 }}>Schedule for later</Text>
                </View>
                <Switch
                  value={scheduleEnabled}
                  onValueChange={setScheduleEnabled}
                  trackColor={{ false: C.light, true: C.blue }}
                  thumbColor={C.white}
                />
              </View>
              <Text style={{ color: C.text3, fontSize: 11, lineHeight: 16, marginBottom: scheduleEnabled ? 12 : 0 }}>
                {scheduleEnabled ? 'Will send at the time below.' : 'Off — broadcast sends immediately.'}
              </Text>
              {scheduleEnabled && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.bg, borderWidth: 1, borderColor: C.blue, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 }}
                    onPress={() => { setShowTimePicker(false); setShowDatePicker(true); }}
                  >
                    <Ionicons name="calendar" size={13} color={C.navy} />
                    <Text style={{ color: C.navy, fontSize: 13, fontWeight: '600' }}>
                      {scheduledAt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.bg, borderWidth: 1, borderColor: C.blue, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 }}
                    onPress={() => { setShowDatePicker(false); setShowTimePicker(true); }}
                  >
                    <Ionicons name="time-outline" size={13} color={C.navy} />
                    <Text style={{ color: C.navy, fontSize: 13, fontWeight: '600' }}>
                      {scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {showDatePicker && (
                <DateTimePicker value={scheduledAt} mode="date" minimumDate={minDate} onChange={(_, date) => {
                  setShowDatePicker(false);
                  if (date) { const u = new Date(scheduledAt); u.setFullYear(date.getFullYear(), date.getMonth(), date.getDate()); setScheduledAt(u); }
                }} />
              )}
              {showTimePicker && (
                <DateTimePicker value={scheduledAt} mode="time" onChange={(_, date) => {
                  setShowTimePicker(false);
                  if (date) { const u = new Date(scheduledAt); u.setHours(date.getHours(), date.getMinutes(), 0, 0); setScheduledAt(u); }
                }} />
              )}
            </View>
            </View>

            {/* Send button — full-width, outside padding View */}
            <TouchableOpacity
              style={{ margin: 16, marginTop: 0, borderRadius: 16, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: hasContent ? C.navy : C.light, borderWidth: 1, borderColor: hasContent ? C.navy : C.border, shadowColor: hasContent ? C.navy : 'transparent', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: hasContent ? 4 : 0 }}
              onPress={handleSend}
              disabled={!hasContent || sending}
            >
              {sending ? <ActivityIndicator size="small" color={C.white} /> : (
                <>
                  <Ionicons name={scheduleEnabled ? 'calendar' : 'send'} size={17} color={hasContent ? C.white : C.text3} />
                  <Text style={{ fontWeight: '800', fontSize: 15, color: hasContent ? C.white : C.text3 }}>
                    {scheduleEnabled ? 'Schedule Broadcast' : `Send to ${segmentCounts[segment] ?? contactCount ?? '...'} contacts`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Info banner */}
          <View style={{ backgroundColor: C.navyFade, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 10, marginBottom: 20, borderWidth: 1, borderColor: C.border }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Ionicons name="shield-checkmark" size={14} color={C.navy} />
            </View>
            <Text style={{ color: C.text2, fontSize: 12, flex: 1, lineHeight: 18 }}>
              Messages are sent one by one with a short delay to stay within Facebook's limits and keep your page safe.
            </Text>
          </View>

          {/* History header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Text style={{ color: C.navy, fontSize: 15, fontWeight: '800', flex: 1 }}>Broadcast History</Text>
            {broadcasts.length > 0 && (
              <View style={{ backgroundColor: C.navyFade, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ color: C.text2, fontSize: 11, fontWeight: '700' }}>{broadcasts.length}</Text>
              </View>
            )}
          </View>

          {loadingHistory ? (
            <View style={{ paddingVertical: 32, alignItems: 'center', gap: 10 }}>
              <ActivityIndicator size="small" color={C.navy} />
              <Text style={{ color: C.text3, fontSize: 12 }}>Loading history…</Text>
            </View>
          ) : historyError ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: C.redBg, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Ionicons name="cloud-offline" size={26} color={C.red} />
              </View>
              <Text style={{ color: C.text2, fontSize: 13, marginBottom: 14, textAlign: 'center' }}>{historyError}</Text>
              <TouchableOpacity style={{ backgroundColor: C.navy, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }} onPress={load}>
                <Text style={{ color: C.white, fontSize: 13, fontWeight: '700' }}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : broadcasts.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 36 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(251,191,36,0.12)', borderWidth: 1, borderColor: 'rgba(217,119,6,0.22)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="megaphone-outline" size={30} color={AMBER} />
              </View>
              <Text style={{ color: C.navy, fontSize: 14, fontWeight: '700', marginBottom: 4 }}>No broadcasts yet</Text>
              <Text style={{ color: C.text3, fontSize: 12, textAlign: 'center' }}>Send your first broadcast above.</Text>
            </View>
          ) : (
            broadcasts.map((b) => {
              const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending;
              const progress = b.total_count > 0 ? Math.min(b.sent_count / b.total_count, 1) : 0;
              const segMeta = SEGMENTS.find((s) => s.key === b.segment);
              return (
                <View key={b.id} style={{ backgroundColor: C.white, borderRadius: 18, overflow: 'hidden', marginBottom: 10, borderWidth: 1, borderColor: C.border, shadowColor: C.navy, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}>
                  {/* Card top row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: cfg.bg, borderWidth: 1, borderColor: `${cfg.color}35` }}>
                      <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: cfg.color }}>{cfg.label}</Text>
                    </View>
                    <Text style={{ color: C.text3, fontSize: 11 }}>{formatDate(b.created_at)}</Text>
                  </View>
                  {/* Message preview */}
                  <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 }}>
                    <Text style={{ color: C.navy, fontSize: 13, lineHeight: 20, marginBottom: b.image_url || (b.segment && b.segment !== 'all') ? 8 : 0 }} numberOfLines={3}>{b.message_text || '(No text)'}</Text>
                    {(b.image_url || (b.segment && b.segment !== 'all')) && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {b.image_url && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.navyFade, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 }}>
                            <Ionicons name="image" size={11} color={C.blue} />
                            <Text style={{ color: C.blue, fontSize: 11, fontWeight: '600' }}>Image</Text>
                          </View>
                        )}
                        {b.segment && b.segment !== 'all' && segMeta && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.navyFade, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 }}>
                            <Ionicons name={segMeta.icon as any} size={11} color={C.blue} />
                            <Text style={{ color: C.blue, fontSize: 11, fontWeight: '600' }}>{segMeta.label}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  {/* Footer */}
                  <View style={{ backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 14, paddingVertical: 10 }}>
                    {b.status === 'scheduled' && b.scheduled_at ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="calendar-outline" size={13} color={C.blue} />
                        <Text style={{ color: C.blue, fontSize: 12, fontWeight: '600' }}>Sends {formatScheduled(b.scheduled_at)}</Text>
                      </View>
                    ) : (
                      <View style={{ gap: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Ionicons name="people-outline" size={13} color={C.text3} />
                            <Text style={{ color: C.text2, fontSize: 12, fontWeight: '600' }}>{b.sent_count} / {b.total_count} sent</Text>
                          </View>
                          {b.status === 'sending' ? (
                            <ActivityIndicator size="small" color={AMBER} />
                          ) : (
                            <Text style={{ color: C.text3, fontSize: 11 }}>
                              {b.total_count > 0 ? `${Math.round(progress * 100)}%` : '—'}
                            </Text>
                          )}
                        </View>
                        {b.total_count > 0 && (
                          <View style={{ height: 4, borderRadius: 99, backgroundColor: C.light, overflow: 'hidden' }}>
                            <View style={{ height: 4, borderRadius: 99, backgroundColor: cfg.color, width: `${Math.round(progress * 100)}%` }} />
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
