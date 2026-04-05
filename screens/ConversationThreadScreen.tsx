import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef, useCallback } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChatsStackParamList } from '../navigation';
import { conversationsApi } from '../lib/api';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinary } from '../lib/cloudinary';

type Props = NativeStackScreenProps<ChatsStackParamList, 'ConversationThread'>;

type Message = {
  id: string;
  message_text: string | null;
  image_url?: string | null;
  direction: 'inbound' | 'outbound';
  sender_type: 'customer' | 'bot' | 'owner';
  sent_at: string;
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ConversationThreadScreen({ route, navigation }: Props) {
  const { conversationId, customerName } = route.params;
  const initials = customerName.slice(0, 2).toUpperCase();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAtBottomRef = useRef(true);

  const loadMessages = useCallback(async () => {
    try {
      setError('');
      const [data, noteData] = await Promise.all([
        conversationsApi.getMessages(conversationId),
        conversationsApi.getNote(conversationId),
      ]);
      setMessages(data);
      setNotes(noteData?.notes ?? '');
      conversationsApi.markAsRead(conversationId).catch(() => {});
    } catch {
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  async function handleSaveNote() {
    setSavingNote(true);
    try {
      await conversationsApi.updateNote(conversationId, notes);
      setNotesExpanded(false);
    } catch {
      Alert.alert('Error', 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
  }

  useEffect(() => {
    loadMessages();
    intervalRef.current = setInterval(loadMessages, 12000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadMessages]);

  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPendingImage(result.assets[0].uri);
    }
  }

  async function handleSend() {
    const text = replyText.trim();
    if (!text && !pendingImage) return;
    if (sending || uploadingImage) return;

    let imageUrl: string | undefined;
    if (pendingImage) {
      setUploadingImage(true);
      try {
        imageUrl = await uploadImageToCloudinary(pendingImage);
      } catch {
        Alert.alert('Error', 'Failed to upload image');
        setUploadingImage(false);
        return;
      }
      setUploadingImage(false);
    }

    setSending(true);
    setReplyText('');
    setPendingImage(null);

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      message_text: text || null,
      image_url: imageUrl ?? null,
      direction: 'outbound',
      sender_type: 'owner',
      sent_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMessage]);
    scrollRef.current?.scrollToEnd({ animated: true });

    try {
      const saved = await conversationsApi.reply(conversationId, text, imageUrl);
      setMessages((prev) => prev.map((m) => (m.id === tempMessage.id ? saved : m)));
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
      setReplyText(text);

      let title = 'Failed to send';
      let body = 'Could not send message. Please try again.';
      try {
        const parsed = JSON.parse(err?.message?.replace(/^API error \d+: /, '') ?? '{}');
        if (parsed.message) body = parsed.message;
      } catch {
        if (err?.message) body = err.message;
      }
      if (body.includes('24-hour') || body.includes('messaging window')) title = '⏰ Messaging window closed';
      else if (body.includes('token') || body.includes('reconnect')) title = '🔑 Connection issue';
      Alert.alert(title, body);
    } finally {
      setSending(false);
    }
  }

  const displayMessages = searchText
    ? messages.filter((m) => (m.message_text ?? '').toLowerCase().includes(searchText.toLowerCase()))
    : messages;

  const grouped: { date: string; messages: Message[] }[] = [];
  displayMessages.forEach((msg) => {
    const date = formatDate(msg.sent_at ?? msg.id);
    const last = grouped[grouped.length - 1];
    if (last && last.date === date) last.messages.push(msg);
    else grouped.push({ date, messages: [msg] });
  });

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1 bg-[#F0F2F5]">
        <StatusBar style="dark" />

        {/* Header */}
        <View className="bg-white pt-14 px-4 pb-3 flex-row items-center gap-3 border-b border-[#E4E6EB]">
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-1">
            <Ionicons name="arrow-back" size={24} color="#1C1E21" />
          </TouchableOpacity>
          {/* Avatar */}
          <View className="w-10 h-10 rounded-full bg-[#E8F8FF] items-center justify-center">
            <Text className="text-navy text-sm font-bold">{initials}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-[#1C1E21] font-bold text-base" numberOfLines={1}>{customerName}</Text>
            <Text className="text-[#65676B] text-xs">via Messenger</Text>
          </View>
          <TouchableOpacity
            onPress={() => { setSearchVisible((v) => !v); if (searchVisible) setSearchText(''); }}
            className="p-2"
          >
            <Ionicons name={searchVisible ? 'close' : 'search-outline'} size={20} color="#65676B" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#0E1C40" />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="cloud-offline" size={48} color="#cbd5e1" />
            <Text className="text-[#65676B] text-base mt-3 text-center">{error}</Text>
            <TouchableOpacity className="mt-4 bg-navy rounded-xl px-6 py-3" onPress={loadMessages}>
              <Text className="text-white font-semibold">Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Search bar */}
            {searchVisible && (
              <View className="bg-white border-b border-[#E4E6EB] px-4 py-2">
                <View className="flex-row items-center bg-[#F0F2F5] rounded-xl px-3 gap-2">
                  <Ionicons name="search" size={15} color="#65676B" />
                  <TextInput
                    className="flex-1 py-2.5 text-[#1C1E21] text-sm"
                    placeholder="Search messages..."
                    placeholderTextColor="#65676B"
                    value={searchText}
                    onChangeText={setSearchText}
                    autoFocus
                  />
                  {searchText.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchText('')}>
                      <Ionicons name="close-circle" size={16} color="#65676B" />
                    </TouchableOpacity>
                  )}
                </View>
                {searchText.length > 0 && (
                  <Text className="text-[#65676B] text-xs mt-1 ml-1">
                    {messages.filter((m) => (m.message_text ?? '').toLowerCase().includes(searchText.toLowerCase())).length} result(s)
                  </Text>
                )}
              </View>
            )}

            {/* Notes bar */}
            <TouchableOpacity
              className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 flex-row items-center gap-2"
              onPress={() => setNotesExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Ionicons name="document-text-outline" size={14} color="#92400e" />
              <Text className="flex-1 text-amber-800 text-xs font-medium" numberOfLines={1}>
                {notes.trim() ? notes.trim() : 'Add a private note about this customer…'}
              </Text>
              <Ionicons name={notesExpanded ? 'chevron-up' : 'chevron-down'} size={13} color="#92400e" />
            </TouchableOpacity>
            {notesExpanded && (
              <View className="bg-amber-50 border-b border-amber-100 px-4 pb-3">
                <TextInput
                  className="bg-white border border-amber-200 rounded-xl px-3 py-2.5 text-slate-700 text-sm mt-2"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Private notes (not visible to customer)"
                  placeholderTextColor="#a16207"
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                  style={{ minHeight: 72 }}
                />
                <View className="flex-row justify-end mt-2">
                  <TouchableOpacity
                    className="bg-amber-700 rounded-xl px-4 py-2 flex-row items-center gap-1"
                    onPress={handleSaveNote}
                    disabled={savingNote}
                  >
                    {savingNote ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={13} color="white" />
                        <Text className="text-white text-xs font-semibold">Save Note</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 16, paddingBottom: 8 }}
              onContentSizeChange={() => {
                if (isAtBottomRef.current) scrollRef.current?.scrollToEnd({ animated: false });
              }}
              onScroll={(e) => {
                const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
                isAtBottomRef.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
              }}
              scrollEventThrottle={200}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0E1C40" />}
            >
              {messages.length === 0 && (
                <View className="items-center pt-16">
                  <View className="bg-[#E8F8FF] rounded-full p-6 mb-4">
                    <Ionicons name="chatbubbles-outline" size={40} color="#0E1C40" />
                  </View>
                  <Text className="text-[#1C1E21] font-semibold">No messages yet</Text>
                </View>
              )}

              {grouped.map((group) => (
                <View key={group.date}>
                  {/* Date separator */}
                  <View className="items-center my-4">
                    <View className="bg-[#E4E6EB] rounded-full px-3 py-1">
                      <Text className="text-[#65676B] text-xs font-medium">{group.date}</Text>
                    </View>
                  </View>

                  {group.messages.map((msg, idx) => {
                    const isInbound = msg.direction === 'inbound';
                    const isBot = msg.sender_type === 'bot';
                    const prevMsg = group.messages[idx - 1];
                    const showAvatar = isInbound && (idx === 0 || prevMsg?.direction !== 'inbound');

                    return (
                      <View
                        key={msg.id}
                        className={`mb-1 ${isInbound ? 'items-start' : 'items-end'}`}
                      >
                        {/* Bot label */}
                        {!isInbound && isBot && (
                          <View className="flex-row items-center gap-1 mb-1 mr-1">
                            <Ionicons name="flash" size={10} color="#00C5FF" />
                            <Text className="text-[#65676B] text-xs">Reili Bot</Text>
                          </View>
                        )}

                        <View className={`flex-row items-end gap-2 ${isInbound ? 'flex-row' : 'flex-row-reverse'}`}>
                          {/* Customer avatar (only for first in a sequence) */}
                          {isInbound && (
                            <View className="w-7 h-7 flex-shrink-0">
                              {showAvatar && (
                                <View className="w-7 h-7 rounded-full bg-[#E8F8FF] items-center justify-center">
                                  <Text className="text-navy text-xs font-bold">{initials}</Text>
                                </View>
                              )}
                            </View>
                          )}

                          <View style={{ maxWidth: '72%' }}>
                            {/* Image */}
                            {msg.image_url && (
                              <Image
                                source={{ uri: msg.image_url }}
                                style={{
                                  width: 200,
                                  height: 150,
                                  borderRadius: 16,
                                  marginBottom: msg.message_text ? 4 : 0,
                                }}
                                resizeMode="cover"
                              />
                            )}
                            {/* Text bubble */}
                            {msg.message_text ? (
                              <View
                                className={`px-4 py-2.5 rounded-2xl ${
                                  isInbound
                                    ? 'bg-white rounded-bl-sm'
                                    : isBot
                                    ? 'bg-navy-mid rounded-br-sm'
                                    : 'bg-navy rounded-br-sm'
                                }`}
                                style={isInbound ? {
                                  shadowColor: '#000',
                                  shadowOffset: { width: 0, height: 1 },
                                  shadowOpacity: 0.06,
                                  shadowRadius: 3,
                                  elevation: 1,
                                } : {}}
                              >
                                <Text
                                  className={`text-sm leading-5 ${isInbound ? 'text-[#1C1E21]' : 'text-white'}`}
                                >
                                  {msg.message_text}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>

                        <Text className={`text-xs text-[#65676B] mt-1 ${isInbound ? 'ml-9' : 'mr-1'}`}>
                          {formatTime(msg.sent_at ?? '')}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {/* Reply input bar */}
        <View className="bg-white border-t border-[#E4E6EB] px-3 py-3">
          {pendingImage && (
            <View className="flex-row items-center mb-2 gap-2">
              <Image source={{ uri: pendingImage }} className="w-16 h-16 rounded-xl" resizeMode="cover" />
              <TouchableOpacity onPress={() => setPendingImage(null)}>
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              </TouchableOpacity>
              {uploadingImage && <ActivityIndicator size="small" color="#0E1C40" />}
            </View>
          )}
          <View className="flex-row items-end gap-2">
            <TouchableOpacity className="p-2.5 rounded-full bg-[#F0F2F5]" onPress={handlePickImage}>
              <Ionicons name="image-outline" size={20} color="#65676B" />
            </TouchableOpacity>
            <View className="flex-1 bg-[#F0F2F5] rounded-2xl px-4 py-2.5 min-h-[40px] justify-center">
              <TextInput
                placeholder="Aa"
                placeholderTextColor="#65676B"
                value={replyText}
                onChangeText={setReplyText}
                multiline
                maxLength={2000}
                style={{ color: '#1C1E21', fontSize: 14, maxHeight: 100, padding: 0 }}
                onSubmitEditing={handleSend}
              />
            </View>
            <TouchableOpacity
              className={`p-2.5 rounded-full ${replyText.trim().length > 0 || pendingImage ? 'bg-navy' : 'bg-[#F0F2F5]'}`}
              onPress={handleSend}
              disabled={(replyText.trim().length === 0 && !pendingImage) || sending || uploadingImage}
            >
              {sending || uploadingImage ? (
                <ActivityIndicator size="small" color="#00C5FF" />
              ) : (
                <Ionicons
                  name="send"
                  size={18}
                  color={replyText.trim().length > 0 || pendingImage ? '#00C5FF' : '#65676B'}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
