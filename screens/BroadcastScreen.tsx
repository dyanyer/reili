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
        <StatusBar style="dark" />

        {/* Header */}
        <View style={{ backgroundColor: C.white, paddingTop: 56, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12, padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color={C.navy} />
          </TouchableOpacity>
          <Text style={{ flex: 1, color: C.navy, fontSize: 20, fontWeight: '800' }}>Broadcast</Text>
          <PageSwitcherPill
            currentPageId={pageId}
            currentPageName={pageName}
            onSwitch={(id, name) => navigation.replace('Broadcast', { pageId: id, pageName: name })}
          />
          {contactCount !== null && (
            <View style={{ backgroundColor: C.navyFade, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginLeft: 6, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.blue, fontSize: 11, fontWeight: '700' }}>{contactCount} contacts</Text>
            </View>
          )}
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy} />}
        >
          {/* Compose card */}
          <View style={{ backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(251,191,36,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="megaphone" size={15} color={AMBER} />
              </View>
              <Text style={{ color: C.navy, fontWeight: '700', fontSize: 15 }}>New Broadcast</Text>
            </View>
            <Text style={{ color: C.text3, fontSize: 12, marginBottom: 12, lineHeight: 17 }}>
              Send a message to your contacts. Choose a segment below.
            </Text>

            <TextInput
              style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: C.navy, fontSize: 14, minHeight: 120, textAlignVertical: 'top' }}
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
                <Ionicons name="filter" size={13} color={C.blue} />
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
                      style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: active ? C.navy : C.light, borderWidth: 1, borderColor: active ? C.navy : C.border }}
                    >
                      <Ionicons name={seg.icon as any} size={12} color={active ? C.white : C.text3} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? C.white : C.text }}>{seg.label}</Text>
                      {count !== undefined && (
                        <View style={{ borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: active ? 'rgba(255,255,255,0.20)' : C.navyFade }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: active ? C.white : C.text3 }}>{count}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {segment !== 'all' && (
                <Text style={{ color: C.text3, fontSize: 11, marginTop: 6 }}>
                  {SEGMENTS.find((s) => s.key === segment)?.desc}
                </Text>
              )}
            </View>

            {/* Schedule toggle */}
            <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14, marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Ionicons name="calendar-outline" size={15} color={C.blue} />
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
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.light, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 }}
                    onPress={() => { setShowTimePicker(false); setShowDatePicker(true); }}
                  >
                    <Ionicons name="calendar" size={13} color={C.navy} />
                    <Text style={{ color: C.navy, fontSize: 13, fontWeight: '600' }}>
                      {scheduledAt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.light, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 }}
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

            {/* Send button */}
            <TouchableOpacity
              style={{ borderRadius: 16, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: hasContent ? C.navy : C.light, borderWidth: 1, borderColor: hasContent ? C.navy : C.border }}
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
          <View style={{ backgroundColor: C.light, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 10, marginBottom: 18, borderWidth: 1, borderColor: C.border }}>
            <Ionicons name="information-circle" size={18} color={C.navy} />
            <Text style={{ color: C.navy, fontSize: 12, flex: 1, lineHeight: 18 }}>
              Messages are sent one by one with a short delay to stay within Facebook's limits and keep your page safe.
            </Text>
          </View>

          {/* History */}
          <Text style={{ color: C.navy, fontSize: 15, fontWeight: '800', marginBottom: 12 }}>Broadcast History</Text>

          {loadingHistory ? (
            <ActivityIndicator size="small" color={C.navy} />
          ) : historyError ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Ionicons name="cloud-offline" size={36} color={C.text3} />
              <Text style={{ color: C.text2, fontSize: 13, marginTop: 8, textAlign: 'center' }}>{historyError}</Text>
              <TouchableOpacity style={{ marginTop: 12, backgroundColor: C.navy, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 9 }} onPress={load}>
                <Text style={{ color: C.white, fontSize: 13, fontWeight: '700' }}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : broadcasts.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(251,191,36,0.12)', borderWidth: 1, borderColor: 'rgba(217,119,6,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="megaphone-outline" size={28} color={AMBER} />
              </View>
              <Text style={{ color: C.text2, fontSize: 13, textAlign: 'center' }}>No broadcasts sent yet.</Text>
            </View>
          ) : (
            broadcasts.map((b) => {
              const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending;
              return (
                <View key={b.id} style={{ backgroundColor: C.white, borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: cfg.bg, borderWidth: 1, borderColor: `${cfg.color}40` }}>
                      <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: cfg.color }}>{cfg.label}</Text>
                    </View>
                    <Text style={{ color: C.text3, fontSize: 11 }}>{formatDate(b.created_at)}</Text>
                  </View>
                  <Text style={{ color: C.navy, fontSize: 13, lineHeight: 19, marginBottom: 8 }} numberOfLines={3}>{b.message_text}</Text>
                  {b.image_url && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                      <Ionicons name="image" size={11} color={C.blue} />
                      <Text style={{ color: C.blue, fontSize: 11, fontWeight: '600' }}>Image attached</Text>
                    </View>
                  )}
                  {b.segment && b.segment !== 'all' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                      <Ionicons name="filter" size={11} color={C.text3} />
                      <Text style={{ color: C.text3, fontSize: 11 }}>{SEGMENTS.find((s) => s.key === b.segment)?.label ?? b.segment}</Text>
                    </View>
                  )}
                  {b.status === 'scheduled' && b.scheduled_at ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="calendar-outline" size={12} color={C.blue} />
                      <Text style={{ color: C.blue, fontSize: 11 }}>Sends {formatScheduled(b.scheduled_at)}</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="people-outline" size={12} color={C.text3} />
                      <Text style={{ color: C.text3, fontSize: 11 }}>{b.sent_count} / {b.total_count} sent</Text>
                      {b.status === 'sending' && <ActivityIndicator size="small" color={AMBER} style={{ marginLeft: 4 }} />}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
