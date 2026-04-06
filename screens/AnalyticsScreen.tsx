import {
  View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../navigation';
import { pagesApi, triggersApi } from '../lib/api';
import PageSwitcherPill from '../components/PageSwitcherPill';

type Props = NativeStackScreenProps<MoreStackParamList, 'Analytics'>;

type Analytics = {
  messages_this_week: number;
  messages_last_week: number;
  bot_handled_this_week: number;
  owner_replies_this_week: number;
  new_conversations_this_week: number;
  bot_efficiency: number;
  avg_response_time_minutes: number | null;
  daily_messages: { label: string; count: number }[];
};

const DATE_RANGES = [
  { key: 7,  label: '7 days'  },
  { key: 14, label: '14 days' },
  { key: 30, label: '30 days' },
] as const;

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

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function StatCard({ icon, label, value, color, change }: { icon: any; label: string; value: number; color: string; change?: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border, shadowColor: C.navy, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12, backgroundColor: `${color}15`, borderWidth: 1, borderColor: `${color}25` }}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <Text style={{ color: C.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ color: C.text3, fontSize: 11, marginTop: 3, fontWeight: '600' }}>{label}</Text>
      {change !== undefined && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 }}>
          <Ionicons name={change >= 0 ? 'trending-up' : 'trending-down'} size={11} color={change >= 0 ? C.green : C.red} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: change >= 0 ? C.green : C.red }}>
            {change >= 0 ? '+' : ''}{change}%
          </Text>
        </View>
      )}
    </View>
  );
}

