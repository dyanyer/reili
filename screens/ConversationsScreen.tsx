import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
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

// Color palette for avatars based on name initial
const AVATAR_COLORS = [
  { bg: '#D6E4F0', text: '#163172' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#F3E8FF', text: '#5B21B6' },
  { bg: '#FFE4E6', text: '#9F1239' },
  { bg: '#DBEAFE', text: '#1E40AF' },
];

function getAvatarColor(name: string) {
  const index = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
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

  // Sync when active page changes from MoreScreen switcher
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

  async function onRefresh() {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }

  useEffect(() => {
    setLoading(true);
    loadConversations();
    intervalRef.current = setInterval(loadConversations, 12000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadConversations]);

  async function handleTogglePin(convo: Conversation) {
    setConversations((prev) => prev.map((c) => c.id === convo.id ? { ...c, is_pinned: !c.is_pinned } : c));
    try {
      await conversationsApi.togglePin(convo.id);
    } catch {
      setConversations((prev) => prev.map((c) => c.id === convo.id ? { ...c, is_pinned: convo.is_pinned } : c));
    }
  }

  async function handleToggleArchive(convo: Conversation) {
    setConversations((prev) => prev.map((c) => c.id === convo.id ? { ...c, is_archived: !c.is_archived } : c));
    try {
      await conversationsApi.toggleArchive(convo.id);
    } catch {
      setConversations((prev) => prev.map((c) => c.id === convo.id ? { ...c, is_archived: convo.is_archived } : c));
    }
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

  // No page selected state
  if (!pageId) {
    return (
      <View className="flex-1 bg-[#F6F6F6]">
        <StatusBar style="dark" />
        <View className="bg-white pt-14 pb-4 px-4 border-b border-[#E4E6EB]">
          <Text className="text-[#1C1E21] text-xl font-bold">Chats</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <View className="bg-[#D6E4F0] rounded-full p-6 mb-4">
            <Ionicons name="chatbubbles-outline" size={40} color="#163172" />
          </View>
          <Text className="text-[#1C1E21] font-bold text-base">No page selected</Text>
          <Text className="text-[#65676B] text-sm mt-2 text-center leading-5">
            Go to Home and tap a page to start viewing conversations.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F6F6F6]">
      <StatusBar style="dark" />

      {/* Header */}
      <View className="bg-white pt-14 pb-3 px-4 border-b border-[#E4E6EB]">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-[#1C1E21] text-xl font-bold">Chats</Text>
          <View className="flex-row items-center">
            <PageSwitcherPill
              currentPageId={pageId}
              currentPageName={pageName}
              onSwitch={(id, name) => { setPageId(id); setPageName(name); }}
            />
            <TouchableOpacity onPress={loadConversations} className="p-2">
              <Ionicons name="refresh-outline" size={20} color="#65676B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-[#F6F6F6] rounded-xl px-3 gap-2 mb-3">
          <Ionicons name="search" size={15} color="#65676B" />
          <TextInput
            className="flex-1 py-2.5 text-[#1C1E21] text-sm"
            placeholder="Search conversations..."
            placeholderTextColor="#65676B"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#65676B" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter pills */}
        <View className="flex-row gap-2">
          {FILTERS.map((f) => {
            const isActive = activeFilter === f;
            const badge = f === 'Unread' ? unreadCount : 0;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setActiveFilter(f)}
                className={`flex-row items-center gap-1 px-3 py-1.5 rounded-full ${isActive ? 'bg-navy' : 'bg-[#E4E6EB]'}`}
              >
                <Text className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-[#65676B]'}`}>{f}</Text>
                {badge > 0 && (
                  <View className="bg-[#D6E4F0] rounded-full w-4 h-4 items-center justify-center">
                    <Text className="text-[#163172] text-xs font-bold" style={{ fontSize: 9 }}>{badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#163172" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cloud-offline" size={48} color="#cbd5e1" />
          <Text className="text-[#65676B] text-base mt-3 text-center">{error}</Text>
          <TouchableOpacity className="mt-4 bg-navy rounded-xl px-6 py-3" onPress={loadConversations}>
            <Text className="text-white font-semibold">Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="bg-[#D6E4F0] rounded-full p-6 mb-4">
            <Ionicons name="chatbubbles-outline" size={40} color="#163172" />
          </View>
          <Text className="text-[#1C1E21] font-bold text-base">
            {search ? 'No results found' : 'No conversations yet'}
          </Text>
          <Text className="text-[#65676B] text-sm mt-2 text-center leading-5">
            {search ? 'Try a different search term' : 'When customers message your Facebook Page, they\'ll appear here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#163172" />}
          contentContainerStyle={{ paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View className="h-px bg-[#E4E6EB] ml-20" />}
          renderItem={({ item: c }) => {
            const displayName = c.customer_name ?? `User ${c.customer_facebook_id.slice(-4)}`;
            const initials = displayName.slice(0, 2).toUpperCase();
            const avatarColor = getAvatarColor(displayName);
            const hasUnread = c.unread_count > 0;

            return (
              <TouchableOpacity
                className="bg-white flex-row items-center px-4 py-3"
                onPress={() => navigation.navigate('ConversationThread', {
                  conversationId: c.id,
                  customerName: displayName,
                })}
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
                <View
                  className="w-14 h-14 rounded-full items-center justify-center mr-3 flex-shrink-0"
                  style={{ backgroundColor: avatarColor.bg }}
                >
                  <Text className="text-base font-bold" style={{ color: avatarColor.text }}>{initials}</Text>
                </View>

                {/* Content */}
                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center justify-between mb-0.5">
                    <View className="flex-row items-center gap-1 flex-1 mr-2">
                      {c.is_pinned && <Ionicons name="pin" size={11} color="#D6E4F0" />}
                      <Text
                        className="text-sm flex-1"
                        style={{ color: '#1C1E21', fontWeight: hasUnread ? '700' : '500' }}
                        numberOfLines={1}
                      >
                        {displayName}
                      </Text>
                    </View>
                    <Text className="text-xs text-[#65676B] flex-shrink-0">{timeAgo(c.last_message_at)}</Text>
                  </View>
                  <Text
                    className="text-sm leading-5"
                    style={{ color: hasUnread ? '#1C1E21' : '#65676B', fontWeight: hasUnread ? '500' : '400' }}
                    numberOfLines={1}
                  >
                    {c.last_message}
                  </Text>
                </View>

                {/* Unread dot */}
                <View className="ml-2 flex-shrink-0 w-5 items-center">
                  {hasUnread && (
                    <View className="w-3 h-3 rounded-full bg-[#D6E4F0]" />
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
