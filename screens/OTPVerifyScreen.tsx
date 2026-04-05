import { View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'OTPVerify'>;

export default function OTPVerifyScreen({ navigation, route }: Props) {
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

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
      Alert.alert('Wrong code', 'The code is incorrect or has expired. Please try again.');
      return;
    }

    navigation.replace('Main');
  }

  async function resend() {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Sent!', 'A new code has been sent to your email.');
    }
  }

  return (
    <View className="flex-1 bg-white px-6">
      <StatusBar style="dark" />

      <View className="flex-1 justify-center">
        <View className="bg-cyan-light w-16 h-16 rounded-2xl items-center justify-center mb-6">
          <Ionicons name="mail-open" size={32} color="#0E1C40" />
        </View>

        <Text className="text-navy text-2xl font-bold mb-2">Check your email</Text>
        <Text className="text-slate-500 text-sm leading-6 mb-8">
          We sent a 6-digit code to{'\n'}
          <Text className="text-navy font-semibold">{email}</Text>
        </Text>

        <TextInput
          className="border-2 border-navy rounded-2xl px-4 py-4 text-navy text-2xl font-bold text-center tracking-widest mb-6"
          placeholder="000000"
          placeholderTextColor="#cbd5e1"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
        />

        <TouchableOpacity
          className="bg-navy rounded-2xl py-4 items-center mb-4"
          onPress={verify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-base font-semibold">Verify & Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity className="py-3 items-center" onPress={resend}>
          <Text className="text-slate-400 text-sm">Didn't receive it? <Text className="text-navy font-semibold">Resend code</Text></Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        className="pb-10 flex-row items-center gap-2"
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={18} color="#64748b" />
        <Text className="text-slate-500 text-sm">Back</Text>
      </TouchableOpacity>
    </View>
  );
}
