import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform, RefreshControl, Alert, Image,
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

// Keep amber accent specifically for notes UI
const AMBER = '#D97706';
const AMBER_BG = 'rgba(217,119,6,0.08)';
const AMBER_BORDER = 'rgba(217,119,6,0.20)';
const AMBER_MUTED = 'rgba(217,119,6,0.45)';

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
    try { await conversationsApi.updateNote(conversationId, notes); setNotesExpanded(false); }
    catch { Alert.alert('Error', 'Failed to save note'); }
    finally { setSavingNote(false); }
  }

  async function onRefresh() { setRefreshing(true); await loadMessages(); setRefreshing(false); }

  useEffect(() => {
    loadMessages();
    intervalRef.current = setInterval(loadMessages, 12000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadMessages]);

  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets?.[0]) setPendingImage(result.assets[0].uri);
  }

  async function handleSend() {
    const text = replyText.trim();
    if (!text && !pendingImage) return;
    if (sending || uploadingImage) return;

    let imageUrl: string | undefined;
    if (pendingImage) {
      setUploadingImage(true);
      try { imageUrl = await uploadImageToCloudinary(pendingImage); }
      catch { Alert.alert('Error', 'Failed to upload image'); setUploadingImage(false); return; }
      setUploadingImage(false);
    }

    setSending(true);
    setReplyText('');
    setPendingImage(null);

    const tempMessage: Message = {
      id: `temp-${Date.now()}`, message_text: text || null, image_url: imageUrl ?? null,
      direction: 'outbound', sender_type: 'owner', sent_at: new Date().toISOString(),
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
      } catch { if (err?.message) body = err.message; }
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

  const canSend = replyText.trim().length > 0 || !!pendingImage;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar style="dark" />

        {/* Header */}
        <View style={{ backgroundColor: C.white, paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color={C.navy} />
          </TouchableOpacity>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.navyFade, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.navy, fontSize: 13, fontWeight: '800' }}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>{customerName}</Text>
            <Text style={{ color: C.text3, fontSize: 11 }}>via Messenger</Text>
          </View>
          <TouchableOpacity
            onPress={() => { setSearchVisible((v) => !v); if (searchVisible) setSearchText(''); }}
            style={{ padding: 8 }}
          >
            <Ionicons name={searchVisible ? 'close' : 'search-outline'} size={19} color={C.text2} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={C.navy} />
          </View>
        ) : error ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Ionicons name="cloud-offline" size={48} color={C.text3} />
            <Text style={{ color: C.text2, fontSize: 15, marginTop: 12, textAlign: 'center' }}>{error}</Text>
            <TouchableOpacity style={{ marginTop: 16, backgroundColor: C.navy, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }} onPress={loadMessages}>
              <Text style={{ color: C.white, fontWeight: '700' }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Search bar */}
            {searchVisible && (
              <View style={{ backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 16, paddingVertical: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 12, gap: 8, borderWidth: 1, borderColor: C.border }}>
                  <Ionicons name="search" size={14} color={C.text3} />
                  <TextInput
                    style={{ flex: 1, paddingVertical: 9, color: C.text, fontSize: 14 }}
                    placeholder="Search messages..."
                    placeholderTextColor={C.text3}
                    value={searchText}
                    onChangeText={setSearchText}
                    autoFocus
                  />
                  {searchText.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchText('')}>
                      <Ionicons name="close-circle" size={15} color={C.text3} />
                    </TouchableOpacity>
                  )}
                </View>
                {searchText.length > 0 && (
                  <Text style={{ color: C.text3, fontSize: 11, marginTop: 4, marginLeft: 4 }}>
                    {messages.filter((m) => (m.message_text ?? '').toLowerCase().includes(searchText.toLowerCase())).length} result(s)
                  </Text>
                )}
              </View>
            )}

            {/* Notes bar */}
            <TouchableOpacity
              style={{ backgroundColor: AMBER_BG, borderBottomWidth: 1, borderBottomColor: AMBER_BORDER, borderLeftWidth: 3, borderLeftColor: AMBER, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              onPress={() => setNotesExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Ionicons name="document-text-outline" size={13} color={AMBER} />
              <Text style={{ flex: 1, color: AMBER, fontSize: 12, fontWeight: '500' }} numberOfLines={1}>
                {notes.trim() ? notes.trim() : 'Add a private note about this customer…'}
              </Text>
              <Ionicons name={notesExpanded ? 'chevron-up' : 'chevron-down'} size={12} color={AMBER} />
            </TouchableOpacity>
            {notesExpanded && (
              <View style={{ backgroundColor: AMBER_BG, borderBottomWidth: 1, borderBottomColor: AMBER_BORDER, paddingHorizontal: 16, paddingBottom: 12 }}>
                <TextInput
                  style={{ backgroundColor: C.white, borderWidth: 1, borderColor: AMBER_BORDER, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: C.text, fontSize: 13, marginTop: 8, minHeight: 72, textAlignVertical: 'top' }}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Private notes (not visible to customer)"
                  placeholderTextColor={AMBER_MUTED}
                  multiline
                  maxLength={1000}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                  <TouchableOpacity
                    style={{ backgroundColor: 'rgba(217,119,6,0.12)', borderWidth: 1, borderColor: AMBER_BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5 }}
                    onPress={handleSaveNote}
                    disabled={savingNote}
                  >
                    {savingNote ? <ActivityIndicator size="small" color={AMBER} /> : (
                      <><Ionicons name="checkmark" size={13} color={AMBER} /><Text style={{ color: AMBER, fontSize: 12, fontWeight: '700' }}>Save Note</Text></>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 16, paddingBottom: 8 }}
              onContentSizeChange={() => { if (isAtBottomRef.current) scrollRef.current?.scrollToEnd({ animated: false }); }}
              onScroll={(e) => {
                const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
                isAtBottomRef.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
              }}
              scrollEventThrottle={200}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy} />}
            >
              {messages.length === 0 && (
                <View style={{ alignItems: 'center', paddingTop: 48 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.navyFade, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <Ionicons name="chatbubbles-outline" size={32} color={C.navy} />
                  </View>
                  <Text style={{ color: C.text2, fontWeight: '600' }}>No messages yet</Text>
                </View>
              )}

              {grouped.map((group) => (
                <View key={group.date}>
                  {/* Date separator */}
                  <View style={{ alignItems: 'center', marginVertical: 12 }}>
                    <View style={{ backgroundColor: C.light, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: C.border }}>
                      <Text style={{ color: C.text3, fontSize: 11, fontWeight: '600' }}>{group.date}</Text>
                    </View>
                  </View>

                  {group.messages.map((msg, idx) => {
                    const isInbound = msg.direction === 'inbound';
                    const isBot = msg.sender_type === 'bot';
                    const prevMsg = group.messages[idx - 1];
                    const showAvatar = isInbound && (idx === 0 || prevMsg?.direction !== 'inbound');

                    return (
                      <View key={msg.id} style={{ marginBottom: 4, alignItems: isInbound ? 'flex-start' : 'flex-end' }}>
                        {/* Bot label */}
                        {!isInbound && isBot && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3, marginRight: 4 }}>
                            <Ionicons name="flash" size={9} color={C.blue} />
                            <Text style={{ color: C.text3, fontSize: 10 }}>Reili Bot</Text>
                          </View>
                        )}

                        <View style={{ flexDirection: isInbound ? 'row' : 'row-reverse', alignItems: 'flex-end', gap: 8 }}>
                          {/* Customer avatar */}
                          {isInbound && (
                            <View style={{ width: 26, height: 26, flexShrink: 0 }}>
                              {showAvatar && (
                                <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: C.navyFade, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
                                  <Text style={{ color: C.navy, fontSize: 9, fontWeight: '800' }}>{initials}</Text>
                                </View>
                              )}
                            </View>
                          )}

                          <View style={{ maxWidth: '72%' }}>
                            {/* Image */}
                            {msg.image_url && (
                              <Image
                                source={{ uri: msg.image_url }}
                                style={{ width: 200, height: 150, borderRadius: 14, marginBottom: msg.message_text ? 4 : 0 }}
                                resizeMode="cover"
                              />
                            )}
                            {/* Text bubble */}
                            {msg.message_text ? (
                              <View style={{
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                borderRadius: 18,
                                ...(isInbound ? {
                                  backgroundColor: C.white,
                                  borderWidth: 1,
                                  borderColor: C.border,
                                  borderBottomLeftRadius: 4,
                                } : isBot ? {
                                  backgroundColor: C.light,
                                  borderWidth: 1,
                                  borderColor: C.border,
                                  borderBottomRightRadius: 4,
                                } : {
                                  backgroundColor: C.navy,
                                  borderBottomRightRadius: 4,
                                }),
                              }}>
                                <Text style={{
                                  fontSize: 14,
                                  lineHeight: 20,
                                  color: isInbound ? C.text : isBot ? C.navy : C.white,
                                }}>
                                  {msg.message_text}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>

                        <Text style={{ fontSize: 10, color: C.text3, marginTop: 3, ...(isInbound ? { marginLeft: 34 } : { marginRight: 4 }) }}>
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
        <View style={{ backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 12, paddingVertical: 12 }}>
          {pendingImage && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
              <Image source={{ uri: pendingImage }} style={{ width: 56, height: 56, borderRadius: 10 }} resizeMode="cover" />
              <TouchableOpacity onPress={() => setPendingImage(null)}>
                <Ionicons name="close-circle" size={20} color={C.text3} />
              </TouchableOpacity>
              {uploadingImage && <ActivityIndicator size="small" color={C.navy} />}
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <TouchableOpacity style={{ padding: 10, borderRadius: 12, backgroundColor: C.light, borderWidth: 1, borderColor: C.border }} onPress={handlePickImage}>
              <Ionicons name="image-outline" size={19} color={C.navy} />
            </TouchableOpacity>
            <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: C.border }}>
              <TextInput
                placeholder="Aa"
                placeholderTextColor={C.text3}
                value={replyText}
                onChangeText={setReplyText}
                multiline
                maxLength={2000}
                style={{ color: C.text, fontSize: 14, maxHeight: 100, padding: 0 }}
                onSubmitEditing={handleSend}
              />
            </View>
            <TouchableOpacity
              style={{
                padding: 10, borderRadius: 12,
                backgroundColor: canSend ? C.navy : C.light,
                borderWidth: 1,
                borderColor: canSend ? C.navy : C.border,
              }}
              onPress={handleSend}
              disabled={!canSend || sending || uploadingImage}
            >
              {sending || uploadingImage ? (
                <ActivityIndicator size="small" color={C.white} />
              ) : (
                <Ionicons name="send" size={17} color={canSend ? C.white : C.text3} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
