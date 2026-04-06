import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef, useCallback } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChatsStackParamList } from '../navigation';
import { conversationsApi } from '../lib/api';
import { useActivePage } from '../context/PageContext';
import PageSwitcherPill from '../components/PageSwitcherPill';

type Props = NativeStackScreenProps<ChatsStackParamList, 'Conversations'>;

type Conversation = {
  id: string;
  customer_facebook_id: string;
  customer_name: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  last_message: string;
  last_message_at: string;
  unread_count: number;
};

const FILTERS = ['All', 'Unread', 'Pinned', 'Archived'] as const;
type Filter = typeof FILTERS[number];

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

const AVATAR_COLORS = [
  { bg: 'rgba(30,86,160,0.12)',  text: '#1E56A0' },
  { bg: 'rgba(22,49,114,0.12)',  text: '#163172' },
  { bg: 'rgba(22,49,114,0.18)',  text: '#163172' },
  { bg: 'rgba(30,86,160,0.18)',  text: '#1E56A0' },
  { bg: 'rgba(214,228,240,0.8)', text: '#163172' },
  { bg: 'rgba(22,49,114,0.10)',  text: '#1E56A0' },
];

function getAvatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ConversationsScreen({ route, navigation }: Props) {
  const { activePage } = useActivePage();
  const [pageId, setPageId] = useState(route.params?.pageId ?? activePage?.id ?? '');
  const [pageName, setPageName] = useState(route.params?.pageName ?? activePage?.name ?? '');

  useEffect(() => {
    if (activePage && activePage.id !== pageId) {
      setPageId(activePage.id);
      setPageName(activePage.name);
    }
  }, [activePage]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<Filter>('All');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadConversations = useCallback(async () => {
    if (!pageId) { setLoading(false); return; }
    try {
      setError('');
      const data = await conversationsApi.getAll(pageId, activeFilter === 'Archived');
      setConversations(data);
    } catch {
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [pageId, activeFilter]);

  async function onRefresh() { setRefreshing(true); await loadConversations(); setRefreshing(false); }

  useEffect(() => {
    setLoading(true);
    loadConversations();
    intervalRef.current = setInterval(loadConversations, 12000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadConversations]);

  async function handleTogglePin(convo: Conversation) {
    setConversations((prev) => prev.map((c) => c.id === convo.id ? { ...c, is_pinned: !c.is_pinned } : c));
    try { await conversationsApi.togglePin(convo.id); }
    catch { setConversations((prev) => prev.map((c) => c.id === convo.id ? { ...c, is_pinned: convo.is_pinned } : c)); }
  }

  async function handleToggleArchive(convo: Conversation) {
    setConversations((prev) => prev.map((c) => c.id === convo.id ? { ...c, is_archived: !c.is_archived } : c));
    try { await conversationsApi.toggleArchive(convo.id); }
    catch { setConversations((prev) => prev.map((c) => c.id === convo.id ? { ...c, is_archived: convo.is_archived } : c)); }
  }

  const nonArchived = conversations.filter((c) => !c.is_archived);
  const unreadCount = nonArchived.filter((c) => c.unread_count > 0).length;

  const filtered = conversations
    .filter((c) => {
      const name = c.customer_name ?? `User ${c.customer_facebook_id.slice(-4)}`;
      const matchesSearch =
        name.toLowerCase().includes(search.toLowerCase()) ||
        c.last_message.toLowerCase().includes(search.toLowerCase());
      if (activeFilter === 'Archived') return matchesSearch && c.is_archived;
      if (c.is_archived) return false;
      if (activeFilter === 'Unread') return matchesSearch && c.unread_count > 0;
      if (activeFilter === 'Pinned') return matchesSearch && c.is_pinned;
      return matchesSearch;
    })
    .sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return 0;
    });

  if (!pageId) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar style="light" />
        <View style={{ backgroundColor: C.navy, paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>Chats</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: C.light, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="chatbubbles-outline" size={36} color={C.blue} />
          </View>
          <Text style={{ color: C.text, fontWeight: '800', fontSize: 16, letterSpacing: -0.3 }}>No page selected</Text>
          <Text style={{ color: C.text3, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
            Go to Home and tap a page to start viewing conversations.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />

      {/* Header — navy */}
      <View style={{ backgroundColor: C.navy, paddingTop: 56, paddingBottom: 14, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>Chats</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <PageSwitcherPill
              currentPageId={pageId}
              currentPageName={pageName}
              onSwitch={(id, name) => { setPageId(id); setPageName(name); }}
            />
            <TouchableOpacity onPress={loadConversations} activeOpacity={0.75} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="refresh-outline" size={16} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 12, gap: 8, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
          <Ionicons name="search" size={14} color="rgba(255,255,255,0.55)" />
          <TextInput
            style={{ flex: 1, paddingVertical: 10, color: '#FFFFFF', fontSize: 14 }}
            placeholder="Search conversations..."
            placeholderTextColor="rgba(255,255,255,0.45)"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter pills */}
        <View style={{ flexDirection: 'row', gap: 7 }}>
          {FILTERS.map((f) => {
            const isActive = activeFilter === f;
            const badge = f === 'Unread' ? unreadCount : 0;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setActiveFilter(f)}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 13, paddingVertical: 7, borderRadius: 99,
                  backgroundColor: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.10)',
                  borderWidth: 1,
                  borderColor: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.18)',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: isActive ? C.navy : 'rgba(255,255,255,0.85)' }}>{f}</Text>
                {badge > 0 && (
                  <View style={{ backgroundColor: C.blue, borderRadius: 99, minWidth: 16, height: 16, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.navy} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Ionicons name="cloud-offline" size={48} color={C.text3} />
          <Text style={{ color: C.text2, fontSize: 15, marginTop: 12, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity style={{ marginTop: 16, backgroundColor: C.navy, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }} onPress={loadConversations}>
            <Text style={{ color: C.white, fontWeight: '700' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: C.navyFade, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="chatbubbles-outline" size={36} color={C.navy} />
          </View>
          <Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }}>{search ? 'No results found' : 'No conversations yet'}</Text>
          <Text style={{ color: C.text3, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
            {search ? 'Try a different search term' : "When customers message your Facebook Page, they'll appear here."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: C.border, marginLeft: 80 }} />}
          renderItem={({ item: c }) => {
            const displayName = c.customer_name ?? `User ${c.customer_facebook_id.slice(-4)}`;
            const initials = displayName.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || displayName.slice(0, 2).toUpperCase();
            const avatarColor = getAvatarColor(displayName);
            const hasUnread = c.unread_count > 0;

            return (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, backgroundColor: C.white }}
                onPress={() => navigation.navigate('ConversationThread', { conversationId: c.id, customerName: displayName })}
                onLongPress={() =>
                  Alert.alert(displayName, 'Choose an action', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: c.is_pinned ? 'Unpin' : 'Pin to top', onPress: () => handleTogglePin(c) },
                    { text: c.is_archived ? 'Unarchive' : 'Archive', onPress: () => handleToggleArchive(c) },
                  ])
                }
                activeOpacity={0.7}
              >
                {/* Avatar */}
                <View style={{ position: 'relative', marginRight: 13, flexShrink: 0 }}>
                  <View style={{ width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: avatarColor.bg, borderWidth: 1.5, borderColor: hasUnread ? C.blue : C.border }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: avatarColor.text, letterSpacing: -0.3 }}>{initials}</Text>
                  </View>
                  {hasUnread && (
                    <View style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: C.blue, borderWidth: 2, borderColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 7, fontWeight: '800' }}>{c.unread_count > 9 ? '9+' : c.unread_count}</Text>
                    </View>
                  )}
                </View>

                {/* Content */}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, marginRight: 8 }}>
                      {c.is_pinned && <Ionicons name="pin" size={10} color={C.blue} />}
                      <Text style={{ fontSize: 14, flex: 1, color: C.text, fontWeight: hasUnread ? '800' : '600', letterSpacing: -0.2 }} numberOfLines={1}>
                        {displayName}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: hasUnread ? C.blue : C.text3, flexShrink: 0, fontWeight: hasUnread ? '700' : '400' }}>{timeAgo(c.last_message_at)}</Text>
                  </View>
                  <Text
                    style={{ fontSize: 13, lineHeight: 18, color: hasUnread ? C.text : C.text3, fontWeight: hasUnread ? '500' : '400' }}
                    numberOfLines={1}
                  >
                    {c.last_message}
                  </Text>
                </View>

                {/* Chevron */}
                <View style={{ marginLeft: 8, flexShrink: 0 }}>
                  <Ionicons name="chevron-forward" size={14} color={C.text3} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
