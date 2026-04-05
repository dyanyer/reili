import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Switch,
  Image,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MoreStackParamList } from "../navigation";
import { broadcastsApi, pagesApi } from "../lib/api";
import PageSwitcherPill from "../components/PageSwitcherPill";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { uploadImageToCloudinary } from "../lib/cloudinary";

type Props = NativeStackScreenProps<MoreStackParamList, "Broadcast">;

type Broadcast = {
  id: string;
  message_text: string;
  image_url: string | null;
  status: "sending" | "done" | "pending" | "failed" | "scheduled";
  sent_count: number;
  total_count: number;
  created_at: string;
  scheduled_at: string | null;
  segment: string | null;
};

const SEGMENTS = [
  {
    key: "all",
    label: "All Contacts",
    icon: "people",
    desc: "Everyone who has messaged",
  },
  {
    key: "active_7d",
    label: "Active (7 days)",
    icon: "time",
    desc: "Messaged in the last week",
  },
  {
    key: "with_orders",
    label: "Customers",
    icon: "cart",
    desc: "Placed at least 1 order",
  },
  {
    key: "without_orders",
    label: "No Orders",
    icon: "chatbubble-ellipses",
    desc: "Never ordered — re-engage",
  },
] as const;

const STATUS_CONFIG = {
  sending: {
    label: "Sending...",
    color: "bg-amber-100",
    text: "text-amber-700",
    icon: "time",
  },
  done: {
    label: "Sent",
    color: "bg-emerald-100",
    text: "text-emerald-700",
    icon: "checkmark-circle",
  },
  pending: {
    label: "Pending",
    color: "bg-slate-100",
    text: "text-slate-500",
    icon: "hourglass",
  },
  failed: {
    label: "Failed",
    color: "bg-red-100",
    text: "text-red-600",
    icon: "close-circle",
  },
  scheduled: {
    label: "Scheduled",
    color: "bg-blue-100",
    text: "text-blue-700",
    icon: "calendar",
  },
} as const;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatScheduled(dateStr: string) {
  return new Date(dateStr).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BroadcastScreen({ route, navigation }: Props) {
  const { pageId, pageName } = route.params;
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [segment, setSegment] = useState<string>("all");
  const [segmentCounts, setSegmentCounts] = useState<Record<string, number>>(
    {},
  );
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Scheduling state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const load = useCallback(async () => {
    try {
      setHistoryError("");
      const [history, stats, counts] = await Promise.all([
        broadcastsApi.getAll(pageId),
        pagesApi.getStats(pageId),
        broadcastsApi.getRecipientCounts(pageId),
      ]);
      setBroadcasts(history);
      setContactCount(stats.conversation_count);
      setSegmentCounts(counts);
    } catch {
      setHistoryError("Failed to load broadcast history.");
    } finally {
      setLoadingHistory(false);
    }
  }, [pageId]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useEffect(() => {
    load();
  }, [load]);

  async function handleSend() {
    const text = messageText.trim();
    if (!text && !pendingImage) return;

    const segCount = segmentCounts[segment] ?? contactCount ?? 0;

    if (segCount === 0) {
      Alert.alert("No contacts", "No contacts match this segment.");
      return;
    }

    if (scheduleEnabled && scheduledAt <= new Date()) {
      Alert.alert("Invalid time", "Scheduled time must be in the future.");
      return;
    }

    const segLabel = SEGMENTS.find((s) => s.key === segment)?.label ?? "All";
    const scheduledLabel = scheduleEnabled
      ? `scheduled for ${formatScheduled(scheduledAt.toISOString())}`
      : `sent now to ${segCount} contact${segCount !== 1 ? "s" : ""} (${segLabel})`;

    Alert.alert(
      scheduleEnabled ? "Schedule Broadcast" : "Send Broadcast",
      `This message will be ${scheduledLabel}. Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: scheduleEnabled ? "Schedule" : "Send",
          onPress: async () => {
            setSending(true);

            let imageUrl: string | undefined;
            if (pendingImage) {
              setUploadingImage(true);
              try {
                imageUrl = await uploadImageToCloudinary(pendingImage);
              } catch {
                Alert.alert("Error", "Failed to upload image");
                setUploadingImage(false);
                setSending(false);
                return;
              }
              setUploadingImage(false);
            }

            try {
              const result = await broadcastsApi.send(
                pageId,
                text,
                scheduleEnabled ? scheduledAt.toISOString() : undefined,
                segment,
                imageUrl,
              );
              setMessageText("");
              setPendingImage(null);
              setScheduleEnabled(false);
              setBroadcasts((prev) => [result, ...prev]);
              Alert.alert(
                scheduleEnabled ? "Broadcast scheduled!" : "Broadcast started",
                scheduleEnabled
                  ? `Will send on ${formatScheduled(scheduledAt.toISOString())}.`
                  : `Sending to ${result.total_count} contacts. Check the history below for progress.`,
              );
            } catch {
              Alert.alert(
                "Error",
                "Failed to send broadcast. Please try again.",
              );
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  }

  const minDate = new Date();

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="flex-1 bg-[#F6F6F6]">
        <StatusBar style="dark" />

        {/* Header */}
        <View className="bg-white pt-14 pb-4 px-4 flex-row items-center border-b border-[#E4E6EB]">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 p-1">
            <Ionicons name="arrow-back" size={24} color="#1C1E21" />
          </TouchableOpacity>
          <Text className="flex-1 text-[#1C1E21] text-xl font-bold">Broadcast</Text>
          <PageSwitcherPill
            currentPageId={pageId}
            currentPageName={pageName}
            onSwitch={(id, name) => navigation.replace("Broadcast", { pageId: id, pageName: name })}
          />
          {contactCount !== null && (
            <View className="bg-navy rounded-lg px-2 py-1">
              <Text className="text-cyan text-xs font-semibold">
                {contactCount} contacts
              </Text>
            </View>
          )}
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#163172"
            />
          }
        >
          {/* Compose card */}
          <View
            className="bg-white rounded-2xl p-4 mb-4"
            style={{
              shadowColor: "#163172",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View className="flex-row items-center gap-2 mb-1">
              <View className="bg-cyan-light rounded-lg p-1.5">
                <Ionicons name="megaphone" size={16} color="#163172" />
              </View>
              <Text className="text-navy font-semibold text-base">
                New Broadcast
              </Text>
            </View>
            <Text className="text-slate-400 text-xs mb-3 leading-4">
              Send a message to your contacts. Choose a segment below to target
              the right audience.
            </Text>

            <TextInput
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-navy text-sm"
              value={messageText}
              onChangeText={setMessageText}
              placeholder={
                "E.g. Sale ngayon! 50% off lahat ng items 🔥\n\nMessage lang para mag-order!"
              }
              placeholderTextColor="#94a3b8"
              multiline
              maxLength={2000}
              textAlignVertical="top"
              style={{ minHeight: 120 }}
            />
            <View className="flex-row justify-between items-center mt-2 mb-4">
              <Text className="text-slate-400 text-xs">
                {messageText.length}/2000
              </Text>
              <TouchableOpacity
                className="flex-row items-center gap-1 bg-slate-50 rounded-lg px-3 py-1.5"
                onPress={async () => {
                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.7,
                    allowsEditing: true,
                  });
                  if (!result.canceled && result.assets?.[0]) {
                    setPendingImage(result.assets[0].uri);
                  }
                }}
              >
                <Ionicons name="image-outline" size={14} color="#163172" />
                <Text className="text-navy text-xs font-medium">Add Image</Text>
              </TouchableOpacity>
            </View>
            {pendingImage && (
              <View className="flex-row items-center mb-4 gap-2">
                <Image
                  source={{ uri: pendingImage }}
                  className="w-20 h-20 rounded-xl"
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={() => setPendingImage(null)}
                  className="p-1"
                >
                  <Ionicons name="close-circle" size={22} color="#ef4444" />
                </TouchableOpacity>
                {uploadingImage && (
                  <ActivityIndicator size="small" color="#163172" />
                )}
              </View>
            )}

            {/* Segment selector */}
            <View className="border-t border-slate-100 pt-4 mb-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Ionicons name="filter" size={14} color="#163172" />
                <Text className="text-navy font-semibold text-sm">Send to</Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {SEGMENTS.map((seg) => {
                  const active = segment === seg.key;
                  const count = segmentCounts[seg.key];
                  return (
                    <TouchableOpacity
                      key={seg.key}
                      className={`rounded-xl px-3 py-2 flex-row items-center gap-1.5 ${active ? "bg-navy" : "bg-slate-100"}`}
                      onPress={() => setSegment(seg.key)}
                    >
                      <Ionicons
                        name={seg.icon as any}
                        size={13}
                        color={active ? "#D6E4F0" : "#64748b"}
                      />
                      <Text
                        className={`text-xs font-semibold ${active ? "text-white" : "text-slate-600"}`}
                      >
                        {seg.label}
                      </Text>
                      {count !== undefined && (
                        <View
                          className={`rounded-full px-1.5 py-0.5 ${active ? "bg-cyan" : "bg-slate-200"}`}
                        >
                          <Text
                            className={`text-xs font-bold ${active ? "text-navy" : "text-slate-500"}`}
                          >
                            {count}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {segment !== "all" && (
                <Text className="text-slate-400 text-xs mt-1.5 ml-1">
                  {SEGMENTS.find((s) => s.key === segment)?.desc}
                </Text>
              )}
            </View>

            {/* Schedule toggle */}
            <View className="border-t border-slate-100 pt-4 mb-4">
              <View className="flex-row items-center justify-between mb-1">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="calendar-outline" size={16} color="#163172" />
                  <Text className="text-navy font-semibold text-sm">
                    Schedule for later
                  </Text>
                </View>
                <Switch
                  value={scheduleEnabled}
                  onValueChange={setScheduleEnabled}
                  trackColor={{ false: "#e2e8f0", true: "#163172" }}
                  thumbColor={scheduleEnabled ? "#D6E4F0" : "#94a3b8"}
                />
              </View>
              <Text className="text-slate-400 text-xs leading-4 mb-3">
                {scheduleEnabled
                  ? "Will send at the time below."
                  : "Off — broadcast sends immediately."}
              </Text>

              {scheduleEnabled && (
                <View className="flex-row gap-2">
                  {/* Date picker trigger */}
                  <TouchableOpacity
                    className="flex-1 flex-row items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-3"
                    onPress={() => {
                      setShowTimePicker(false);
                      setShowDatePicker(true);
                    }}
                  >
                    <Ionicons name="calendar" size={14} color="#163172" />
                    <Text className="text-navy text-sm font-medium">
                      {scheduledAt.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                  </TouchableOpacity>

                  {/* Time picker trigger */}
                  <TouchableOpacity
                    className="flex-1 flex-row items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-3"
                    onPress={() => {
                      setShowDatePicker(false);
                      setShowTimePicker(true);
                    }}
                  >
                    <Ionicons name="time-outline" size={14} color="#163172" />
                    <Text className="text-navy text-sm font-medium">
                      {scheduledAt.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {showDatePicker && (
                <DateTimePicker
                  value={scheduledAt}
                  mode="date"
                  minimumDate={minDate}
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    if (date) {
                      const updated = new Date(scheduledAt);
                      updated.setFullYear(
                        date.getFullYear(),
                        date.getMonth(),
                        date.getDate(),
                      );
                      setScheduledAt(updated);
                    }
                  }}
                />
              )}
              {showTimePicker && (
                <DateTimePicker
                  value={scheduledAt}
                  mode="time"
                  onChange={(_, date) => {
                    setShowTimePicker(false);
                    if (date) {
                      const updated = new Date(scheduledAt);
                      updated.setHours(
                        date.getHours(),
                        date.getMinutes(),
                        0,
                        0,
                      );
                      setScheduledAt(updated);
                    }
                  }}
                />
              )}
            </View>

            <TouchableOpacity
              className={`rounded-2xl py-4 items-center flex-row justify-center gap-2 ${
                messageText.trim().length > 0 || pendingImage
                  ? "bg-navy"
                  : "bg-slate-200"
              }`}
              onPress={handleSend}
              disabled={(!messageText.trim() && !pendingImage) || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#D6E4F0" />
              ) : (
                <>
                  <Ionicons
                    name={scheduleEnabled ? "calendar" : "send"}
                    size={18}
                    color={
                      messageText.trim().length > 0 || pendingImage
                        ? "#D6E4F0"
                        : "#94a3b8"
                    }
                  />
                  <Text
                    className={`font-bold text-base ${messageText.trim().length > 0 || pendingImage ? "text-white" : "text-slate-400"}`}
                  >
                    {scheduleEnabled
                      ? "Schedule Broadcast"
                      : `Send to ${segmentCounts[segment] ?? contactCount ?? "..."} contacts`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Info banner */}
          <View className="bg-cyan-light rounded-2xl p-4 flex-row gap-3 mb-5">
            <Ionicons name="information-circle" size={20} color="#163172" />
            <Text className="text-navy text-xs flex-1 leading-5">
              Messages are sent one by one with a short delay to stay within
              Facebook's limits and keep your page safe.
            </Text>
          </View>

          {/* History */}
          <Text className="text-navy text-base font-bold mb-3">
            Broadcast History
          </Text>

          {loadingHistory ? (
            <ActivityIndicator size="small" color="#163172" />
          ) : historyError ? (
            <View className="items-center py-8">
              <Ionicons name="cloud-offline" size={36} color="#cbd5e1" />
              <Text className="text-slate-400 text-sm mt-2 text-center">
                {historyError}
              </Text>
              <TouchableOpacity
                className="mt-3 bg-navy rounded-xl px-5 py-2"
                onPress={load}
              >
                <Text className="text-white text-sm font-semibold">
                  Try Again
                </Text>
              </TouchableOpacity>
            </View>
          ) : broadcasts.length === 0 ? (
            <View className="items-center py-10">
              <View className="bg-cyan-light rounded-full p-5 mb-3">
                <Ionicons name="megaphone-outline" size={32} color="#163172" />
              </View>
              <Text className="text-slate-400 text-sm text-center">
                No broadcasts sent yet.
              </Text>
            </View>
          ) : (
            broadcasts.map((b) => {
              const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending;
              return (
                <View
                  key={b.id}
                  className="bg-white rounded-2xl p-4 mb-3"
                  style={{
                    shadowColor: "#163172",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 6,
                    elevation: 1,
                  }}
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View
                      className={`rounded-full px-3 py-1 flex-row items-center gap-1 ${cfg.color}`}
                    >
                      <Ionicons name={cfg.icon as any} size={12} color="" />
                      <Text className={`text-xs font-semibold ${cfg.text}`}>
                        {cfg.label}
                      </Text>
                    </View>
                    <Text className="text-slate-400 text-xs">
                      {formatDate(b.created_at)}
                    </Text>
                  </View>
                  <Text
                    className="text-navy text-sm mb-2 leading-5"
                    numberOfLines={3}
                  >
                    {b.message_text}
                  </Text>
                  {b.image_url && (
                    <View className="flex-row items-center gap-1 mb-2">
                      <Ionicons name="image" size={12} color="#D6E4F0" />
                      <Text className="text-cyan text-xs font-medium">
                        Image attached
                      </Text>
                    </View>
                  )}
                  {b.segment && b.segment !== "all" && (
                    <View className="flex-row items-center gap-1 mb-2">
                      <Ionicons name="filter" size={11} color="#64748b" />
                      <Text className="text-slate-400 text-xs">
                        {SEGMENTS.find((s) => s.key === b.segment)?.label ??
                          b.segment}
                      </Text>
                    </View>
                  )}
                  {b.status === "scheduled" && b.scheduled_at ? (
                    <View className="flex-row items-center gap-1">
                      <Ionicons
                        name="calendar-outline"
                        size={13}
                        color="#3b82f6"
                      />
                      <Text className="text-blue-600 text-xs">
                        Sends {formatScheduled(b.scheduled_at)}
                      </Text>
                    </View>
                  ) : (
                    <View className="flex-row items-center gap-1">
                      <Ionicons
                        name="people-outline"
                        size={13}
                        color="#94a3b8"
                      />
                      <Text className="text-slate-400 text-xs">
                        {b.sent_count} / {b.total_count} sent
                      </Text>
                      {b.status === "sending" && (
                        <ActivityIndicator
                          size="small"
                          color="#f59e0b"
                          style={{ marginLeft: 4 }}
                        />
                      )}
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
