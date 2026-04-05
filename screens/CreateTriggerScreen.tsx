import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../navigation';
import { triggersApi } from '../lib/api';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinary } from '../lib/cloudinary';

type Props = NativeStackScreenProps<MoreStackParamList, 'CreateTrigger'>;

export default function CreateTriggerScreen({ route, navigation }: Props) {
  const { pageId, triggerId } = route.params;
  const isEditing = !!triggerId;

  const [keywords, setKeywords] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [reply, setReply] = useState('');
  const [matchMode, setMatchMode] = useState<'contains' | 'exact' | 'starts_with'>('contains');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [qrInput, setQrInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const initialStateRef = useRef<{ keywords: string[]; reply: string; matchMode: string; imageUrl: string | null; quickReplies: string[] } | null>(null);

  // Set initial state snapshot for new triggers immediately
  useEffect(() => {
    if (!isEditing) {
      initialStateRef.current = { keywords: [], reply: '', matchMode: 'contains', imageUrl: null, quickReplies: [] };
    }
  }, []);

  // Warn on unsaved changes when navigating back
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (saving) return;
      const init = initialStateRef.current;
      if (!init) return;
      const hasChanges =
        JSON.stringify(keywords) !== JSON.stringify(init.keywords) ||
        reply !== init.reply ||
        matchMode !== init.matchMode ||
        imageUrl !== init.imageUrl ||
        JSON.stringify(quickReplies) !== JSON.stringify(init.quickReplies);
      if (!hasChanges) return;
      e.preventDefault();
      Alert.alert(
        'Discard changes?',
        'You have unsaved changes. Leave without saving?',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              initialStateRef.current = null;
              navigation.dispatch(e.data.action);
            },
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, saving, keywords, reply, matchMode, imageUrl, quickReplies]);

  useEffect(() => {
    if (!isEditing) return;
    triggersApi.getAll(pageId).then((data) => {
      const trigger = data.find((t: any) => t.id === triggerId);
      if (trigger) {
        setKeywords(trigger.keywords);
        setReply(trigger.response_text);
        if (trigger.match_mode) setMatchMode(trigger.match_mode as any);
        if (trigger.image_url) {
          setImageUri(trigger.image_url);
          setImageUrl(trigger.image_url);
        }
        if (trigger.quick_replies?.length) {
          setQuickReplies(trigger.quick_replies.map((qr: any) => qr.title));
        }
        initialStateRef.current = {
          keywords: trigger.keywords,
          reply: trigger.response_text,
          matchMode: trigger.match_mode ?? 'contains',
          imageUrl: trigger.image_url ?? null,
          quickReplies: trigger.quick_replies?.map((qr: any) => qr.title) ?? [],
        };
      }
      setLoading(false);
    });
  }, []);

  async function handlePickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow access to your photo library to attach images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled) return;

    const uri = result.assets[0].uri;
    setImageUri(uri);
    setImageUrl(null);
    setUploadingImage(true);
    try {
      const url = await uploadImageToCloudinary(uri);
      setImageUrl(url);
    } catch {
      Alert.alert('Upload failed', 'Could not upload image. Check your connection and try again.');
      setImageUri(null);
    } finally {
      setUploadingImage(false);
    }
  }

  function handleRemoveImage() {
    setImageUri(null);
    setImageUrl(null);
  }

  function addKeyword() {
    const trimmed = input.trim().toLowerCase();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
    }
    setInput('');
  }

  async function handleSave() {
    if (keywords.length === 0) {
      Alert.alert('Missing keywords', 'Add at least one keyword.');
      return;
    }
    if (!reply.trim()) {
      Alert.alert('Missing reply', 'Write a bot reply message.');
      return;
    }
    if (uploadingImage) {
      Alert.alert('Please wait', 'Image is still uploading...');
      return;
    }
    setSaving(true);
    try {
      const qrPayload = quickReplies.map((title) => ({ title, payload: title.toLowerCase() }));
      const payload = {
        keywords,
        response_text: reply.trim(),
        image_url: imageUrl ?? undefined,
        quick_replies: qrPayload,
        match_mode: matchMode,
      };
      if (isEditing && triggerId) {
        await triggersApi.update(pageId, triggerId, payload);
      } else {
        await triggersApi.create(pageId, payload);
      }
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to save trigger. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F0F2F5]">
        <ActivityIndicator size="large" color="#0E1C40" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F0F2F5]">
      <StatusBar style="dark" />

      {/* Header */}
      <View className="bg-white pt-14 pb-4 px-4 flex-row items-center border-b border-[#E4E6EB]">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={24} color="#1C1E21" />
        </TouchableOpacity>
        <Text className="text-[#1C1E21] text-xl font-bold flex-1">
          {isEditing ? 'Edit Trigger' : 'New Trigger'}
        </Text>
        <TouchableOpacity
          className="bg-navy rounded-xl px-4 py-2"
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#00C5FF" />
          ) : (
            <Text className="text-white text-sm font-bold">Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* Keywords */}
        <View
          className="bg-white rounded-2xl p-4 mb-3"
          style={{ shadowColor: '#0E1C40', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
        >
          <View className="flex-row items-center gap-2 mb-1">
            <Ionicons name="key" size={16} color="#0E1C40" />
            <Text className="text-navy font-semibold text-base">Keywords</Text>
          </View>
          <Text className="text-slate-400 text-xs mb-3 leading-4">
            When any of these words appear in a message, the bot replies.
          </Text>

          {keywords.length > 0 && (
            <View className="flex-row flex-wrap gap-2 mb-3">
              {keywords.map((kw) => (
                <TouchableOpacity
                  key={kw}
                  className="flex-row items-center gap-1.5 bg-cyan-light rounded-lg px-3 py-1.5"
                  onPress={() => setKeywords(keywords.filter((k) => k !== kw))}
                >
                  <Text className="text-navy text-sm font-medium">{kw}</Text>
                  <Ionicons name="close-circle" size={14} color="#0E1C40" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View className="flex-row gap-2">
            <TextInput
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-navy text-sm"
              placeholder="Type a keyword..."
              placeholderTextColor="#94a3b8"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={addKeyword}
              returnKeyType="done"
              autoCapitalize="none"
            />
            <TouchableOpacity
              className="bg-navy rounded-xl px-4 items-center justify-center"
              onPress={addKeyword}
            >
              <Ionicons name="add" size={22} color="#00C5FF" />
            </TouchableOpacity>
          </View>
          <Text className="text-slate-400 text-xs mt-2 leading-4">
            Tip: Add "how much", "presyo", "magkano" — all trigger the same reply.
          </Text>
        </View>

        {/* Match Mode */}
        <View
          className="bg-white rounded-2xl p-4 mb-3"
          style={{ shadowColor: '#0E1C40', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
        >
          <View className="flex-row items-center gap-2 mb-1">
            <Ionicons name="options" size={16} color="#0E1C40" />
            <Text className="text-navy font-semibold text-base">Match Mode</Text>
          </View>
          <Text className="text-slate-400 text-xs mb-3 leading-4">
            How strictly the keyword must appear in the customer's message.
          </Text>
          <View className="flex-row gap-2">
            {([
              { key: 'contains', label: 'Contains' },
              { key: 'starts_with', label: 'Starts with' },
              { key: 'exact', label: 'Exact' },
            ] as const).map((mode) => (
              <TouchableOpacity
                key={mode.key}
                className={`flex-1 py-2.5 rounded-xl items-center ${matchMode === mode.key ? 'bg-navy' : 'bg-slate-100'}`}
                onPress={() => setMatchMode(mode.key)}
              >
                <Text className={`text-xs font-semibold ${matchMode === mode.key ? 'text-cyan' : 'text-slate-500'}`}>
                  {mode.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text className="text-slate-400 text-xs mt-2 leading-4">
            {matchMode === 'contains' ? 'Fires when keyword appears anywhere in the message.' :
             matchMode === 'starts_with' ? 'Fires when the message begins with the keyword.' :
             'Fires only when the message is exactly the keyword.'}
          </Text>
        </View>

        {/* Bot Reply */}
        <View
          className="bg-white rounded-2xl p-4 mb-3"
          style={{ shadowColor: '#0E1C40', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
        >
          <View className="flex-row items-center gap-2 mb-1">
            <Ionicons name="chatbubble-ellipses" size={16} color="#0E1C40" />
            <Text className="text-navy font-semibold text-base">Bot Reply</Text>
          </View>
          <Text className="text-slate-400 text-xs mb-3 leading-4">
            This message is sent automatically when a keyword is detected.
          </Text>
          <TextInput
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-navy text-sm"
            placeholder={'Type your reply here...\n\nExample:\nHi po! Here are our prices 😊\n• Small: ₱350\n• Medium: ₱380'}
            placeholderTextColor="#94a3b8"
            value={reply}
            onChangeText={setReply}
            multiline
            textAlignVertical="top"
            maxLength={2000}
            style={{ minHeight: 120 }}
          />
          <Text className="text-slate-400 text-xs mt-2 text-right">{reply.length}/2000</Text>
        </View>

        {/* Quick Reply Buttons */}
        <View
          className="bg-white rounded-2xl p-4 mb-3"
          style={{ shadowColor: '#0E1C40', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
        >
          <View className="flex-row items-center gap-2 mb-1">
            <Ionicons name="apps" size={16} color="#0E1C40" />
            <Text className="text-navy font-semibold text-base">Quick Reply Buttons</Text>
            <View className="bg-cyan-light rounded-lg px-2 py-0.5 ml-1">
              <Text className="text-navy text-xs font-medium">Optional</Text>
            </View>
          </View>
          <Text className="text-slate-400 text-xs mb-3 leading-4">
            Tappable buttons shown below your reply. Customers tap instead of typing. Max 5, 20 chars each.
          </Text>

          {quickReplies.length > 0 && (
            <View className="flex-row flex-wrap gap-2 mb-3">
              {quickReplies.map((btn) => (
                <TouchableOpacity
                  key={btn}
                  className="flex-row items-center gap-1.5 bg-navy rounded-xl px-3 py-2"
                  onPress={() => setQuickReplies(quickReplies.filter((b) => b !== btn))}
                >
                  <Text className="text-white text-xs font-medium">{btn}</Text>
                  <Ionicons name="close-circle" size={13} color="#00C5FF" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {quickReplies.length < 5 && (
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-navy text-sm"
                placeholder='E.g. "Magkano?" or "Mag-order"'
                placeholderTextColor="#94a3b8"
                value={qrInput}
                onChangeText={(t) => setQrInput(t.slice(0, 20))}
                returnKeyType="done"
                onSubmitEditing={() => {
                  const trimmed = qrInput.trim();
                  if (trimmed && !quickReplies.includes(trimmed)) {
                    setQuickReplies([...quickReplies, trimmed]);
                  }
                  setQrInput('');
                }}
              />
              <TouchableOpacity
                className="bg-navy rounded-xl px-4 items-center justify-center"
                onPress={() => {
                  const trimmed = qrInput.trim();
                  if (trimmed && !quickReplies.includes(trimmed)) {
                    setQuickReplies([...quickReplies, trimmed]);
                  }
                  setQrInput('');
                }}
              >
                <Ionicons name="add" size={22} color="#00C5FF" />
              </TouchableOpacity>
            </View>
          )}
          {qrInput.length > 0 && (
            <Text className="text-slate-400 text-xs mt-1 text-right">{qrInput.length}/20</Text>
          )}
        </View>

        {/* Attach image */}
        <View
          className="bg-white rounded-2xl p-4 mb-3"
          style={{ shadowColor: '#0E1C40', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
        >
          <View className="flex-row items-center gap-2 mb-1">
            <Ionicons name="image" size={16} color="#0E1C40" />
            <Text className="text-navy font-semibold text-base">Product Image</Text>
            <View className="bg-cyan-light rounded-lg px-2 py-0.5 ml-1">
              <Text className="text-navy text-xs font-medium">Optional</Text>
            </View>
          </View>
          <Text className="text-slate-400 text-xs mb-3 leading-4">
            Attach a product photo or price list. Sent after the reply text.
          </Text>

          {imageUri ? (
            <View>
              <Image
                source={{ uri: imageUri }}
                className="w-full rounded-xl mb-2"
                style={{ height: 160 }}
                resizeMode="cover"
              />
              <View className="flex-row items-center gap-2">
                {uploadingImage ? (
                  <View className="flex-1 flex-row items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                    <ActivityIndicator size="small" color="#0E1C40" />
                    <Text className="text-slate-500 text-xs">Uploading...</Text>
                  </View>
                ) : imageUrl ? (
                  <View className="flex-1 flex-row items-center gap-1.5 bg-emerald-50 rounded-xl px-3 py-2">
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text className="text-emerald-700 text-xs font-medium">Uploaded</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  className="flex-row items-center gap-1 bg-red-50 rounded-xl px-3 py-2"
                  onPress={handleRemoveImage}
                >
                  <Ionicons name="trash-outline" size={14} color="#dc2626" />
                  <Text className="text-red-600 text-xs font-medium">Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              className="border-2 border-dashed border-slate-200 rounded-xl py-6 items-center gap-2"
              onPress={handlePickImage}
            >
              <View className="bg-cyan-light rounded-full p-3">
                <Ionicons name="cloud-upload-outline" size={22} color="#0E1C40" />
              </View>
              <Text className="text-navy text-sm font-medium">Tap to pick a photo</Text>
              <Text className="text-slate-400 text-xs">JPG, PNG — max 10MB</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Preview */}
        {(keywords.length > 0 || reply.length > 0) && (
          <View
            className="bg-white rounded-2xl p-4"
            style={{ shadowColor: '#0E1C40', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
          >
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="eye" size={16} color="#0E1C40" />
              <Text className="text-navy font-semibold text-base">Preview</Text>
            </View>
            {keywords.length > 0 && (
              <View className="bg-slate-100 rounded-2xl rounded-tl-none px-4 py-3 self-start max-w-xs mb-2">
                <Text className="text-slate-700 text-sm">{keywords[0]}</Text>
              </View>
            )}
            {reply.length > 0 && (
              <View className="bg-navy rounded-2xl rounded-tr-none px-4 py-3 self-end max-w-xs">
                <Text className="text-white text-sm leading-5">{reply}</Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}
