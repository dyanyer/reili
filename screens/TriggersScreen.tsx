import {
  View, Text, TouchableOpacity, ScrollView, Switch,
  ActivityIndicator, Alert, RefreshControl, Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../navigation';
import { triggersApi } from '../lib/api';
import PageSwitcherPill from '../components/PageSwitcherPill';

type Props = NativeStackScreenProps<MoreStackParamList, 'Triggers'>;

type Trigger = {
  id: string;
  keywords: string[];
  response_text: string;
  is_active: boolean;
  fire_count: number;
  priority: number;
  image_url: string | null;
  quick_replies: { title: string; payload: string }[] | null;
  last_fired_at?: string | null;
  match_mode?: string;
};

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

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TRIGGER_TEMPLATES: { label: string; emoji: string; keywords: string[]; response_text: string }[] = [
  { label: 'Price Inquiry', emoji: '💰', keywords: ['magkano', 'presyo', 'price', 'how much'], response_text: 'Heto ang aming mga presyo:\n\n• Item 1 — ₱XXX\n• Item 2 — ₱XXX\n\nMay ibang tanong? 😊' },
  { label: 'Stock Check', emoji: '📦', keywords: ['available', 'meron pa', 'mayroon', 'stock'], response_text: 'Oo, available pa po! 🎉 Kung gusto mo mag-order, i-type mo lang "order" at gagabayan kita. 😊' },
  { label: 'How to Order', emoji: '🛍️', keywords: ['paano mag-order', 'how to order', 'pano order'], response_text: 'Simple lang ang pag-order! I-type mo lang ang salitang "order" at sasabihan kita kung anong susunod. 👇' },
  { label: 'Delivery Info', emoji: '🚚', keywords: ['delivery', 'shipping', 'padala', 'kailan madeliver'], response_text: 'Nagde-deliver kami nationwide! 🇵🇭\n\n📅 Processing: 1-2 araw\n🚚 Shipping: 3-5 araw\n\nMayroon ding same-day para sa Metro Manila. 😊' },
  { label: 'Payment Methods', emoji: '💳', keywords: ['gcash', 'payment', 'bayad', 'paano magbayad'], response_text: 'Tinatanggap namin ang:\n\n💚 GCash\n🏦 Bank Transfer (BDO / BPI)\n💵 COD (Cash on Delivery)\n\nAlin ang gusto mo? 😊' },
  { label: 'Location / Address', emoji: '📍', keywords: ['location', 'address', 'saan kayo', 'nasaan'], response_text: 'Narito ang aming location:\n\n📍 [ilagay mo ang address dito]\n\n🕐 Open hours: [ilagay mo oras]\n\nKita-kits po! 😊' },
];

export default function TriggersScreen({ route, navigation }: Props) {
  const { pageId, pageName } = route.params;
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadTriggers = useCallback(async () => {
    try { setError(''); const data = await triggersApi.getAll(pageId); setTriggers(data); }
    catch { setError('Failed to load triggers'); }
    finally { setLoading(false); }
  }, [pageId]);

  async function onRefresh() { setRefreshing(true); await loadTriggers(); setRefreshing(false); }
  useEffect(() => { loadTriggers(); }, [loadTriggers]);
  useEffect(() => { const unsub = navigation.addListener('focus', loadTriggers); return unsub; }, [navigation, loadTriggers]);

  async function handleToggle(trigger: Trigger) {
    try {
      const updated = await triggersApi.toggle(pageId, trigger.id);
      setTriggers((prev) => prev.map((t) => (t.id === trigger.id ? updated : t)));
    } catch { Alert.alert('Error', 'Failed to update trigger'); }
  }

  async function handleDelete(trigger: Trigger) {
    Alert.alert('Delete Trigger', `Delete the trigger for "${trigger.keywords[0]}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await triggersApi.delete(pageId, trigger.id); setTriggers((prev) => prev.filter((t) => t.id !== trigger.id)); }
        catch { Alert.alert('Error', 'Failed to delete trigger'); }
      }},
    ]);
  }

  async function handleMove(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= triggers.length) return;
    const reordered = [...triggers];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    setTriggers(reordered);
    try { await triggersApi.reorder(pageId, reordered.map((t) => t.id)); }
    catch { setTriggers(triggers); Alert.alert('Error', 'Failed to reorder triggers'); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />

      {/* Header — navy */}
      <View style={{ backgroundColor: C.navy, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.75} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={{ flex: 1, color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>Triggers</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <PageSwitcherPill
            currentPageId={pageId}
            currentPageName={pageName}
            onSwitch={(id, name) => navigation.replace('Triggers', { pageId: id, pageName: name })}
          />
          <TouchableOpacity
            activeOpacity={0.85}
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}
            onPress={() => navigation.navigate('CreateTrigger', { pageId })}
          >
            <Ionicons name="add" size={15} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.blue} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Ionicons name="cloud-offline" size={48} color={C.text3} />
          <Text style={{ color: C.text2, fontSize: 15, marginTop: 12, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity style={{ marginTop: 16, backgroundColor: C.navy, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }} onPress={loadTriggers}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}
        >
          {/* Info banner */}
          <View style={{ backgroundColor: C.light, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16, borderWidth: 1, borderColor: C.border }}>
            <Ionicons name="information-circle" size={17} color={C.navy} />
            <Text style={{ color: C.text, fontSize: 13, flex: 1, lineHeight: 19 }}>
              When a customer's message contains your keyword, the bot replies automatically.
            </Text>
          </View>

          {triggers.length === 0 ? (
            <View>
              <View style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 24 }}>
                <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: C.light, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Ionicons name="flash-outline" size={36} color={C.navy} />
                </View>
                <Text style={{ color: C.text, fontWeight: '800', fontSize: 17, letterSpacing: -0.3 }}>No triggers yet</Text>
                <Text style={{ color: C.text3, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 }}>
                  Start from a template or create your own keyword auto-reply.
                </Text>
              </View>

              <Text style={{ color: C.text, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>Starter Templates</Text>

              {TRIGGER_TEMPLATES.map((t) => (
                <View key={t.label} style={{ backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border, shadowColor: C.navy, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.navyFade, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="flash" size={16} color={C.navy} />
                    </View>
                    <Text style={{ color: C.text, fontWeight: '800', fontSize: 14, letterSpacing: -0.2, flex: 1 }}>{t.label}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {t.keywords.map((kw) => (
                      <View key={kw} style={{ backgroundColor: C.light, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.border }}>
                        <Text style={{ color: C.navy, fontSize: 11, fontWeight: '700' }}>{kw}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={{ color: C.text3, fontSize: 12, lineHeight: 18, marginBottom: 12 }} numberOfLines={2}>{t.response_text}</Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={{ backgroundColor: C.navy, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}
                    onPress={async () => {
                      try {
                        const created = await triggersApi.create(pageId, { keywords: t.keywords, response_text: t.response_text });
                        setTriggers((prev) => [...prev, created]);
                      } catch { Alert.alert('Error', 'Failed to create trigger'); }
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Use This Template</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                activeOpacity={0.8}
                style={{ backgroundColor: C.white, borderRadius: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.border, marginTop: 4 }}
                onPress={() => navigation.navigate('CreateTrigger', { pageId })}
              >
                <Ionicons name="add-circle-outline" size={17} color={C.navy} />
                <Text style={{ color: C.navy, fontSize: 14, fontWeight: '700' }}>Create Custom Trigger</Text>
              </TouchableOpacity>
            </View>
          ) : (
            triggers.map((trigger, triggerIndex) => (
              <View key={trigger.id} style={{ backgroundColor: C.white, borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: C.border, overflow: 'hidden', shadowColor: C.navy, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
                {/* Card header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, paddingBottom: 12, gap: 8 }}>
                  {triggers.length > 1 && (
                    <View style={{ alignItems: 'center', gap: 1, marginRight: 2 }}>
                      <TouchableOpacity onPress={() => handleMove(triggerIndex, 'up')} disabled={triggerIndex === 0} style={{ padding: 3 }} activeOpacity={0.7}>
                        <Ionicons name="chevron-up" size={14} color={triggerIndex === 0 ? C.text3 : C.blue} />
                      </TouchableOpacity>
                      <Text style={{ color: C.text3, fontSize: 10, fontWeight: '800' }}>{triggerIndex + 1}</Text>
                      <TouchableOpacity onPress={() => handleMove(triggerIndex, 'down')} disabled={triggerIndex === triggers.length - 1} style={{ padding: 3 }} activeOpacity={0.7}>
                        <Ionicons name="chevron-down" size={14} color={triggerIndex === triggers.length - 1 ? C.text3 : C.blue} />
                      </TouchableOpacity>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 }}>
                    {trigger.keywords.map((kw) => (
                      <View key={kw} style={{ backgroundColor: C.light, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 5, borderWidth: 1, borderColor: C.border }}>
                        <Text style={{ color: C.navy, fontSize: 12, fontWeight: '700' }}>{kw}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99, backgroundColor: trigger.is_active ? C.greenBg : C.navyFade, borderWidth: 1, borderColor: trigger.is_active ? 'rgba(22,163,74,0.20)' : C.border }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: trigger.is_active ? C.green : C.text3 }}>
                      {trigger.is_active ? 'Active' : 'Paused'}
                    </Text>
                  </View>
                </View>

                {/* Reply preview */}
                <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                  <Text style={{ color: C.text2, fontSize: 13, lineHeight: 19 }} numberOfLines={2}>
                    {trigger.response_text}
                  </Text>
                </View>

                {/* Image thumbnail */}
                {trigger.image_url && (
                  <Image source={{ uri: trigger.image_url }} style={{ width: '100%', height: 120, marginBottom: 12 }} resizeMode="cover" />
                )}

                {/* Quick reply chips */}
                {(trigger.quick_replies?.length ?? 0) > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingBottom: 12 }}>
                    {trigger.quick_replies!.map((qr) => (
                      <View key={qr.payload} style={{ backgroundColor: C.navyFade, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.border }}>
                        <Text style={{ color: C.navy, fontSize: 11, fontWeight: '600' }}>{qr.title}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Footer */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {(trigger.fire_count ?? 0) > 0 && (
                      <>
                        <Ionicons name="flash" size={12} color={C.blue} />
                        <Text style={{ color: C.text3, fontSize: 11, fontWeight: '600' }}>
                          {trigger.fire_count}× fired
                          {trigger.last_fired_at ? ` · ${formatRelativeTime(trigger.last_fired_at)}` : ''}
                        </Text>
                      </>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Switch
                      value={trigger.is_active}
                      onValueChange={() => handleToggle(trigger)}
                      trackColor={{ false: C.border, true: C.blue }}
                      thumbColor={trigger.is_active ? C.white : C.text3}
                    />
                    <TouchableOpacity
                      onPress={() => navigation.navigate('CreateTrigger', { pageId, triggerId: trigger.id })}
                      activeOpacity={0.7}
                      style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.navyFade, alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}
                    >
                      <Ionicons name="pencil" size={15} color={C.navy} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(trigger)}
                      activeOpacity={0.7}
                      style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.redBg, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Ionicons name="trash" size={15} color={C.red} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