export default function AnalyticsScreen({ route, navigation }: Props) {
  const { pageId, pageName } = route.params;
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [days, setDays] = useState(7);
  const [topTriggers, setTopTriggers] = useState<{ id: string; keywords: string[]; fire_count: number }[]>([]);

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const [result, triggers] = await Promise.all([pagesApi.getAnalytics(pageId, days), triggersApi.getTop(pageId)]);
      setData(result); setTopTriggers(triggers);
    } catch { setError('Failed to load analytics'); }
    finally { setLoading(false); }
  }, [pageId, days]);

  async function onRefresh() { setRefreshing(true); await loadAnalytics(); setRefreshing(false); }
  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const maxDaily = data ? Math.max(...data.daily_messages.map((d) => d.count), 1) : 1;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />

      {/* Header — navy with date range pills */}
      <View style={{ backgroundColor: C.navy, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.75} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={{ flex: 1, color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>Analytics</Text>
          <PageSwitcherPill
            currentPageId={pageId}
            currentPageName={pageName}
            onSwitch={(id, name) => navigation.replace('Analytics', { pageId: id, pageName: name })}
          />
        </View>
        {/* Date range pills */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {DATE_RANGES.map((range) => {
            const active = days === range.key;
            return (
              <TouchableOpacity
                key={range.key}
                onPress={() => { if (!active) setDays(range.key); }}
                activeOpacity={0.8}
                style={{ borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.18)' }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: active ? C.navy : 'rgba(255,255,255,0.85)' }}>{range.label}</Text>
              </TouchableOpacity>
            );
          })}
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
          <TouchableOpacity style={{ marginTop: 16, backgroundColor: C.navy, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }} onPress={loadAnalytics}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : data ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}>

          {/* Top stat cards */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <StatCard icon="chatbubbles" label="Messages"    value={data.messages_this_week}          color={C.navy}  change={pctChange(data.messages_this_week, data.messages_last_week)} />
            <StatCard icon="flash"       label="Bot Handled" value={data.bot_handled_this_week}       color={C.blue} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <StatCard icon="people"      label="New Chats"   value={data.new_conversations_this_week} color={C.green} />
            <StatCard icon="person"      label="Your Replies" value={data.owner_replies_this_week}    color={C.text2} />
          </View>

          {/* Avg response time */}
          {data.avg_response_time_minutes !== null && (
            <View style={{ backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="timer-outline" size={15} color={C.navy} />
                </View>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>Avg Response Time</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 4 }}>
                <Text style={{ color: C.text, fontSize: 36, fontWeight: '800' }}>
                  {data.avg_response_time_minutes < 60 ? data.avg_response_time_minutes : Math.round(data.avg_response_time_minutes / 60)}
                </Text>
                <Text style={{ color: C.text3, fontSize: 14, marginBottom: 4 }}>
                  {data.avg_response_time_minutes < 60 ? 'min' : 'hrs'}
                </Text>
              </View>
              <Text style={{ color: C.text3, fontSize: 11, marginTop: 4 }}>Average time from message to first reply</Text>
            </View>
          )}

          {/* Bot Efficiency */}
          <View style={{ backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="flash" size={15} color={C.navy} />
              </View>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>Bot Efficiency</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
              <Text style={{ color: C.text, fontSize: 36, fontWeight: '800' }}>{data.bot_efficiency}%</Text>
              <Text style={{ color: C.text3, fontSize: 13, marginBottom: 4 }}>of replies handled by Reili</Text>
            </View>
            {/* Progress bar */}
            <View style={{ backgroundColor: C.light, borderRadius: 99, height: 8, overflow: 'hidden' }}>
              <View style={{ backgroundColor: C.blue, height: 8, borderRadius: 99, width: `${data.bot_efficiency}%` }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: C.text3, fontSize: 11 }}>{data.bot_handled_this_week} bot replies</Text>
              <Text style={{ color: C.text3, fontSize: 11 }}>{data.owner_replies_this_week} manual</Text>
            </View>
          </View>

          {/* Daily chart */}
          <View style={{ backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="bar-chart" size={15} color={C.navy} />
              </View>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>Messages per Day</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 100 }}>
              {data.daily_messages.map((day, i) => {
                const barHeight = maxDaily > 0 ? Math.max((day.count / maxDaily) * 80, day.count > 0 ? 6 : 0) : 0;
                const isToday = i === data.daily_messages.length - 1;
                return (
                  <View key={day.label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    {day.count > 0 && <Text style={{ color: C.text3, fontSize: 10 }}>{day.count}</Text>}
                    <View style={{ width: '100%', paddingHorizontal: 3 }}>
                      <View style={{ height: barHeight || 3, borderRadius: 4, backgroundColor: isToday ? C.blue : C.light }} />
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: isToday ? '800' : '400', color: isToday ? C.blue : C.text3 }}>{day.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Period comparison */}
          <View style={{ backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="trending-up" size={15} color={C.navy} />
              </View>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>Period Comparison</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, backgroundColor: C.bg, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ color: C.text3, fontSize: 11, marginBottom: 4 }}>This period</Text>
                <Text style={{ color: C.text, fontWeight: '800', fontSize: 22 }}>{data.messages_this_week}</Text>
                <Text style={{ color: C.text3, fontSize: 11 }}>messages</Text>
              </View>
              {(() => {
                const change = pctChange(data.messages_this_week, data.messages_last_week);
                const up = change >= 0;
                return (
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
                    <View style={{ borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', backgroundColor: up ? C.greenBg : C.redBg, borderWidth: 1, borderColor: up ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.18)' }}>
                      <Ionicons name={up ? 'trending-up' : 'trending-down'} size={17} color={up ? C.green : C.red} />
                      <Text style={{ fontSize: 11, fontWeight: '800', marginTop: 2, color: up ? C.green : C.red }}>{up ? '+' : ''}{change}%</Text>
                    </View>
                  </View>
                );
              })()}
              <View style={{ flex: 1, backgroundColor: C.bg, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ color: C.text3, fontSize: 11, marginBottom: 4 }}>Prev period</Text>
                <Text style={{ color: C.text, fontWeight: '800', fontSize: 22 }}>{data.messages_last_week}</Text>
                <Text style={{ color: C.text3, fontSize: 11 }}>messages</Text>
              </View>
            </View>
          </View>

          {/* Top triggers */}
          {topTriggers.length > 0 && (
            <View style={{ backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="trophy" size={15} color={C.navy} />
                </View>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>Most Asked</Text>
              </View>
              {topTriggers.map((trigger, index) => {
                const maxFires = topTriggers[0]?.fire_count ?? 1;
                const barWidth = Math.max((trigger.fire_count / maxFires) * 100, 8);
                return (
                  <View key={trigger.id} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
                        <Text style={{ color: C.text3, fontSize: 11, fontWeight: '800', width: 18 }}>{index + 1}</Text>
                        <Text style={{ color: C.text, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                          {trigger.keywords.join(', ')}
                        </Text>
                      </View>
                      <Text style={{ color: C.text2, fontSize: 12, fontWeight: '700' }}>{trigger.fire_count}×</Text>
                    </View>
                    <View style={{ marginLeft: 26, backgroundColor: C.light, borderRadius: 99, height: 6, overflow: 'hidden' }}>
                      <View style={{ height: 6, borderRadius: 99, width: `${barWidth}%`, backgroundColor: C.blue }} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}
