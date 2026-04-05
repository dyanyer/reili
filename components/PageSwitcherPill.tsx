import { View, Text, TouchableOpacity, Modal, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pagesApi } from '../lib/api';

type Page = { id: string; page_name: string; is_active: boolean };

type Props = {
  currentPageId: string;
  currentPageName: string;
  onSwitch: (id: string, name: string) => void;
  /** icon color override — defaults to #65676B */
  iconColor?: string;
};

export default function PageSwitcherPill({
  currentPageId,
  currentPageName,
  onSwitch,
  iconColor = '#65676B',
}: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setLoading(true);
    setOpen(true);
    try {
      const data = await pagesApi.getAll();
      setPages(data);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(page: Page) {
    setOpen(false);
    if (page.id !== currentPageId) {
      onSwitch(page.id, page.page_name);
    }
  }

  return (
    <>
      {/* ── Trigger — icon only, matches refresh/download style ── */}
      <TouchableOpacity onPress={handleOpen} className="p-2" activeOpacity={0.6}>
        <Ionicons name="swap-horizontal-outline" size={20} color={iconColor} />
      </TouchableOpacity>

      {/* ── Bottom sheet ── */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.42)' }}
          onPress={() => setOpen(false)}
        />

        <View style={{
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingBottom: Math.max(insets.bottom, 24),
          overflow: 'hidden',
        }}>
          {/* Sheet header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 22,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#F0F2F5',
          }}>
            <View>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#1C1E21' }}>
                Your Pages
              </Text>
              <Text style={{ fontSize: 12, color: '#65676B', marginTop: 2 }}>
                Tap a page to switch
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setOpen(false)}
              activeOpacity={0.7}
              style={{
                width: 32, height: 32,
                borderRadius: 16,
                backgroundColor: '#F0F2F5',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={17} color="#65676B" />
            </TouchableOpacity>
          </View>

          {/* Page list */}
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            {loading ? (
              <ActivityIndicator color="#0E1C40" style={{ marginVertical: 36 }} />
            ) : pages.length === 0 ? (
              <Text style={{ color: '#65676B', textAlign: 'center', paddingVertical: 32 }}>
                No pages found
              </Text>
            ) : (
              pages.map((page) => {
                const isSelected = page.id === currentPageId;
                return (
                  <TouchableOpacity
                    key={page.id}
                    onPress={() => handleSelect(page)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 14,
                      marginBottom: 10,
                      borderRadius: 16,
                      backgroundColor: isSelected ? '#EEF3FF' : '#F8F9FA',
                      borderWidth: 1.5,
                      borderColor: isSelected ? '#0E1C40' : 'transparent',
                      gap: 12,
                    }}
                  >
                    <View style={{
                      width: 46, height: 46,
                      borderRadius: 14,
                      backgroundColor: isSelected ? '#0E1C40' : '#E8F0FF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons
                        name="logo-facebook"
                        size={22}
                        color={isSelected ? '#00C5FF' : '#0E1C40'}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 15,
                        fontWeight: isSelected ? '700' : '600',
                        color: '#1C1E21',
                      }}>
                        {page.page_name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                        <View style={{
                          width: 6, height: 6, borderRadius: 3,
                          backgroundColor: page.is_active ? '#10B981' : '#CBD5E1',
                        }} />
                        <Text style={{ fontSize: 11, color: '#65676B' }}>
                          {page.is_active ? 'Bot Active' : 'Bot Paused'}
                        </Text>
                      </View>
                    </View>

                    {isSelected ? (
                      <View style={{
                        width: 28, height: 28,
                        borderRadius: 14,
                        backgroundColor: '#0E1C40',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Ionicons name="checkmark" size={15} color="#00C5FF" />
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color="#C4C4C4" />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
