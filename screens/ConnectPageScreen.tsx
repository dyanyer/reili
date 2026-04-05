import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MoreStackParamList } from "../navigation";
import { facebookAuth } from "../lib/facebook";
import { connectApi } from "../lib/api";

type Props = NativeStackScreenProps<MoreStackParamList, "ConnectPage">;

type FacebookPage = {
  id: string;
  name: string;
  access_token: string;
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

export default function ConnectPageScreen({ navigation }: Props) {
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    startFacebookAuth();
  }, []);

  async function startFacebookAuth() {
    setLoading(true);
    setError("");
    try {
      const accessToken = await facebookAuth("connect-pages");
      if (!accessToken) {
        navigation.goBack();
        return;
      }
      const pageList = await connectApi.listPages(accessToken);
      if (pageList.length === 0) {
        setError(
          "No Facebook Pages found on your account. Make sure you are an Admin of a Page.",
        );
      }
      setPages(pageList);
    } catch (e: any) {
      setError(e.message || "Failed to load your Facebook Pages.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(page: FacebookPage) {
    setConnecting(page.id);
    try {
      await connectApi.savePage(page.id, page.name, page.access_token);
      setConnectedIds((prev) => new Set([...prev, page.id]));
      Alert.alert(
        "Page Connected!",
        `${page.name} is now connected. The bot will auto-reply to your Messenger customers.`,
        [{ text: "Done", onPress: () => navigation.goBack() }],
      );
    } catch (e: any) {
      Alert.alert(
        "Error",
        e.message || "Failed to connect page. Please try again.",
      );
    } finally {
      setConnecting(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View
        style={{
          backgroundColor: C.white,
          paddingTop: 56,
          paddingBottom: 16,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginRight: 12, padding: 4 }}
        >
          <Ionicons name="arrow-back" size={24} color={C.navy} />
        </TouchableOpacity>
        <View>
          <Text style={{ color: C.navy, fontSize: 20, fontWeight: "800" }}>
            Connect a Page
          </Text>
          <Text style={{ color: C.text3, fontSize: 12, marginTop: 2 }}>
            Select a Facebook Page to connect
          </Text>
        </View>
      </View>

      {loading ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
          }}
        >
          <ActivityIndicator size="large" color={C.navy} />
          <Text style={{ color: C.text3, fontSize: 13 }}>
            Fetching your Facebook Pages...
          </Text>
        </View>
      ) : error ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
            gap: 20,
          }}
        >
          <View
            style={{
              backgroundColor: C.redBg,
              borderRadius: 24,
              padding: 28,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "rgba(220,38,38,0.18)",
              width: "100%",
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                backgroundColor: "rgba(220,38,38,0.12)",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <Ionicons name="alert-circle" size={40} color={C.red} />
            </View>
            <Text
              style={{
                color: C.text,
                fontSize: 13,
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              {error}
            </Text>
          </View>
          <TouchableOpacity
            style={{
              backgroundColor: C.navy,
              borderRadius: 16,
              paddingVertical: 14,
              paddingHorizontal: 36,
            }}
            onPress={startFacebookAuth}
          >
            <Text style={{ color: C.white, fontSize: 14, fontWeight: "700" }}>
              Try Again
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: C.text3, fontSize: 13 }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        >
          {/* Info banner */}
          <View
            style={{
              backgroundColor: C.light,
              borderRadius: 16,
              padding: 14,
              marginBottom: 16,
              flexDirection: "row",
              gap: 12,
              alignItems: "flex-start",
              borderWidth: 1,
              borderColor: C.border,
            }}
          >
            <Ionicons name="information-circle" size={18} color={C.navy} />
            <Text
              style={{ color: C.navy, fontSize: 12, flex: 1, lineHeight: 18 }}
            >
              Select the Page you want Reili to manage. The bot will
              automatically reply to Messenger messages on this Page.
            </Text>
          </View>

          {pages.map((page) => (
            <View
              key={page.id}
              style={{
                backgroundColor: C.white,
                borderRadius: 20,
                padding: 14,
                marginBottom: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderWidth: 1,
                borderColor: C.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  flex: 1,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: C.light,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: C.border,
                  }}
                >
                  <Ionicons name="logo-facebook" size={22} color={C.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: C.navy, fontWeight: "700", fontSize: 14 }}
                    numberOfLines={1}
                  >
                    {page.name}
                  </Text>
                  <Text style={{ color: C.text3, fontSize: 11, marginTop: 2 }}>
                    Facebook Page
                  </Text>
                </View>
              </View>

              {connectedIds.has(page.id) ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: C.greenBg,
                    borderRadius: 12,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderWidth: 1,
                    borderColor: "rgba(22,163,74,0.20)",
                  }}
                >
                  <Ionicons name="checkmark-circle" size={15} color={C.green} />
                  <Text
                    style={{ color: C.green, fontSize: 12, fontWeight: "700" }}
                  >
                    Connected
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={{
                    backgroundColor: C.navy,
                    borderRadius: 12,
                    paddingVertical: 9,
                    paddingHorizontal: 20,
                  }}
                  onPress={() => handleConnect(page)}
                  disabled={connecting === page.id}
                >
                  {connecting === page.id ? (
                    <ActivityIndicator size="small" color={C.white} />
                  ) : (
                    <Text
                      style={{ color: C.white, fontSize: 13, fontWeight: "700" }}
                    >
                      Connect
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))}

          {pages.length > 0 && (
            <Text
              style={{
                color: C.text3,
                fontSize: 11,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              Don't see your Page? Make sure you're an Admin on that Page in
              Facebook.
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}
