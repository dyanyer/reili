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
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              alignSelf: 'flex-start',
              marginBottom: 48,
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color="rgba(255,255,255,0.5)" />
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '500' }}>Back</Text>
          </TouchableOpacity>

          {/* Icon */}
          <View style={{
            width: 60, height: 60,
            borderRadius: 18,
            backgroundColor: 'rgba(0,197,255,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 22,
            borderWidth: 1,
            borderColor: 'rgba(0,197,255,0.2)',
          }}>
            <Ionicons name="mail-open-outline" size={28} color="#D6E4F0" />
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
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 21 }}>
            We sent a 6-digit code to{'\n'}
            <Text style={{ color: '#D6E4F0', fontWeight: '600' }}>{maskedEmail}</Text>
          </Text>
        </View>

        {/* ── Bottom card: code entry ── */}
        <View style={{
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 34,
          borderTopRightRadius: 34,
          paddingHorizontal: 24,
          paddingTop: 28,
          paddingBottom: Math.max(insets.bottom, 24) + 12,
        }}>
          <Text style={{ color: '#1C1E21', fontSize: 19, fontWeight: '800', marginBottom: 4 }}>
            Enter your code
          </Text>
          <Text style={{ color: '#65676B', fontSize: 13, marginBottom: 22 }}>
            The code expires in 10 minutes.
          </Text>

          {/* OTP input */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => inputRef.current?.focus()}
            style={{
              backgroundColor: '#F8F9FA',
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: code.length > 0 ? '#163172' : '#E4E6EB',
              paddingHorizontal: 20,
              paddingVertical: 16,
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <TextInput
              ref={inputRef}
              style={{
                fontSize: 32,
                fontWeight: '800',
                color: '#163172',
                letterSpacing: 14,
                textAlign: 'center',
                width: '100%',
              }}
              placeholder="──────"
              placeholderTextColor="#D1D5DB"
              value={code}
              onChangeText={(t) => setCode(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={verify}
              autoFocus
            />
          </TouchableOpacity>

          {/* Verify */}
          <TouchableOpacity
            onPress={verify}
            disabled={loading || code.length < 6}
            activeOpacity={0.85}
            style={{
              backgroundColor: code.length === 6 ? '#163172' : '#E4E6EB',
              borderRadius: 14,
              paddingVertical: 15,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 16,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#D6E4F0" />
            ) : (
              <>
                <Text style={{
                  color: code.length === 6 ? '#FFFFFF' : '#9CA3AF',
                  fontSize: 15,
                  fontWeight: '700',
                }}>
                  Verify & Sign In
                </Text>
                <Ionicons
                  name="checkmark-circle"
                  size={17}
                  color={code.length === 6 ? '#D6E4F0' : '#9CA3AF'}
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
              ? <ActivityIndicator size="small" color="#65676B" />
              : <>
                  <Ionicons name="refresh-outline" size={14} color="#65676B" />
                  <Text style={{ color: '#65676B', fontSize: 13 }}>
                    Didn't get it? <Text style={{ color: '#163172', fontWeight: '700' }}>Resend code</Text>
                  </Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
