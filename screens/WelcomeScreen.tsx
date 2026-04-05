import {
  View, Text, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { RootStackParamList } from '../navigation';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const CHIPS = [
  { icon: 'flash',     label: 'Auto-replies' },
  { icon: 'bag',       label: 'Orders'       },
  { icon: 'bar-chart', label: 'Analytics'    },
  { icon: 'megaphone', label: 'Broadcasts'   },
];

const IS_EXPO_GO = Constants.appOwnership === 'expo';

export default function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  async function handleFacebookLogin() {
    setLoading(true);
    try {
      const redirectTo = Linking.createURL('auth');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data?.url) {
        Alert.alert('Error', error?.message ?? 'Could not start Facebook login.');
        setLoading(false);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type !== 'success') {
        setLoading(false);
        return;
      }

      const url = result.url;
      const hashPart = url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? '';
      const params = new URLSearchParams(hashPart);
      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken || !refreshToken) {
        Alert.alert('Login failed', 'Could not retrieve session. Please try again.');
        setLoading(false);
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        Alert.alert('Error', sessionError.message);
        setLoading(false);
        return;
      }

      navigation.replace('Main');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#163172' }}>
      <StatusBar style="light" />

      {/* ── Top: branding ── */}
      <View style={{
        flex: 1,
        paddingTop: insets.top + 20,
        paddingHorizontal: 28,
        justifyContent: 'center',
      }}>
        {/* Logo + wordmark */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 44 }}>
          <View style={{
            width: 42, height: 42,
            borderRadius: 13,
            backgroundColor: 'rgba(255,255,255,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Image
              source={require('../assets/reili.png')}
              style={{ width: 26, height: 26 }}
              resizeMode="contain"
            />
          </View>
          <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>
            Reili
          </Text>
        </View>

        {/* Headline */}
        <Text style={{
          color: '#FFFFFF',
          fontSize: 38,
          fontWeight: '800',
          letterSpacing: -1,
          lineHeight: 46,
        }}>
          Automate{'\n'}your Messenger.{'\n'}
          <Text style={{ color: '#D6E4F0' }}>Sell while{'\n'}you sleep.</Text>
        </Text>

        <Text style={{
          color: 'rgba(255,255,255,0.45)',
          fontSize: 14,
          marginTop: 16,
          lineHeight: 22,
        }}>
          Stop answering "how much?" every day.{'\n'}
          Let Reili handle it 24/7 — no code needed.
        </Text>

        {/* Feature chips */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 28, flexWrap: 'wrap' }}>
          {CHIPS.map((c) => (
            <View
              key={c.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'rgba(255,255,255,0.07)',
                borderRadius: 99,
                paddingHorizontal: 13,
                paddingVertical: 8,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            >
              <Ionicons name={c.icon as any} size={12} color="#D6E4F0" />
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' }}>
                {c.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Bottom card: sign in ── */}
      <View style={{
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 34,
        borderTopRightRadius: 34,
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: Math.max(insets.bottom, 24) + 12,
      }}>
        <Text style={{ color: '#1C1E21', fontSize: 19, fontWeight: '800', marginBottom: 4 }}>
          Get started free
        </Text>
        <Text style={{ color: '#65676B', fontSize: 13, marginBottom: 24, lineHeight: 19 }}>
          Sign in with your Facebook account to connect your Pages and start automating.
        </Text>

        {/* Facebook button */}
        <TouchableOpacity
          onPress={handleFacebookLogin}
          disabled={loading}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#163172',
            borderRadius: 14,
            paddingVertical: 15,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#D6E4F0" />
          ) : (
            <>
              <Ionicons name="logo-facebook" size={20} color="#D6E4F0" />
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
                Continue with Facebook
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Dev bypass — Expo Go only */}
        {IS_EXPO_GO && (
          <TouchableOpacity
            onPress={() => navigation.replace('Main')}
            activeOpacity={0.6}
            style={{ marginTop: 16, alignItems: 'center', paddingVertical: 8 }}
          >
            <Text style={{ color: '#BCC0C8', fontSize: 12 }}>
              Skip login (dev only)
            </Text>
          </TouchableOpacity>
        )}

        {!IS_EXPO_GO && (
          <Text style={{
            color: '#BCC0C8',
            fontSize: 11,
            textAlign: 'center',
            marginTop: 18,
            lineHeight: 17,
          }}>
            By continuing, you agree to our Terms of Service.{'\n'}
            Your data is never shared without permission.
          </Text>
        )}
      </View>
    </View>
  );
}
