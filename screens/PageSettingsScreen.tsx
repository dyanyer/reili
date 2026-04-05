import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert, Switch } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../navigation';
import { pagesApi } from '../lib/api';
import PageSwitcherPill from '../components/PageSwitcherPill';

type Props = NativeStackScreenProps<MoreStackParamList, 'PageSettings'>;

function formatHour(h: number) {
  if (h === 0) return '12:00 AM';
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${h - 12}:00 PM`;
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
        if (data.order_steps?.length) {
          setOrderSteps(data.order_steps);
        }
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
    <View className="flex-1 bg-[#F6F6F6]">
      <StatusBar style="dark" />

      {/* Header */}
      <View className="bg-white pt-14 pb-4 px-4 flex-row items-center border-b border-[#E4E6EB]">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={24} color="#1C1E21" />
        </TouchableOpacity>
        <Text className="flex-1 text-[#1C1E21] text-xl font-bold">Bot Settings</Text>
        <PageSwitcherPill
          currentPageId={pageId}
          currentPageName={pageName}
          onSwitch={(id, name) => navigation.replace('PageSettings', { pageId: id, pageName: name })}
        />
        <TouchableOpacity
          className="bg-navy rounded-xl px-4 py-2"
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#D6E4F0" />
          ) : (
            <Text className="text-white font-bold text-sm">Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#163172" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

          {/* Default Reply */}
          <View
            className="bg-white rounded-2xl p-4 mb-4"
            style={{ shadowColor: '#163172', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
          >
            <View className="flex-row items-center gap-2 mb-1">
              <View className="bg-cyan-light rounded-lg p-1.5">
                <Ionicons name="chatbubble-ellipses" size={16} color="#163172" />
              </View>
              <Text className="text-navy font-semibold text-base">Default Reply</Text>
            </View>
            <Text className="text-slate-400 text-xs mb-3 leading-4">
              Sent when no keyword trigger matches the customer's message.
            </Text>
            <TextInput
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-navy text-sm"
              value={defaultReply}
              onChangeText={setDefaultReply}
              placeholder="E.g. Hi! Thanks for messaging us 😊"
              placeholderTextColor="#94a3b8"
              multiline
              maxLength={500}
              textAlignVertical="top"
              style={{ minHeight: 88 }}
            />
            <Text className="text-slate-400 text-xs mt-1.5 text-right">{defaultReply.length}/500</Text>
          </View>

          {/* Welcome Message */}
          <View
            className="bg-white rounded-2xl p-4 mb-4"
            style={{ shadowColor: '#163172', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
          >
            <View className="flex-row items-center gap-2 mb-1">
              <View className="bg-cyan-light rounded-lg p-1.5">
                <Ionicons name="hand-left" size={16} color="#163172" />
              </View>
              <Text className="text-navy font-semibold text-base">Welcome Message</Text>
              <View className="bg-navy rounded-full px-2 py-0.5 ml-1">
                <Text className="text-cyan text-xs font-medium">New</Text>
              </View>
            </View>
            <Text className="text-slate-400 text-xs mb-3 leading-4">
              Sent automatically when a customer messages your page for the first time.
            </Text>
            <TextInput
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-navy text-sm"
              value={welcomeMessage}
              onChangeText={setWelcomeMessage}
              placeholder="E.g. Welcome! Salamat sa pag-message sa amin 😊"
              placeholderTextColor="#94a3b8"
              multiline
              maxLength={500}
              textAlignVertical="top"
              style={{ minHeight: 88 }}
            />
            <Text className="text-slate-400 text-xs mt-1.5 text-right">{welcomeMessage.length}/500</Text>
          </View>

          {/* Payment Info */}
          <View
            className="bg-white rounded-2xl p-4 mb-4"
            style={{ shadowColor: '#163172', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
          >
            <View className="flex-row items-center gap-2 mb-1">
              <View className="bg-cyan-light rounded-lg p-1.5">
                <Ionicons name="card" size={16} color="#163172" />
              </View>
              <Text className="text-navy font-semibold text-base">Payment Details</Text>
            </View>
            <Text className="text-slate-400 text-xs mb-3 leading-4">
              Sent to customers automatically at the end of every order. Include your GCash number, bank account, or any payment instructions.
            </Text>
            <TextInput
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-navy text-sm"
              value={paymentInfo}
              onChangeText={setPaymentInfo}
              placeholder={'E.g.\nGCash: 09XX-XXX-XXXX (Juan Dela Cruz)\nBDO: 1234-5678-90'}
              placeholderTextColor="#94a3b8"
              multiline
              maxLength={500}
              textAlignVertical="top"
              style={{ minHeight: 88 }}
            />
            <Text className="text-slate-400 text-xs mt-1.5 text-right">{paymentInfo.length}/500</Text>
          </View>

          {/* Order Confirmation Template */}
          <View
            className="bg-white rounded-2xl p-4 mb-4"
            style={{ shadowColor: '#163172', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
          >
            <View className="flex-row items-center gap-2 mb-1">
              <View className="bg-cyan-light rounded-lg p-1.5">
                <Ionicons name="receipt" size={16} color="#163172" />
              </View>
              <Text className="text-navy font-semibold text-base">Order Confirmation</Text>
            </View>
            <Text className="text-slate-400 text-xs mb-2 leading-4">
              Message sent to customers when their order is complete. Leave blank to use the default.
            </Text>
            <View className="bg-slate-50 rounded-xl p-3 mb-3">
              <Text className="text-slate-400 text-xs leading-5">
                {'Placeholders: {name}  {item}  {quantity}  {address}\n{order_number}  {payment_info}  {payment_block}'}
              </Text>
            </View>
            <TextInput
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-navy text-sm"
              value={orderConfirmationTemplate}
              onChangeText={setOrderConfirmationTemplate}
              placeholder={
                '✅ Order received, {name}!\n\n📦 Item: {item}\n🔢 Qty: {quantity}\n📍 Address: {address}\n\n🔖 Order #{order_number}{payment_block}\n\nSalamat sa iyong order! 🙏'
              }
              placeholderTextColor="#94a3b8"
              multiline
              maxLength={1000}
              textAlignVertical="top"
              style={{ minHeight: 140 }}
            />
            <Text className="text-slate-400 text-xs mt-1.5 text-right">{orderConfirmationTemplate.length}/1000</Text>
          </View>

          {/* Order Flow Steps */}
          <View
            className="bg-white rounded-2xl p-4 mb-4"
            style={{ shadowColor: '#163172', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
          >
            <View className="flex-row items-center gap-2 mb-1">
              <View className="bg-cyan-light rounded-lg p-1.5">
                <Ionicons name="list" size={16} color="#163172" />
              </View>
              <Text className="text-navy font-semibold text-base">Order Flow Steps</Text>
            </View>
            <Text className="text-slate-400 text-xs mb-3 leading-4">
              Customize what the bot asks during the order process. Leave blank to use the default question.
            </Text>

            {[
              { key: 'item',     defaultPrompt: 'Anong item ang gusto mo?' },
              { key: 'quantity', defaultPrompt: 'Ilang pieces ang gusto mo?' },
              { key: 'address',  defaultPrompt: 'Saan namin ipapadala? (complete address)' },
            ].map((step, i) => {
              const current = orderSteps.find((s) => s.key === step.key) ?? { key: step.key, prompt: '' };
              return (
                <View key={step.key} className="mb-3">
                  <View className="flex-row items-center gap-2 mb-1">
                    <View className="bg-navy rounded-full w-5 h-5 items-center justify-center">
                      <Text className="text-white text-xs font-bold">{i + 1}</Text>
                    </View>
                    <Text className="text-slate-600 text-xs font-semibold capitalize">{step.key}</Text>
                  </View>
                  <TextInput
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-navy text-sm"
                    value={current.prompt}
                    onChangeText={(text) =>
                      setOrderSteps((prev) =>
                        prev.map((s) => (s.key === step.key ? { ...s, prompt: text } : s))
                      )
                    }
                    placeholder={step.defaultPrompt}
                    placeholderTextColor="#94a3b8"
                    maxLength={200}
                  />
                </View>
              );
            })}
          </View>

          {/* Away Mode */}
          <View
            className="bg-white rounded-2xl p-4 mb-4"
            style={{ shadowColor: '#163172', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
          >
            <View className="flex-row items-center gap-2 mb-3">
              <View className="bg-cyan-light rounded-lg p-1.5">
                <Ionicons name="moon" size={16} color="#163172" />
              </View>
              <Text className="text-navy font-semibold text-base flex-1">Away Mode</Text>
              <Switch
                value={awayEnabled}
                onValueChange={setAwayEnabled}
                trackColor={{ false: '#e2e8f0', true: '#163172' }}
                thumbColor={awayEnabled ? '#D6E4F0' : '#94a3b8'}
              />
            </View>

            <Text className="text-slate-400 text-xs mb-3 leading-4">
              When on, this message is sent instead of bot replies. Turn it on when you're offline or sleeping.
            </Text>

            <TextInput
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-navy text-sm"
              value={awayMessage}
              onChangeText={setAwayMessage}
              placeholder="E.g. Hi! We're currently away but will reply soon 😊"
              placeholderTextColor="#94a3b8"
              multiline
              maxLength={500}
              textAlignVertical="top"
              style={{ minHeight: 72 }}
            />
            <Text className="text-slate-400 text-xs mt-1.5 text-right mb-4">{awayMessage.length}/500</Text>

            {/* Auto-schedule */}
            <View className="border-t border-slate-100 pt-3">
              <View className="flex-row items-center gap-2 mb-2">
                <Ionicons name="time-outline" size={14} color="#64748b" />
                <Text className="text-slate-600 text-sm font-medium flex-1">Auto-schedule</Text>
                <Switch
                  value={scheduleEnabled}
                  onValueChange={setScheduleEnabled}
                  trackColor={{ false: '#e2e8f0', true: '#163172' }}
                  thumbColor={scheduleEnabled ? '#D6E4F0' : '#94a3b8'}
                />
              </View>
              {scheduleEnabled && (
                <View className="mt-2 gap-3">
                  <Text className="text-slate-400 text-xs">
                    Away mode activates automatically during these hours (Philippine Time).
                  </Text>
                  {awaySchedules.map((sched, idx) => (
                    <View key={idx} className="bg-slate-50 rounded-xl p-3">
                      <View className="flex-row items-center mb-2">
                        <Text className="text-slate-500 text-xs font-semibold flex-1">Schedule {idx + 1}</Text>
                        {awaySchedules.length > 1 && (
                          <TouchableOpacity onPress={() => setAwaySchedules((prev) => prev.filter((_, i) => i !== idx))}>
                            <Ionicons name="close-circle" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View className="flex-row gap-3">
                        <View className="flex-1 items-center bg-white rounded-xl py-3">
                          <Text className="text-slate-400 text-xs mb-1">From</Text>
                          <View className="flex-row items-center gap-3">
                            <TouchableOpacity onPress={() => setAwaySchedules((prev) => prev.map((s, i) => i === idx ? { ...s, start: (s.start + 23) % 24 } : s))}>
                              <Ionicons name="chevron-back" size={18} color="#163172" />
                            </TouchableOpacity>
                            <Text className="text-navy font-bold text-sm w-16 text-center">{formatHour(sched.start)}</Text>
                            <TouchableOpacity onPress={() => setAwaySchedules((prev) => prev.map((s, i) => i === idx ? { ...s, start: (s.start + 1) % 24 } : s))}>
                              <Ionicons name="chevron-forward" size={18} color="#163172" />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View className="flex-1 items-center bg-white rounded-xl py-3">
                          <Text className="text-slate-400 text-xs mb-1">To</Text>
                          <View className="flex-row items-center gap-3">
                            <TouchableOpacity onPress={() => setAwaySchedules((prev) => prev.map((s, i) => i === idx ? { ...s, end: (s.end + 23) % 24 } : s))}>
                              <Ionicons name="chevron-back" size={18} color="#163172" />
                            </TouchableOpacity>
                            <Text className="text-navy font-bold text-sm w-16 text-center">{formatHour(sched.end)}</Text>
                            <TouchableOpacity onPress={() => setAwaySchedules((prev) => prev.map((s, i) => i === idx ? { ...s, end: (s.end + 1) % 24 } : s))}>
                              <Ionicons name="chevron-forward" size={18} color="#163172" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity
                    className="flex-row items-center justify-center gap-1 py-2.5 border border-dashed border-slate-300 rounded-xl"
                    onPress={() => setAwaySchedules((prev) => [...prev, { start: 22, end: 7 }])}
                  >
                    <Ionicons name="add" size={16} color="#64748b" />
                    <Text className="text-slate-500 text-xs font-medium">Add Another Schedule</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Info banner */}
          <View className="bg-cyan-light rounded-2xl p-4 flex-row gap-3 mb-6">
            <Ionicons name="information-circle" size={20} color="#163172" />
            <Text className="text-navy text-xs flex-1 leading-5">
              Keyword triggers take priority. The default reply is only used when no trigger matches.
            </Text>
          </View>

          {/* Save button */}
          <TouchableOpacity
            className="bg-navy rounded-2xl py-4 items-center flex-row justify-center gap-2"
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#D6E4F0" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#D6E4F0" />
                <Text className="text-white font-bold text-base">Save Settings</Text>
              </>
            )}
          </TouchableOpacity>

        </ScrollView>
      )}
    </View>
  );
}
