import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MoreStackParamList } from "../navigation";
import { triggersApi } from "../lib/api";
import PageSwitcherPill from "../components/PageSwitcherPill";

type Props = NativeStackScreenProps<MoreStackParamList, "Triggers">;

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

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const TRIGGER_TEMPLATES: {
  label: string;
  emoji: string;
  keywords: string[];
  response_text: string;
}[] = [
  {
    label: "Price Inquiry",
    emoji: "💰",
    keywords: ["magkano", "presyo", "price", "how much"],
    response_text:
      "Heto ang aming mga presyo:\n\n• Item 1 — ₱XXX\n• Item 2 — ₱XXX\n\nMay ibang tanong? 😊",
  },
  {
    label: "Stock Check",
    emoji: "📦",
    keywords: ["available", "meron pa", "mayroon", "stock"],
    response_text:
      'Oo, available pa po! 🎉 Kung gusto mo mag-order, i-type mo lang "order" at gagabayan kita. 😊',
  },
  {
    label: "How to Order",
    emoji: "🛍️",
    keywords: ["paano mag-order", "how to order", "pano order"],
    response_text:
      'Simple lang ang pag-order! I-type mo lang ang salitang "order" at sasabihan kita kung anong susunod. 👇',
  },
  {
    label: "Delivery Info",
    emoji: "🚚",
    keywords: ["delivery", "shipping", "padala", "kailan madeliver"],
    response_text:
      "Nagde-deliver kami nationwide! 🇵🇭\n\n📅 Processing: 1-2 araw\n🚚 Shipping: 3-5 araw\n\nMayroon ding same-day para sa Metro Manila. 😊",
  },
  {
    label: "Payment Methods",
    emoji: "💳",
    keywords: ["gcash", "payment", "bayad", "paano magbayad"],
    response_text:
      "Tinatanggap namin ang:\n\n💚 GCash\n🏦 Bank Transfer (BDO / BPI)\n💵 COD (Cash on Delivery)\n\nAlin ang gusto mo? 😊",
  },
  {
    label: "Location / Address",
    emoji: "📍",
    keywords: ["location", "address", "saan kayo", "nasaan"],
    response_text:
      "Narito ang aming location:\n\n📍 [ilagay mo ang address dito]\n\n🕐 Open hours: [ilagay mo oras]\n\nKita-kits po! 😊",
  },
];

