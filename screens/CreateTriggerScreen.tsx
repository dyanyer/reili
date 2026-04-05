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

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border }}>
      {children}
    </View>
  );
}

function CardHeader({ icon, iconColor, iconBg, title, badge }: { icon: string; iconColor: string; iconBg: string; title: string; badge?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon as any} size={15} color={iconColor} />
      </View>
      <Text style={{ color: C.text, fontSize: 15, fontWeight: '700', flex: 1 }}>{title}</Text>
      {badge && (
        <View style={{ backgroundColor: C.navyFade, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.text3, fontSize: 10, fontWeight: '700' }}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

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

  useEffect(() => {
    if (!isEditing) {
      initialStateRef.current = { keywords: [], reply: '', matchMode: 'contains', imageUrl: null, quickReplies: [] };
    }
  }, []);

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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.blue} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={{ backgroundColor: C.white, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12, padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={C.navy} />
        </TouchableOpacity>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', flex: 1 }}>
          {isEditing ? 'Edit Trigger' : 'New Trigger'}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: saving ? C.light : C.navy, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, borderWidth: saving ? 1 : 0, borderColor: C.border }}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={C.navy} />
          ) : (
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* Keywords */}
        <SectionCard>
          <CardHeader icon="key" iconColor={C.navy} iconBg={C.navyMid} title="Keywords" />
          <Text style={{ color: C.text3, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
            When any of these words appear in a message, the bot replies.
          </Text>

          {keywords.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {keywords.map((kw) => (
                <TouchableOpacity
                  key={kw}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.light, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: C.border }}
                  onPress={() => setKeywords(keywords.filter((k) => k !== kw))}
                >
                  <Text style={{ color: C.navy, fontSize: 13, fontWeight: '600' }}>{kw}</Text>
                  <Ionicons name="close-circle" size={14} color={C.navy} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              style={{ flex: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 13 }}
              placeholder="Type a keyword..."
              placeholderTextColor={C.text3}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={addKeyword}
              returnKeyType="done"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={{ backgroundColor: C.navy, borderRadius: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}
              onPress={addKeyword}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={{ color: C.text3, fontSize: 11, marginTop: 8, lineHeight: 16 }}>
            Tip: Add "how much", "presyo", "magkano" — all trigger the same reply.
          </Text>
        </SectionCard>

        {/* Match Mode */}
        <SectionCard>
          <CardHeader icon="options" iconColor={C.blue} iconBg={C.navyMid} title="Match Mode" />
          <Text style={{ color: C.text3, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
            How strictly the keyword must appear in the customer's message.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([
              { key: 'contains', label: 'Contains' },
              { key: 'starts_with', label: 'Starts with' },
              { key: 'exact', label: 'Exact' },
            ] as const).map((mode) => (
              <TouchableOpacity
                key={mode.key}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: matchMode === mode.key ? C.navy : C.light,
                  borderWidth: 1,
                  borderColor: matchMode === mode.key ? C.navy : C.border,
                }}
                onPress={() => setMatchMode(mode.key)}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: matchMode === mode.key ? '#FFFFFF' : C.navy }}>
                  {mode.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ color: C.text3, fontSize: 11, marginTop: 10, lineHeight: 16 }}>
            {matchMode === 'contains' ? 'Fires when keyword appears anywhere in the message.' :
             matchMode === 'starts_with' ? 'Fires when the message begins with the keyword.' :
             'Fires only when the message is exactly the keyword.'}
          </Text>
        </SectionCard>

        {/* Bot Reply */}
        <SectionCard>
          <CardHeader icon="chatbubble-ellipses" iconColor={C.green} iconBg={C.greenBg} title="Bot Reply" />
          <Text style={{ color: C.text3, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
            This message is sent automatically when a keyword is detected.
          </Text>
          <TextInput
            style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 13, minHeight: 120, textAlignVertical: 'top' }}
            placeholder={'Type your reply here...\n\nExample:\nHi po! Here are our prices 😊\n• Small: ₱350\n• Medium: ₱380'}
            placeholderTextColor={C.text3}
            value={reply}
            onChangeText={setReply}
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={{ color: C.text3, fontSize: 11, marginTop: 6, textAlign: 'right' }}>{reply.length}/2000</Text>
        </SectionCard>

        {/* Quick Reply Buttons */}
        <SectionCard>
          <CardHeader icon="apps" iconColor={C.blue} iconBg={C.navyMid} title="Quick Reply Buttons" badge="Optional" />
          <Text style={{ color: C.text3, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
            Tappable buttons shown below your reply. Customers tap instead of typing. Max 5, 20 chars each.
          </Text>

          {quickReplies.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {quickReplies.map((btn) => (
                <TouchableOpacity
                  key={btn}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.light, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border }}
                  onPress={() => setQuickReplies(quickReplies.filter((b) => b !== btn))}
                >
                  <Text style={{ color: C.navy, fontSize: 12, fontWeight: '600' }}>{btn}</Text>
                  <Ionicons name="close-circle" size={13} color={C.text3} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {quickReplies.length < 5 && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                style={{ flex: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 13 }}
                placeholder='E.g. "Magkano?" or "Mag-order"'
                placeholderTextColor={C.text3}
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
                style={{ backgroundColor: C.navy, borderRadius: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => {
                  const trimmed = qrInput.trim();
                  if (trimmed && !quickReplies.includes(trimmed)) {
                    setQuickReplies([...quickReplies, trimmed]);
                  }
                  setQrInput('');
                }}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          {qrInput.length > 0 && (
            <Text style={{ color: C.text3, fontSize: 11, marginTop: 6, textAlign: 'right' }}>{qrInput.length}/20</Text>
          )}
        </SectionCard>

        {/* Attach image */}
        <SectionCard>
          <CardHeader icon="image" iconColor={C.navy} iconBg={C.navyMid} title="Product Image" badge="Optional" />
          <Text style={{ color: C.text3, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
            Attach a product photo or price list. Sent after the reply text.
          </Text>

          {imageUri ? (
            <View>
              <Image
                source={{ uri: imageUri }}
                style={{ width: '100%', height: 160, borderRadius: 14, marginBottom: 10 }}
                resizeMode="cover"
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {uploadingImage ? (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.light, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }}>
                    <ActivityIndicator size="small" color={C.blue} />
                    <Text style={{ color: C.text2, fontSize: 12 }}>Uploading...</Text>
                  </View>
                ) : imageUrl ? (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.greenBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(22,163,74,0.20)' }}>
                    <Ionicons name="checkmark-circle" size={14} color={C.green} />
                    <Text style={{ color: C.green, fontSize: 12, fontWeight: '600' }}>Uploaded</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.redBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(220,38,38,0.18)' }}
                  onPress={handleRemoveImage}
                >
                  <Ionicons name="trash-outline" size={14} color={C.red} />
                  <Text style={{ color: C.red, fontSize: 12, fontWeight: '600' }}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={{ borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 28, alignItems: 'center', gap: 10 }}
              onPress={handlePickImage}
            >
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="cloud-upload-outline" size={24} color={C.navy} />
              </View>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>Tap to pick a photo</Text>
              <Text style={{ color: C.text3, fontSize: 11 }}>JPG, PNG — max 10MB</Text>
            </TouchableOpacity>
          )}
        </SectionCard>

        {/* Preview */}
        {(keywords.length > 0 || reply.length > 0) && (
          <SectionCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.navyFade, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="eye" size={15} color={C.navy} />
              </View>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>Preview</Text>
            </View>
            {keywords.length > 0 && (
              <View style={{ backgroundColor: C.light, borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start', maxWidth: '75%', marginBottom: 10, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ color: C.text, fontSize: 13 }}>{keywords[0]}</Text>
              </View>
            )}
            {reply.length > 0 && (
              <View style={{ backgroundColor: C.navy, borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-end', maxWidth: '75%' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 19 }}>{reply}</Text>
              </View>
            )}
          </SectionCard>
        )}

      </ScrollView>
    </View>
  );
}
