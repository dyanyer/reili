import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import { RootStackParamList } from "../navigation";
import { supabase } from "../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

const CHIPS = [
  { icon: "flash", label: "Auto-replies" },
  { icon: "bag", label: "Orders" },
  { icon: "bar-chart", label: "Analytics" },
  { icon: "megaphone", label: "Broadcasts" },
];

const IS_EXPO_GO = Constants.appOwnership === "expo";

// ── Brand palette ──────────────────────────────────────────────────────────────
const C = {
  bg:       '#F6F6F6',
  white:    '#FFFFFF',
  light:    '#D6E4F0',
  blue:     '#1E56A0',
  navy:     '#163172',
  navyFade: 'rgba(22,49,114,0.08)',
  text:     '#163172',
  text2:    '#1E56A0',
  text3:    'rgba(22,49,114,0.40)',
  border:   'rgba(22,49,114,0.10)',
};

export default function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  async function handleFacebookLogin() {
    setLoading(true);
    try {
      const redirectTo = Linking.createURL("auth");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "facebook",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data?.url) {
        Alert.alert(
          "Error",
          error?.message ?? "Could not start Facebook login.",
        );
        setLoading(false);
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );
      if (result.type !== "success") {
        setLoading(false);
        return;
      }
      const url = result.url;
      const hashPart = url.includes("#")
        ? url.split("#")[1]
        : (url.split("?")[1] ?? "");
      const params = new URLSearchParams(hashPart);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      if (!accessToken || !refreshToken) {
        Alert.alert(
          "Login failed",
          "Could not retrieve session. Please try again.",
        );
        setLoading(false);
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) {
        Alert.alert("Error", sessionError.message);
        setLoading(false);
        return;
      }
      navigation.replace("Main");
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.message ?? "Something went wrong. Please try again.",
      );
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.navy }}>
      <StatusBar style="light" />

      {/* ── Top hero: branding on navy ── */}
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 20,
          paddingHorizontal: 28,
          justifyContent: "center",
        }}
      >
        {/* Logo + wordmark */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 44,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              backgroundColor: "rgba(255,255,255,0.12)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.22)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              source={require("../assets/reili.png")}
              style={{ width: 26, height: 26 }}
              resizeMode="contain"
            />
          </View>
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 22,
              fontWeight: "800",
              letterSpacing: -0.4,
            }}
          >
            Reili
          </Text>
        </View>

        {/* Headline */}
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 38,
            fontWeight: "800",
            letterSpacing: -1,
            lineHeight: 46,
          }}
        >
          Automate{"\n"}your Messenger.{"\n"}
          <Text style={{ color: "rgba(214,228,240,0.75)" }}>Sell while{"\n"}you sleep.</Text>
        </Text>

        <Text
          style={{
            color: "rgba(214,228,240,0.60)",
            fontSize: 14,
            marginTop: 16,
            lineHeight: 22,
          }}
        >
          Stop answering "how much?" every day.{"\n"}
          Let Reili handle it 24/7 — no code needed.
        </Text>

        {/* Feature chips */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 32, flexWrap: "wrap" }}>
          {CHIPS.map((c) => (
            <View
              key={c.label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "rgba(214,228,240,0.18)",
                borderRadius: 99,
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderWidth: 1,
                borderColor: "rgba(214,228,240,0.28)",
              }}
            >
              <Ionicons name={c.icon as any} size={12} color={C.light} />
              <Text style={{ color: C.light, fontSize: 12, fontWeight: "700" }}>
                {c.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Bottom white card: sign in ── */}
      <View
        style={{
          backgroundColor: C.white,
          borderTopLeftRadius: 36,
          borderTopRightRadius: 36,
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: Math.max(insets.bottom, 24) + 12,
          borderTopWidth: 1,
          borderColor: "rgba(22,49,114,0.08)",
          shadowColor: C.navy,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
        }}
      >
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.4, marginBottom: 4 }}>
          Get started free
        </Text>
        <Text style={{ color: C.text2, fontSize: 13, marginBottom: 26, lineHeight: 20 }}>
          Sign in with Facebook to connect your Pages{"\n"}and start automating Messenger replies.
        </Text>

        {/* Facebook button */}
        <TouchableOpacity
          onPress={handleFacebookLogin}
          disabled={loading}
          activeOpacity={0.85}
          style={{
            backgroundColor: C.navy,
            borderRadius: 16,
            paddingVertical: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            shadowColor: C.navy,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 4,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="logo-facebook" size={20} color="#fff" />
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700", letterSpacing: 0.1 }}>
                Continue with Facebook
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Dev bypass — Expo Go only */}
        {IS_EXPO_GO && (
          <TouchableOpacity
            onPress={() => navigation.replace("Main")}
            activeOpacity={0.6}
            style={{ marginTop: 16, alignItems: "center", paddingVertical: 8 }}
          >
            <Text style={{ color: C.text3, fontSize: 12 }}>
              Skip login (dev only)
            </Text>
          </TouchableOpacity>
        )}

        {!IS_EXPO_GO && (
          <Text style={{ color: C.text3, fontSize: 11, textAlign: "center", marginTop: 20, lineHeight: 17 }}>
            By continuing, you agree to our Terms of Service.{"\n"}
            Your data is never shared without permission.
          </Text>
        )}
      </View>
    </View>
  );
}
