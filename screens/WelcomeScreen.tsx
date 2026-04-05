import { View, Text, TouchableOpacity, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="light" />

      {/* Hero */}
      <View className="bg-navy h-72 rounded-b-[40px] items-center justify-end pb-10">
        <Image
          source={require('../assets/reili.png')}
          style={{ width: 80, height: 80, marginBottom: 14 }}
          resizeMode="contain"
        />
        <Text className="text-white text-4xl font-bold tracking-tight">Reili</Text>
        <Text className="text-cyan text-sm mt-1.5 font-medium">Replies that work for you</Text>
      </View>

      {/* Content */}
      <View className="flex-1 px-6 pt-9">
        <Text className="text-navy text-2xl font-bold text-center leading-8">
          Automate your Messenger.{'\n'}Sell while you sleep.
        </Text>
        <Text className="text-slate-500 text-sm text-center mt-3 leading-6">
          Stop answering "how much?" manually.{'\n'}Let Reili handle it 24/7 — no coding required.
        </Text>

        <View className="mt-8 gap-3.5">
          <FeatureRow icon="flash" text="Auto-reply to common questions instantly" />
          <FeatureRow icon="people" text="Manage all your Pages in one place" />
          <FeatureRow icon="trending-up" text="Track conversations and bot performance" />
        </View>
      </View>

      {/* Actions */}
      <View className="px-6 pb-10 gap-3">
        <TouchableOpacity
          className="bg-navy rounded-2xl py-4 flex-row items-center justify-center gap-2"
          onPress={() => navigation.navigate('Main')}
        >
          <Ionicons name="logo-facebook" size={20} color="#00C5FF" />
          <Text className="text-white text-base font-semibold">Continue with Facebook</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}

function FeatureRow({ icon, text }: { icon: any; text: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="bg-cyan-light rounded-xl p-2.5">
        <Ionicons name={icon} size={18} color="#0E1C40" />
      </View>
      <Text className="text-slate-700 text-sm flex-1 leading-5">{text}</Text>
    </View>
  );
}
