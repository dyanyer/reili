import { View, Text, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../navigation';
import { useActivePage } from '../context/PageContext';
import { supabase } from '../lib/supabase';
import PageSwitcherPill from '../components/PageSwitcherPill';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreHome'>;

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

type MenuItemProps = {
  icon: string;
  iconColor: string;
  iconBgColor: string;
  label: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
};

function MenuItem({ icon, iconColor, iconBgColor, label, subtitle, onPress, danger }: MenuItemProps) {
  return (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 13, backgroundColor: iconBgColor, borderWidth: 1, borderColor: `${iconColor}30` }}>
        <Ionicons name={icon as any} size={19} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: danger ? C.red : C.text }}>{label}</Text>
        <Text style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>{subtitle}</Text>
      </View>
      {!danger && <Ionicons name="chevron-forward" size={15} color={C.text3} />}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: '800', color: C.text3, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
      {title}
    </Text>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: C.border, marginLeft: 69 }} />;
}

export default function MoreScreen({ navigation }: Props) {
  const { activePage, setActivePage } = useActivePage();

  async function handleLogout() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => { await supabase.auth.signOut(); setActivePage(null); } },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={{ backgroundColor: C.white, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.light, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
            <Image source={require('../assets/reili.png')} style={{ width: 20, height: 20 }} resizeMode="contain" />
          </View>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '800' }}>More</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Active Page Card */}
        <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: C.white, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: C.border }}>
          {activePage ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.light, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="logo-facebook" size={20} color={C.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: C.text3, fontWeight: '600' }}>Active Page</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginTop: 1 }} numberOfLines={1}>
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
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.light, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="alert-circle-outline" size={20} color={C.text3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>No page selected</Text>
                <Text style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>Go to Home and tap a page to activate it</Text>
              </View>
            </View>
          )}
        </View>

        {/* Automation */}
        <SectionHeader title="Automation" />
        <View style={{ marginHorizontal: 16, backgroundColor: C.white, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
          <MenuItem
            icon="flash"
            iconColor={C.blue}
            iconBgColor={C.light}
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
            iconColor={C.navy}
            iconBgColor={C.light}
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
        <View style={{ marginHorizontal: 16, backgroundColor: C.white, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
          <MenuItem
            icon="megaphone-outline"
            iconColor={C.navy}
            iconBgColor={C.light}
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
        <View style={{ marginHorizontal: 16, backgroundColor: C.white, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
          <MenuItem
            icon="bar-chart-outline"
            iconColor={C.green}
            iconBgColor={C.greenBg}
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
        <View style={{ marginHorizontal: 16, backgroundColor: C.white, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
          <MenuItem
            icon="add-circle-outline"
            iconColor={C.blue}
            iconBgColor={C.light}
            label="Connect a Page"
            subtitle="Add another Facebook Page"
            onPress={() => navigation.navigate('ConnectPage')}
          />
          <Divider />
          <MenuItem
            icon="log-out-outline"
            iconColor={C.red}
            iconBgColor={C.redBg}
            label="Log Out"
            subtitle="Sign out of your account"
            onPress={handleLogout}
            danger
          />
        </View>

      </ScrollView>
    </View>
  );
}
