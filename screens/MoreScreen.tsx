import { View, Text, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../navigation';
import { useActivePage } from '../context/PageContext';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PageSwitcherPill from '../components/PageSwitcherPill';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreHome'>;

type MenuItemProps = {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
};

function MenuItem({ icon, iconBg, iconColor, label, subtitle, onPress, danger }: MenuItemProps) {
  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3.5 bg-white"
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: iconBg }}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text className={`text-sm font-semibold ${danger ? 'text-red-500' : 'text-[#1C1E21]'}`}>{label}</Text>
        <Text className="text-xs text-[#65676B] mt-0.5">{subtitle}</Text>
      </View>
      {!danger && <Ionicons name="chevron-forward" size={16} color="#C5C5C7" />}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-xs font-bold text-[#65676B] uppercase tracking-wider px-4 pt-5 pb-2">
      {title}
    </Text>
  );
}

function Divider() {
  return <View className="h-px bg-[#E4E6EB] ml-16" />;
}

export default function MoreScreen({ navigation }: Props) {
  const { activePage, setActivePage } = useActivePage();

  async function handleLogout() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          setActivePage(null);
        },
      },
    ]);
  }

  const noPage = !activePage;

  return (
    <View className="flex-1 bg-[#F0F2F5]">
      <StatusBar style="dark" />

      {/* Header */}
      <View className="bg-white pt-14 pb-4 px-4 border-b border-[#E4E6EB]">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Image
              source={require('../assets/reili.png')}
              style={{ width: 28, height: 28 }}
              resizeMode="contain"
            />
            <Text className="text-[#1C1E21] text-xl font-bold">More</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Active Page Card */}
        <View className="mx-4 mt-4 bg-white rounded-2xl p-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}>
          {activePage ? (
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-xl bg-[#E8F8FF] items-center justify-center mr-3">
                <Ionicons name="logo-facebook" size={20} color="#0E1C40" />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-[#65676B] font-medium">Active Page</Text>
                <Text className="text-sm font-semibold text-[#1C1E21] mt-0.5" numberOfLines={1}>
                  {activePage.name}
                </Text>
              </View>
              <PageSwitcherPill
                currentPageId={activePage.id}
                currentPageName={activePage.name}
                onSwitch={(id, name) => setActivePage({ id, name })}
              />
            </View>
          ) : (
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-xl bg-[#F0F2F5] items-center justify-center mr-3">
                <Ionicons name="alert-circle-outline" size={20} color="#65676B" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-[#1C1E21]">No page selected</Text>
                <Text className="text-xs text-[#65676B] mt-0.5">Go to Home and tap a page to activate it</Text>
              </View>
            </View>
          )}
        </View>

        {/* Automation */}
        <SectionHeader title="Automation" />
        <View className="bg-white rounded-2xl mx-4 overflow-hidden" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}>
          <MenuItem
            icon="flash"
            iconBg="#E8F8FF"
            iconColor="#0E1C40"
            label="Triggers"
            subtitle="Manage keyword auto-replies"
            onPress={() => {
              if (!activePage) { Alert.alert('No page selected', 'Go to Home and tap a page first.'); return; }
              navigation.navigate('Triggers', { pageId: activePage.id, pageName: activePage.name });
            }}
          />
          <Divider />
          <MenuItem
            icon="settings-outline"
            iconBg="#F3E8FF"
            iconColor="#7C3AED"
            label="Bot Settings"
            subtitle="Default reply, welcome message, away mode"
            onPress={() => {
              if (!activePage) { Alert.alert('No page selected', 'Go to Home and tap a page first.'); return; }
              navigation.navigate('PageSettings', { pageId: activePage.id, pageName: activePage.name });
            }}
          />
        </View>

        {/* Marketing */}
        <SectionHeader title="Marketing" />
        <View className="bg-white rounded-2xl mx-4 overflow-hidden" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}>
          <MenuItem
            icon="megaphone-outline"
            iconBg="#FEF3C7"
            iconColor="#D97706"
            label="Broadcast"
            subtitle="Send messages to all your contacts"
            onPress={() => {
              if (!activePage) { Alert.alert('No page selected', 'Go to Home and tap a page first.'); return; }
              navigation.navigate('Broadcast', { pageId: activePage.id, pageName: activePage.name });
            }}
          />
        </View>

        {/* Insights */}
        <SectionHeader title="Insights" />
        <View className="bg-white rounded-2xl mx-4 overflow-hidden" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}>
          <MenuItem
            icon="bar-chart-outline"
            iconBg="#D1FAE5"
            iconColor="#059669"
            label="Analytics"
            subtitle="Messages, bot efficiency, weekly stats"
            onPress={() => {
              if (!activePage) { Alert.alert('No page selected', 'Go to Home and tap a page first.'); return; }
              navigation.navigate('Analytics', { pageId: activePage.id, pageName: activePage.name });
            }}
          />
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View className="bg-white rounded-2xl mx-4 overflow-hidden" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}>
          <MenuItem
            icon="add-circle-outline"
            iconBg="#E8F8FF"
            iconColor="#0099CC"
            label="Connect a Page"
            subtitle="Add another Facebook Page"
            onPress={() => navigation.navigate('ConnectPage')}
          />
          <Divider />
          <MenuItem
            icon="log-out-outline"
            iconBg="#FEE2E2"
            iconColor="#DC2626"
            label="Log Out"
            subtitle="Sign out of your account"
            onPress={handleLogout}
            danger
          />
        </View>

        <View className="h-10" />
      </ScrollView>
    </View>
  );
}
