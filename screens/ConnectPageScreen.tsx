import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../navigation';
import { facebookAuth } from '../lib/facebook';
import { connectApi } from '../lib/api';

type Props = NativeStackScreenProps<MoreStackParamList, 'ConnectPage'>;

type FacebookPage = {
  id: string;
  name: string;
  access_token: string;
};

export default function ConnectPageScreen({ navigation }: Props) {
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    startFacebookAuth();
  }, []);

  async function startFacebookAuth() {
    setLoading(true);
    setError('');

    try {
      const accessToken = await facebookAuth('connect-pages');
      if (!accessToken) {
        // User cancelled
        navigation.goBack();
        return;
      }

      // Fetch pages from backend
      const pageList = await connectApi.listPages(accessToken);
      if (pageList.length === 0) {
        setError('No Facebook Pages found on your account. Make sure you are an Admin of a Page.');
      }
      setPages(pageList);
    } catch (e: any) {
      setError(e.message || 'Failed to load your Facebook Pages.');
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
        'Page Connected!',
        `${page.name} is now connected. The bot will auto-reply to your Messenger customers.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to connect page. Please try again.');
    } finally {
      setConnecting(null);
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
        <View>
          <Text className="text-[#1C1E21] text-xl font-bold">Connect a Page</Text>
          <Text className="text-[#65676B] text-xs mt-0.5">Select a Facebook Page to connect</Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color="#0E1C40" />
          <Text className="text-slate-500 text-sm">Fetching your Facebook Pages...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <View className="bg-red-50 rounded-2xl p-6 items-center">
            <Ionicons name="alert-circle" size={48} color="#ef4444" />
            <Text className="text-slate-700 text-sm text-center mt-3 leading-5">{error}</Text>
          </View>
          <TouchableOpacity
            className="bg-navy rounded-2xl py-3.5 px-8"
            onPress={startFacebookAuth}
          >
            <Text className="text-white text-sm font-semibold">Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text className="text-slate-400 text-sm">Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Info banner */}
          <View className="bg-cyan-light rounded-2xl p-4 mb-4 flex-row items-start gap-3">
            <Ionicons name="information-circle" size={20} color="#0E1C40" />
            <Text className="text-navy text-xs flex-1 leading-5">
              Select the Page you want Reili to manage. The bot will automatically reply to Messenger
              messages on this Page.
            </Text>
          </View>

          {pages.map((page) => (
            <View
              key={page.id}
              className="bg-white rounded-2xl p-4 mb-3 flex-row items-center justify-between"
              style={{
                shadowColor: '#0E1C40',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.07,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View className="flex-row items-center gap-3 flex-1">
                <View className="bg-cyan-light rounded-xl p-2.5">
                  <Ionicons name="logo-facebook" size={22} color="#0E1C40" />
                </View>
                <View className="flex-1">
                  <Text className="text-navy font-bold text-base">{page.name}</Text>
                  <Text className="text-slate-400 text-xs mt-0.5">Facebook Page</Text>
                </View>
              </View>

              {connectedIds.has(page.id) ? (
                <View className="flex-row items-center gap-1.5 bg-emerald-50 rounded-xl py-2.5 px-4">
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text className="text-emerald-700 text-sm font-bold">Connected</Text>
                </View>
              ) : (
                <TouchableOpacity
                  className="bg-cyan rounded-xl py-2.5 px-5"
                  onPress={() => handleConnect(page)}
                  disabled={connecting === page.id}
                >
                  {connecting === page.id ? (
                    <ActivityIndicator size="small" color="#0E1C40" />
                  ) : (
                    <Text className="text-navy text-sm font-bold">Connect</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))}

          {pages.length > 0 && (
            <Text className="text-slate-400 text-xs text-center mt-2">
              Don't see your Page? Make sure you're an Admin on that Page in Facebook.
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}
