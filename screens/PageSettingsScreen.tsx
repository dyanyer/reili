import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert, Switch } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../navigation';
import { pagesApi } from '../lib/api';
import PageSwitcherPill from '../components/PageSwitcherPill';

type Props = NativeStackScreenProps<MoreStackParamList, 'PageSettings'>;

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

function formatHour(h: number) {
  if (h === 0) return '12:00 AM';
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${h - 12}:00 PM`;
}

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
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon as any} size={16} color={iconColor} />
      </View>
      <Text style={{ color: C.navy, fontSize: 15, fontWeight: '700', flex: 1 }}>{title}</Text>
      {badge && (
        <View style={{ backgroundColor: C.navyFade, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.blue, fontSize: 10, fontWeight: '700' }}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

function BrandInput({ value, onChangeText, placeholder, multiline, maxLength, minHeight, style }: any) {
  return (
    <TextInput
      style={[{
        backgroundColor: C.white,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: C.navy,
        fontSize: 13,
        minHeight: minHeight ?? undefined,
        textAlignVertical: multiline ? 'top' : undefined,
      }, style]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={C.text3}
      multiline={multiline}
      maxLength={maxLength}
      textAlignVertical={multiline ? 'top' : undefined}
    />
  );
}

export default function PageSettingsScreen({ route, navigation }: Props) {
  const { pageId, pageName } = route.params;
  const [defaultReply, setDefaultReply] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [paymentInfo, setPaymentInfo] = useState('');
  const [orderConfirmationTemplate, setOrderConfirmationTemplate] = useState('');
  const [orderSteps, setOrderSteps] = useState<{ key: string; prompt: string }[]>([
    { key: 'item', prompt: '' },
    { key: 'quantity', prompt: '' },
    { key: 'address', prompt: '' },
  ]);
  const [awayEnabled, setAwayEnabled] = useState(false);
  const [awayMessage, setAwayMessage] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [awaySchedules, setAwaySchedules] = useState<{ start: number; end: number }[]>([{ start: 22, end: 7 }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await pagesApi.getSettings(pageId);
        setDefaultReply(data.default_reply ?? '');
        setWelcomeMessage(data.welcome_message ?? '');
        setPaymentInfo(data.payment_info ?? '');
        setOrderConfirmationTemplate(data.order_confirmation_template ?? '');
        if (data.order_steps?.length) setOrderSteps(data.order_steps);
        setAwayEnabled(data.away_enabled ?? false);
        setAwayMessage(data.away_message ?? '');
        if (data.away_schedule) {
          setScheduleEnabled(true);
          const raw = data.away_schedule;
          setAwaySchedules(Array.isArray(raw) ? raw : [raw]);
        }
      } catch {
        Alert.alert('Error', 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [pageId]);

  async function handleSave() {
    if (!defaultReply.trim()) {
      Alert.alert('Required', 'Default reply cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await pagesApi.updateSettings(pageId, {
        default_reply: defaultReply.trim(),
        welcome_message: welcomeMessage.trim(),
        payment_info: paymentInfo.trim(),
        order_confirmation_template: orderConfirmationTemplate.trim(),
        order_steps: orderSteps.map((s) => ({ key: s.key, prompt: s.prompt.trim() })),
        away_enabled: awayEnabled,
        away_message: awayMessage.trim(),
        away_schedule: scheduleEnabled ? awaySchedules : null,
      });
      Alert.alert('Saved', 'Settings updated successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={{ backgroundColor: C.white, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12, padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={C.navy} />
        </TouchableOpacity>
        <Text style={{ flex: 1, color: C.navy, fontSize: 20, fontWeight: '800' }}>Bot Settings</Text>
        <PageSwitcherPill
          currentPageId={pageId}
          currentPageName={pageName}
          onSwitch={(id, name) => navigation.replace('PageSettings', { pageId: id, pageName: name })}
        />
        <TouchableOpacity
          style={{ marginLeft: 10, backgroundColor: saving ? C.light : C.navy, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 }}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={C.navy} />
          ) : (
            <Text style={{ color: C.white, fontWeight: '700', fontSize: 13 }}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.navy} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

          {/* Default Reply */}
          <SectionCard>
            <CardHeader icon="chatbubble-ellipses" iconColor={C.blue} iconBg={C.navyFade} title="Default Reply" />
            <Text style={{ color: C.text3, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
              Sent when no keyword trigger matches the customer's message.
            </Text>
            <BrandInput
              value={defaultReply}
              onChangeText={setDefaultReply}
              placeholder="E.g. Hi! Thanks for messaging us 😊"
              multiline
              maxLength={500}
              minHeight={88}
            />
            <Text style={{ color: C.text3, fontSize: 11, marginTop: 6, textAlign: 'right' }}>{defaultReply.length}/500</Text>
          </SectionCard>

          {/* Welcome Message */}
          <SectionCard>
            <CardHeader icon="hand-left" iconColor={C.green} iconBg={C.greenBg} title="Welcome Message" badge="New" />
            <Text style={{ color: C.text3, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
              Sent automatically when a customer messages your page for the first time.
            </Text>
            <BrandInput
              value={welcomeMessage}
              onChangeText={setWelcomeMessage}
              placeholder="E.g. Welcome! Salamat sa pag-message sa amin 😊"
              multiline
              maxLength={500}
              minHeight={88}
            />
            <Text style={{ color: C.text3, fontSize: 11, marginTop: 6, textAlign: 'right' }}>{welcomeMessage.length}/500</Text>
          </SectionCard>

          {/* Payment Info */}
          <SectionCard>
            <CardHeader icon="card" iconColor="#D97706" iconBg="rgba(217,119,6,0.12)" title="Payment Details" />
            <Text style={{ color: C.text3, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
              Sent to customers automatically at the end of every order. Include your GCash number, bank account, or any payment instructions.
            </Text>
            <BrandInput
              value={paymentInfo}
              onChangeText={setPaymentInfo}
              placeholder={'E.g.\nGCash: 09XX-XXX-XXXX (Juan Dela Cruz)\nBDO: 1234-5678-90'}
              multiline
              maxLength={500}
              minHeight={88}
            />
            <Text style={{ color: C.text3, fontSize: 11, marginTop: 6, textAlign: 'right' }}>{paymentInfo.length}/500</Text>
          </SectionCard>

          {/* Order Confirmation Template */}
          <SectionCard>
            <CardHeader icon="receipt" iconColor="#7C3AED" iconBg="rgba(124,58,237,0.10)" title="Order Confirmation" />
            <Text style={{ color: C.text3, fontSize: 12, marginBottom: 10, lineHeight: 18 }}>
              Message sent to customers when their order is complete. Leave blank to use the default.
            </Text>
            <View style={{ backgroundColor: C.bg, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.text3, fontSize: 11, lineHeight: 20 }}>
                {'Placeholders: {name}  {item}  {quantity}  {address}\n{order_number}  {payment_info}  {payment_block}'}
              </Text>
            </View>
            <BrandInput
              value={orderConfirmationTemplate}
              onChangeText={setOrderConfirmationTemplate}
              placeholder={'✅ Order received, {name}!\n\n📦 Item: {item}\n🔢 Qty: {quantity}\n📍 Address: {address}\n\n🔖 Order #{order_number}{payment_block}\n\nSalamat sa iyong order! 🙏'}
              multiline
              maxLength={1000}
              minHeight={140}
            />
            <Text style={{ color: C.text3, fontSize: 11, marginTop: 6, textAlign: 'right' }}>{orderConfirmationTemplate.length}/1000</Text>
          </SectionCard>

          {/* Order Flow Steps */}
          <SectionCard>
            <CardHeader icon="list" iconColor={C.blue} iconBg={C.navyFade} title="Order Flow Steps" />
            <Text style={{ color: C.text3, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
              Customize what the bot asks during the order process. Leave blank to use the default question.
            </Text>
            {[
              { key: 'item',     defaultPrompt: 'Anong item ang gusto mo?' },
              { key: 'quantity', defaultPrompt: 'Ilang pieces ang gusto mo?' },
              { key: 'address',  defaultPrompt: 'Saan namin ipapadala? (complete address)' },
            ].map((step, i) => {
              const current = orderSteps.find((s) => s.key === step.key) ?? { key: step.key, prompt: '' };
              return (
                <View key={step.key} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: C.white, fontSize: 11, fontWeight: '800' }}>{i + 1}</Text>
                    </View>
                    <Text style={{ color: C.text2, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>{step.key}</Text>
                  </View>
                  <BrandInput
                    value={current.prompt}
                    onChangeText={(text: string) =>
                      setOrderSteps((prev) =>
                        prev.map((s) => (s.key === step.key ? { ...s, prompt: text } : s))
                      )
                    }
                    placeholder={step.defaultPrompt}
                    maxLength={200}
                  />
                </View>
              );
            })}
          </SectionCard>

          {/* Away Mode */}
          <SectionCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.navyMid, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Ionicons name="moon" size={16} color={C.navy} />
              </View>
              <Text style={{ color: C.navy, fontSize: 15, fontWeight: '700', flex: 1 }}>Away Mode</Text>
              <Switch
                value={awayEnabled}
                onValueChange={setAwayEnabled}
                trackColor={{ false: C.light, true: C.blue }}
                thumbColor={C.white}
              />
            </View>
            <Text style={{ color: C.text3, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
              When on, this message is sent instead of bot replies. Turn it on when you're offline or sleeping.
            </Text>
            <BrandInput
              value={awayMessage}
              onChangeText={setAwayMessage}
              placeholder="E.g. Hi! We're currently away but will reply soon 😊"
              multiline
              maxLength={500}
              minHeight={72}
            />
            <Text style={{ color: C.text3, fontSize: 11, marginTop: 6, textAlign: 'right', marginBottom: 16 }}>{awayMessage.length}/500</Text>

            {/* Auto-schedule */}
            <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Ionicons name="time-outline" size={15} color={C.text3} style={{ marginRight: 8 }} />
                <Text style={{ color: C.text2, fontSize: 13, fontWeight: '600', flex: 1 }}>Auto-schedule</Text>
                <Switch
                  value={scheduleEnabled}
                  onValueChange={setScheduleEnabled}
                  trackColor={{ false: C.light, true: C.blue }}
                  thumbColor={C.white}
                />
              </View>

              {scheduleEnabled && (
                <View style={{ gap: 12 }}>
                  <Text style={{ color: C.text3, fontSize: 11, lineHeight: 16 }}>
                    Away mode activates automatically during these hours (Philippine Time).
                  </Text>
                  {awaySchedules.map((sched, idx) => (
                    <View key={idx} style={{ backgroundColor: C.bg, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        <Text style={{ color: C.text2, fontSize: 11, fontWeight: '700', flex: 1 }}>Schedule {idx + 1}</Text>
                        {awaySchedules.length > 1 && (
                          <TouchableOpacity onPress={() => setAwaySchedules((prev) => prev.filter((_, i) => i !== idx))}>
                            <Ionicons name="close-circle" size={18} color={C.red} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        {['From', 'To'].map((label, fi) => {
                          const isFrom = fi === 0;
                          const val = isFrom ? sched.start : sched.end;
                          const onDec = () => setAwaySchedules((prev) => prev.map((s, i) => i === idx ? (isFrom ? { ...s, start: (s.start + 23) % 24 } : { ...s, end: (s.end + 23) % 24 }) : s));
                          const onInc = () => setAwaySchedules((prev) => prev.map((s, i) => i === idx ? (isFrom ? { ...s, start: (s.start + 1) % 24 } : { ...s, end: (s.end + 1) % 24 }) : s));
                          return (
                            <View key={label} style={{ flex: 1, alignItems: 'center', backgroundColor: C.light, borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: C.border }}>
                              <Text style={{ color: C.text3, fontSize: 10, marginBottom: 6 }}>{label}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <TouchableOpacity onPress={onDec}>
                                  <Ionicons name="chevron-back" size={18} color={C.navy} />
                                </TouchableOpacity>
                                <Text style={{ color: C.navy, fontWeight: '700', fontSize: 12, width: 60, textAlign: 'center' }}>{formatHour(val)}</Text>
                                <TouchableOpacity onPress={onInc}>
                                  <Ionicons name="chevron-forward" size={18} color={C.navy} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', borderRadius: 14 }}
                    onPress={() => setAwaySchedules((prev) => [...prev, { start: 22, end: 7 }])}
                  >
                    <Ionicons name="add" size={16} color={C.text3} />
                    <Text style={{ color: C.text3, fontSize: 12, fontWeight: '600' }}>Add Another Schedule</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </SectionCard>

          {/* Info banner */}
          <View style={{ backgroundColor: C.light, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 12, marginBottom: 20, borderWidth: 1, borderColor: C.border }}>
            <Ionicons name="information-circle" size={18} color={C.navy} />
            <Text style={{ color: C.navy, fontSize: 12, flex: 1, lineHeight: 18 }}>
              Keyword triggers take priority. The default reply is only used when no trigger matches.
            </Text>
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={{ backgroundColor: saving ? C.light : C.navy, borderRadius: 18, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: saving ? 1 : 0, borderColor: C.border }}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={C.navy} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color={C.white} />
                <Text style={{ color: C.white, fontWeight: '800', fontSize: 15 }}>Save Settings</Text>
              </>
            )}
          </TouchableOpacity>

        </ScrollView>
      )}
    </View>
  );
}