export default function TriggersScreen({ route, navigation }: Props) {
  const { pageId, pageName } = route.params;
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadTriggers = useCallback(async () => {
    try {
      setError("");
      const data = await triggersApi.getAll(pageId);
      setTriggers(data);
    } catch {
      setError("Failed to load triggers");
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  async function onRefresh() {
    setRefreshing(true);
    await loadTriggers();
    setRefreshing(false);
  }

  useEffect(() => {
    loadTriggers();
  }, [loadTriggers]);
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadTriggers);
    return unsubscribe;
  }, [navigation, loadTriggers]);

  async function handleToggle(trigger: Trigger) {
    try {
      const updated = await triggersApi.toggle(pageId, trigger.id);
      setTriggers((prev) =>
        prev.map((t) => (t.id === trigger.id ? updated : t)),
      );
    } catch {
      Alert.alert("Error", "Failed to update trigger");
    }
  }

  async function handleDelete(trigger: Trigger) {
    Alert.alert(
      "Delete Trigger",
      `Delete the trigger for "${trigger.keywords[0]}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await triggersApi.delete(pageId, trigger.id);
              setTriggers((prev) => prev.filter((t) => t.id !== trigger.id));
            } catch {
              Alert.alert("Error", "Failed to delete trigger");
            }
          },
        },
      ],
    );
  }

  async function handleMove(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= triggers.length) return;
    const reordered = [...triggers];
    [reordered[index], reordered[newIndex]] = [
      reordered[newIndex],
      reordered[index],
    ];
    setTriggers(reordered); // optimistic
    try {
      await triggersApi.reorder(
        pageId,
        reordered.map((t) => t.id),
      );
    } catch {
      setTriggers(triggers); // revert
      Alert.alert("Error", "Failed to reorder triggers");
    }
  }

  return (
    <View className="flex-1 bg-[#F0F2F5]">
      <StatusBar style="dark" />

      {/* Header */}
      <View className="bg-white pt-14 pb-4 px-4 flex-row items-center border-b border-[#E4E6EB]">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={24} color="#1C1E21" />
        </TouchableOpacity>
        <Text className="flex-1 text-[#1C1E21] text-xl font-bold">Triggers</Text>
        <View className="flex-row items-center gap-1">
          <PageSwitcherPill
            currentPageId={pageId}
            currentPageName={pageName}
            onSwitch={(id, name) => navigation.replace('Triggers', { pageId: id, pageName: name })}
          />
          <TouchableOpacity
            className="bg-navy rounded-xl px-4 py-2 flex-row items-center gap-1"
            onPress={() => navigation.navigate("CreateTrigger", { pageId })}
          >
            <Ionicons name="add" size={16} color="#00C5FF" />
            <Text className="text-white text-sm font-bold">Add</Text>
          </TouchableOpacity>
        </View>
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
            onPress={loadTriggers}
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
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
          {/* Info banner */}
          <View className="bg-cyan-light rounded-2xl p-4 flex-row items-start gap-3 mb-4">
            <Ionicons name="information-circle" size={18} color="#0E1C40" />
            <Text className="text-navy text-sm flex-1 leading-5">
              When a customer's message contains your keyword, the bot replies
              automatically.
            </Text>
          </View>

          {triggers.length === 0 ? (
            <View>
              <View className="items-center pt-8 pb-6">
                <View className="bg-cyan-light rounded-full p-5 mb-3">
                  <Ionicons
                    name="chatbubble-outline"
                    size={32}
                    color="#0E1C40"
                  />
                </View>
                <Text className="text-navy font-semibold text-base">
                  No triggers yet
                </Text>
                <Text className="text-slate-400 text-sm mt-1 text-center px-8 leading-5">
                  Start from scratch or use one of these templates 👇
                </Text>
              </View>

              <Text className="text-navy text-sm font-bold mb-3">
                Starter Templates
              </Text>

              {TRIGGER_TEMPLATES.map((t) => (
                <View
                  key={t.label}
                  className="bg-white rounded-2xl p-4 mb-3"
                  style={{
                    shadowColor: "#0E1C40",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <View className="flex-row items-center gap-2 mb-2">
                    <Text className="text-lg">{t.emoji}</Text>
                    <Text className="text-navy font-semibold text-sm flex-1">
                      {t.label}
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap gap-1.5 mb-2">
                    {t.keywords.map((kw) => (
                      <View
                        key={kw}
                        className="bg-cyan-light rounded-lg px-2.5 py-1"
                      >
                        <Text className="text-navy text-xs font-medium">
                          {kw}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text
                    className="text-slate-500 text-xs leading-4 mb-3"
                    numberOfLines={2}
                  >
                    {t.response_text}
                  </Text>
                  <TouchableOpacity
                    className="bg-navy rounded-xl py-2.5 items-center"
                    onPress={async () => {
                      try {
                        const created = await triggersApi.create(pageId, {
                          keywords: t.keywords,
                          response_text: t.response_text,
                        });
                        setTriggers((prev) => [...prev, created]);
                      } catch {
                        Alert.alert("Error", "Failed to create trigger");
                      }
                    }}
                  >
                    <Text className="text-white text-xs font-semibold">
                      Use This Template
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                className="mt-2 bg-cyan-light rounded-2xl py-3 flex-row items-center justify-center gap-2"
                onPress={() => navigation.navigate("CreateTrigger", { pageId })}
              >
                <Ionicons name="add" size={16} color="#0E1C40" />
                <Text className="text-navy text-sm font-semibold">
                  Create Custom Trigger
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            triggers.map((trigger, triggerIndex) => (
              <View
                key={trigger.id}
                className="bg-white rounded-2xl p-4 mb-3"
                style={{
                  shadowColor: "#0E1C40",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                {/* Priority + Keywords */}
                <View className="flex-row items-center gap-2 mb-3">
                  {triggers.length > 1 && (
                    <View className="items-center mr-1">
                      <TouchableOpacity
                        onPress={() => handleMove(triggerIndex, "up")}
                        disabled={triggerIndex === 0}
                        className="p-0.5"
                      >
                        <Ionicons
                          name="chevron-up"
                          size={16}
                          color={triggerIndex === 0 ? "#e2e8f0" : "#0E1C40"}
                        />
                      </TouchableOpacity>
                      <Text className="text-slate-300 text-xs font-bold">
                        {triggerIndex + 1}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleMove(triggerIndex, "down")}
                        disabled={triggerIndex === triggers.length - 1}
                        className="p-0.5"
                      >
                        <Ionicons
                          name="chevron-down"
                          size={16}
                          color={
                            triggerIndex === triggers.length - 1
                              ? "#e2e8f0"
                              : "#0E1C40"
                          }
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                  <View className="flex-row flex-wrap gap-2 flex-1">
                    {trigger.keywords.map((kw) => (
                      <View
                        key={kw}
                        className="bg-cyan-light rounded-lg px-3 py-1"
                      >
                        <Text className="text-navy text-xs font-semibold">
                          {kw}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Reply preview */}
                <Text
                  className="text-slate-500 text-sm leading-5 mb-3"
                  numberOfLines={2}
                >
                  {trigger.response_text}
                </Text>

                {/* Image thumbnail */}
                {trigger.image_url && (
                  <Image
                    source={{ uri: trigger.image_url }}
                    className="w-full rounded-xl mb-3"
                    style={{ height: 120 }}
                    resizeMode="cover"
                  />
                )}

                {/* Quick reply chips */}
                {(trigger.quick_replies?.length ?? 0) > 0 && (
                  <View className="flex-row flex-wrap gap-1.5 mb-3">
                    {trigger.quick_replies!.map((qr) => (
                      <View
                        key={qr.payload}
                        className="bg-navy rounded-xl px-3 py-1.5"
                      >
                        <Text className="text-white text-xs font-medium">
                          {qr.title}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Fire count */}
                {(trigger.fire_count ?? 0) > 0 && (
                  <View className="flex-row items-center gap-1 mb-3">
                    <Ionicons name="flash" size={12} color="#00C5FF" />
                    <Text className="text-slate-400 text-xs">
                      Fired {trigger.fire_count}×
                      {trigger.last_fired_at
                        ? ` · ${formatRelativeTime(trigger.last_fired_at)}`
                        : ""}
                    </Text>
                  </View>
                )}

                {/* Footer */}
                <View className="flex-row items-center justify-between pt-3 border-t border-slate-100">
                  <View className="flex-row items-center gap-2">
                    <Switch
                      value={trigger.is_active}
                      onValueChange={() => handleToggle(trigger)}
                      trackColor={{ false: "#e2e8f0", true: "#00C5FF" }}
                      thumbColor={trigger.is_active ? "#0E1C40" : "#94a3b8"}
                    />
                    <Text
                      className={`text-sm font-medium ${trigger.is_active ? "text-navy" : "text-slate-400"}`}
                    >
                      {trigger.is_active ? "Active" : "Paused"}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-4">
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate("CreateTrigger", {
                          pageId,
                          triggerId: trigger.id,
                        })
                      }
                    >
                      <Ionicons name="pencil" size={18} color="#1B3A6B" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(trigger)}>
                      <Ionicons name="trash" size={18} color="#ef4444" />
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
