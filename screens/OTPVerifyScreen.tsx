import {
  View, Text, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'OTPVerify'>;

export default function OTPVerifyScreen({ navigation, route }: Props) {
  const { email } = route.params;
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  async function verify() {
    if (code.trim().length < 6) {
      Alert.alert('Invalid code', 'Please enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    });
    setLoading(false);
    if (error) {
      Alert.alert('Wrong code', 'The code is incorrect or has expired. Try again.');
      return;
    }
    navigation.replace('Main');
  }

  async function resend() {
    setResending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setResending(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Code sent!', `A new code has been sent to ${email}.`);
    }
  }

  // Mask email: jo****@gmail.com
  const [user, domain] = email.split('@');
  const maskedEmail = user.slice(0, 2) + '****@' + domain;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, backgroundColor: '#163172' }}>
        <StatusBar style="light" />

        {/* ── Top: context ── */}
        <View style={{
          flex: 1,
          paddingTop: insets.top + 16,
          paddingHorizontal: 28,
          justifyContent: 'center',
        }}>
          {/* Back */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: 38, height: 38,
              borderRadius: 19,
              backgroundColor: 'rgba(255,255,255,0.10)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.14)',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'flex-start',
              marginBottom: 44,
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color="rgba(255,255,255,0.80)" />
          </TouchableOpacity>

          {/* Icon */}
          <View style={{
            width: 64, height: 64,
            borderRadius: 20,
            backgroundColor: 'rgba(214,228,240,0.14)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 22,
            borderWidth: 1,
            borderColor: 'rgba(214,228,240,0.22)',
          }}>
            <Ionicons name="mail-open-outline" size={30} color="#D6E4F0" />
          </View>

          <Text style={{
            color: '#FFFFFF',
            fontSize: 32,
            fontWeight: '800',
            letterSpacing: -0.8,
            lineHeight: 38,
            marginBottom: 10,
          }}>
            Check your{'\n'}inbox
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.50)', fontSize: 14, lineHeight: 22 }}>
            We sent a 6-digit code to{'\n'}
            <Text style={{ color: '#D6E4F0', fontWeight: '700' }}>{maskedEmail}</Text>
          </Text>
        </View>

        {/* ── Bottom card: code entry ── */}
        <View style={{
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 36,
          borderTopRightRadius: 36,
          paddingHorizontal: 24,
          paddingTop: 28,
          paddingBottom: Math.max(insets.bottom, 24) + 12,
          shadowColor: '#163172',
          shadowOpacity: 0.12,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: -6 },
          elevation: 12,
        }}>
          {/* drag pill */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(22,49,114,0.10)', alignSelf: 'center', marginBottom: 22 }} />

          <Text style={{ color: '#163172', fontSize: 20, fontWeight: '800', marginBottom: 4, letterSpacing: -0.3 }}>
            Enter your code
          </Text>
          <Text style={{ color: 'rgba(22,49,114,0.45)', fontSize: 13, marginBottom: 24, lineHeight: 19 }}>
            The code expires in 10 minutes.
          </Text>

          {/* OTP input */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => inputRef.current?.focus()}
            style={{
              backgroundColor: '#F6F6F6',
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: code.length > 0 ? '#163172' : 'rgba(22,49,114,0.12)',
              paddingHorizontal: 20,
              paddingVertical: 18,
              alignItems: 'center',
              marginBottom: 8,
              shadowColor: code.length > 0 ? '#163172' : 'transparent',
              shadowOpacity: 0.10,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            <TextInput
              ref={inputRef}
              style={{
                fontSize: 34,
                fontWeight: '800',
                color: '#163172',
                letterSpacing: 14,
                textAlign: 'center',
                width: '100%',
              }}
              placeholder="──────"
              placeholderTextColor="rgba(22,49,114,0.18)"
              value={code}
              onChangeText={(t) => setCode(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={verify}
              autoFocus
            />
          </TouchableOpacity>

          {/* Progress dots */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
            {[0,1,2,3,4,5].map((i) => (
              <View key={i} style={{ width: i < code.length ? 10 : 8, height: i < code.length ? 10 : 8, borderRadius: 5, backgroundColor: i < code.length ? '#163172' : 'rgba(22,49,114,0.15)' }} />
            ))}
          </View>

          {/* Verify */}
          <TouchableOpacity
            onPress={verify}
            disabled={loading || code.length < 6}
            activeOpacity={0.85}
            style={{
              backgroundColor: code.length === 6 ? '#163172' : 'rgba(22,49,114,0.08)',
              borderRadius: 16,
              paddingVertical: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 16,
              shadowColor: code.length === 6 ? '#163172' : 'transparent',
              shadowOpacity: 0.25,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: code.length === 6 ? 4 : 0,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#D6E4F0" />
            ) : (
              <>
                <Text style={{
                  color: code.length === 6 ? '#FFFFFF' : 'rgba(22,49,114,0.30)',
                  fontSize: 15,
                  fontWeight: '800',
                }}>
                  Verify &amp; Sign In
                </Text>
                <Ionicons
                  name="checkmark-circle"
                  size={17}
                  color={code.length === 6 ? '#D6E4F0' : 'rgba(22,49,114,0.25)'}
                />
              </>
            )}
          </TouchableOpacity>

          {/* Resend */}
          <TouchableOpacity
            onPress={resend}
            disabled={resending}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {resending
              ? <ActivityIndicator size="small" color="rgba(22,49,114,0.40)" />
              : <>
                  <Ionicons name="refresh-outline" size={14} color="rgba(22,49,114,0.40)" />
                  <Text style={{ color: 'rgba(22,49,114,0.45)', fontSize: 13 }}>
                    Didn't get it?{'  '}
                    <Text style={{ color: '#163172', fontWeight: '700' }}>Resend code</Text>
                  </Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
