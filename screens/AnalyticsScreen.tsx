import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MoreStackParamList } from "../navigation";
import { pagesApi, triggersApi } from "../lib/api";
import PageSwitcherPill from "../components/PageSwitcherPill";

type Props = NativeStackScreenProps<MoreStackParamList, "Analytics">;

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
  { key: 7, label: "7 days" },
  { key: 14, label: "14 days" },
  { key: 30, label: "30 days" },
] as const;

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export default function AnalyticsScreen({ route, navigation }: Props) {
  const { pageId, pageName } = route.params;
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState(7);
  const [topTriggers, setTopTriggers] = useState<
    { id: string; keywords: string[]; fire_count: number }[]
  >([]);

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [result, triggers] = await Promise.all([
        pagesApi.getAnalytics(pageId, days),
        triggersApi.getTop(pageId),
      ]);
      setData(result);
      setTopTriggers(triggers);
    } catch {
      setError("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [pageId, days]);

  async function onRefresh() {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  }

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const maxDaily = data
    ? Math.max(...data.daily_messages.map((d) => d.count), 1)
    : 1;

  return (
    <View className="flex-1 bg-[#F0F2F5]">
      <StatusBar style="dark" />

      {/* Header */}
      <View className="bg-white pt-14 pb-4 px-4 flex-row items-center border-b border-[#E4E6EB]">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={24} color="#1C1E21" />
        </TouchableOpacity>
        <Text className="flex-1 text-[#1C1E21] text-xl font-bold">Analytics</Text>
        <PageSwitcherPill
          currentPageId={pageId}
          currentPageName={pageName}
          onSwitch={(id, name) => navigation.replace('Analytics', { pageId: id, pageName: name })}
        />
      </View>

      {/* Date range selector */}
      <View className="flex-row gap-2 px-4 pt-3 pb-1">
        {DATE_RANGES.map((range) => {
          const active = days === range.key;
          return (
            <TouchableOpacity
              key={range.key}
              className={`rounded-xl px-3 py-1.5 ${active ? "bg-navy" : "bg-slate-200"}`}
              onPress={() => {
                if (!active) {
                  setDays(range.key);
                }
              }}
            >
              <Text
                className={`text-xs font-semibold ${active ? "text-cyan" : "text-slate-500"}`}
              >
                {range.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0E1C40" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cloud-offline" size={48} color="#cbd5e1" />
          <Text className="text-slate-400 text-base mt-3 text-center">
            {error}
          </Text>
          <TouchableOpacity
            className="mt-4 bg-navy rounded-xl px-6 py-3"
            onPress={loadAnalytics}
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : data ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#0E1C40"
            />
          }
        >
          {/* Top stat cards */}
          <View className="flex-row gap-3 mb-3">
            <StatCard
              icon="chatbubbles"
              label="Messages"
              value={data.messages_this_week}
              accent="#0E1C40"
              change={pctChange(
                data.messages_this_week,
                data.messages_last_week,
              )}
            />
            <StatCard
              icon="flash"
              label="Bot Handled"
              value={data.bot_handled_this_week}
              accent="#00C5FF"
            />
          </View>
          <View className="flex-row gap-3 mb-4">
            <StatCard
              icon="people"
              label="New Chats"
              value={data.new_conversations_this_week}
              accent="#1B3A6B"
            />
            <StatCard
              icon="person"
              label="Your Replies"
              value={data.owner_replies_this_week}
              accent="#0099CC"
            />
          </View>
          {data.avg_response_time_minutes !== null && (
            <View
              className="bg-white rounded-2xl p-4 mb-4"
              style={{
                shadowColor: "#0E1C40",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View className="flex-row items-center gap-2 mb-1">
                <View className="bg-cyan-light rounded-lg p-1.5">
                  <Ionicons name="timer-outline" size={16} color="#0E1C40" />
                </View>
                <Text className="text-navy font-semibold text-base">
                  Avg Response Time
                </Text>
              </View>
              <View className="flex-row items-end gap-2 mt-2">
                <Text className="text-navy text-4xl font-bold">
                  {data.avg_response_time_minutes < 60
                    ? data.avg_response_time_minutes
                    : Math.round(data.avg_response_time_minutes / 60)}
                </Text>
                <Text className="text-slate-400 text-base mb-1">
                  {data.avg_response_time_minutes < 60 ? "min" : "hrs"}
                </Text>
              </View>
              <Text className="text-slate-400 text-xs mt-1">
                Average time from customer message to first reply (bot or
                manual)
              </Text>
            </View>
          )}

          {/* Bot Efficiency */}
          <View
            className="bg-white rounded-2xl p-4 mb-4"
            style={{
              shadowColor: "#0E1C40",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View className="flex-row items-center gap-2 mb-3">
              <View className="bg-cyan-light rounded-lg p-1.5">
                <Ionicons name="flash" size={16} color="#0E1C40" />
              </View>
              <Text className="text-navy font-semibold text-base">
                Bot Efficiency
              </Text>
            </View>
            <View className="flex-row items-end gap-3 mb-2">
              <Text className="text-navy text-4xl font-bold">
                {data.bot_efficiency}%
              </Text>
              <Text className="text-slate-400 text-sm mb-1">
                of replies handled by Reili Bot
              </Text>
            </View>
            {/* Progress bar */}
            <View className="bg-slate-100 rounded-full h-3 overflow-hidden">
              <View
                className="bg-cyan h-3 rounded-full"
                style={{ width: `${data.bot_efficiency}%` }}
              />
            </View>
            <View className="flex-row justify-between mt-2">
              <Text className="text-slate-400 text-xs">
                {data.bot_handled_this_week} bot replies
              </Text>
              <Text className="text-slate-400 text-xs">
                {data.owner_replies_this_week} manual replies
              </Text>
            </View>
          </View>

          {/* 7-day chart */}
          <View
            className="bg-white rounded-2xl p-4 mb-4"
            style={{
              shadowColor: "#0E1C40",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View className="flex-row items-center gap-2 mb-4">
              <View className="bg-cyan-light rounded-lg p-1.5">
                <Ionicons name="bar-chart" size={16} color="#0E1C40" />
              </View>
              <Text className="text-navy font-semibold text-base">
                Messages per Day
              </Text>
            </View>
            <View
              className="flex-row items-end justify-between"
              style={{ height: 100 }}
            >
              {data.daily_messages.map((day, i) => {
                const barHeight =
                  maxDaily > 0
                    ? Math.max(
                        (day.count / maxDaily) * 80,
                        day.count > 0 ? 6 : 0,
                      )
                    : 0;
                const isToday = i === data.daily_messages.length - 1;
                return (
                  <View key={day.label} className="flex-1 items-center gap-1">
                    {day.count > 0 && (
                      <Text className="text-slate-400 text-xs">
                        {day.count}
                      </Text>
                    )}
                    <View className="w-full px-1">
                      <View
                        className={`rounded-t-lg ${isToday ? "bg-cyan" : "bg-navy-light"}`}
                        style={{
                          height: barHeight || 3,
                          opacity: isToday ? 1 : 0.5,
                        }}
                      />
                    </View>
                    <Text
                      className={`text-xs ${isToday ? "text-navy font-bold" : "text-slate-400"}`}
                    >
                      {day.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Week comparison */}
          <View
            className="bg-white rounded-2xl p-4 mb-4"
            style={{
              shadowColor: "#0E1C40",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View className="flex-row items-center gap-2 mb-3">
              <View className="bg-cyan-light rounded-lg p-1.5">
                <Ionicons name="trending-up" size={16} color="#0E1C40" />
              </View>
              <Text className="text-navy font-semibold text-base">
                Period Comparison
              </Text>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1 bg-slate-50 rounded-xl p-3">
                <Text className="text-slate-400 text-xs mb-1">This period</Text>
                <Text className="text-navy font-bold text-2xl">
                  {data.messages_this_week}
                </Text>
                <Text className="text-slate-400 text-xs">messages</Text>
              </View>
              <View className="items-center justify-center px-2">
                {(() => {
                  const change = pctChange(
                    data.messages_this_week,
                    data.messages_last_week,
                  );
                  const up = change >= 0;
                  return (
                    <View
                      className={`rounded-xl px-3 py-2 items-center ${up ? "bg-emerald-50" : "bg-red-50"}`}
                    >
                      <Ionicons
                        name={up ? "trending-up" : "trending-down"}
                        size={18}
                        color={up ? "#10b981" : "#ef4444"}
                      />
                      <Text
                        className={`text-xs font-bold mt-0.5 ${up ? "text-emerald-600" : "text-red-500"}`}
                      >
                        {up ? "+" : ""}
                        {change}%
                      </Text>
                    </View>
                  );
                })()}
              </View>
              <View className="flex-1 bg-slate-50 rounded-xl p-3">
                <Text className="text-slate-400 text-xs mb-1">Prev period</Text>
                <Text className="text-navy font-bold text-2xl">
                  {data.messages_last_week}
                </Text>
                <Text className="text-slate-400 text-xs">messages</Text>
              </View>
            </View>
          </View>

          {/* Top Triggers Leaderboard */}
          {topTriggers.length > 0 && (
            <View
              className="bg-white rounded-2xl p-4 mb-4"
              style={{
                shadowColor: "#0E1C40",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View className="flex-row items-center gap-2 mb-3">
                <View className="bg-cyan-light rounded-lg p-1.5">
                  <Ionicons name="trophy" size={16} color="#0E1C40" />
                </View>
                <Text className="text-navy font-semibold text-base">
                  Most Asked
                </Text>
              </View>
              {topTriggers.map((trigger, index) => {
                const maxFires = topTriggers[0]?.fire_count ?? 1;
                const barWidth = Math.max(
                  (trigger.fire_count / maxFires) * 100,
                  8,
                );
                return (
                  <View key={trigger.id} className="mb-2.5">
                    <View className="flex-row items-center justify-between mb-1">
                      <View className="flex-row items-center gap-2 flex-1 mr-2">
                        <Text className="text-slate-400 text-xs font-bold w-5">
                          {index + 1}
                        </Text>
                        <Text
                          className="text-navy text-sm font-medium flex-1"
                          numberOfLines={1}
                        >
                          {trigger.keywords.join(", ")}
                        </Text>
                      </View>
                      <Text className="text-slate-500 text-xs font-semibold">
                        {trigger.fire_count}×
                      </Text>
                    </View>
                    <View className="ml-7 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <View
                        className={`h-2 rounded-full ${index === 0 ? "bg-cyan" : "bg-navy-light"}`}
                        style={{
                          width: `${barWidth}%`,
                          opacity: index === 0 ? 1 : 0.5,
                        }}
                      />
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

function StatCard({
  icon,
  label,
  value,
  accent,
  change,
}: {
  icon: any;
  label: string;
  value: number;
  accent: string;
  change?: number;
}) {
  return (
    <View
      className="flex-1 bg-white rounded-2xl p-4"
      style={{
        shadowColor: "#0E1C40",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 1,
      }}
    >
      <View
        className="w-8 h-8 rounded-lg items-center justify-center mb-2"
        style={{ backgroundColor: accent + "18" }}
      >
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text className="text-navy text-2xl font-bold">{value}</Text>
      <Text className="text-slate-400 text-xs mt-0.5">{label}</Text>
      {change !== undefined && (
        <Text
          className={`text-xs font-semibold mt-1 ${change >= 0 ? "text-emerald-500" : "text-red-400"}`}
        >
          {change >= 0 ? "+" : ""}
          {change}% vs prev period
        </Text>
      )}
    </View>
  );
}
