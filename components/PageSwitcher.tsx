import { View, Text, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { pagesApi } from '../lib/api';

type Page = { id: string; page_name: string };

type Props = {
  currentPageId: string;
  currentPageName: string;
  onSwitch: (pageId: string, pageName: string) => void;
};

export default function PageSwitcher({ currentPageId, currentPageName, onSwitch }: Props) {
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setOpen(true);
    setLoading(true);
    try {
      const data = await pagesApi.getAll();
      setPages(data);
    } catch {
      setPages([]);
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
      <TouchableOpacity
        className="flex-row items-center gap-1"
        onPress={handleOpen}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text className="text-slate-400 text-xs">{currentPageName}</Text>
        <Ionicons name="chevron-down" size={10} color="#94a3b8" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          className="flex-1 bg-black/40"
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View className="mt-32 mx-5">
            <View
              className="bg-white rounded-2xl overflow-hidden"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 }}
            >
              {/* Header */}
              <View className="bg-navy px-4 py-3 flex-row items-center justify-between">
                <Text className="text-white font-semibold text-sm">Switch Page</Text>
                <TouchableOpacity onPress={() => setOpen(false)}>
                  <Ionicons name="close" size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {/* Page list */}
              {loading ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="small" color="#0E1C40" />
                </View>
              ) : pages.length === 0 ? (
                <View className="py-8 items-center">
                  <Text className="text-slate-400 text-sm">No pages found</Text>
                </View>
              ) : (
                pages.map((page, index) => {
                  const isActive = page.id === currentPageId;
                  return (
                    <TouchableOpacity
                      key={page.id}
                      className={`flex-row items-center px-4 py-4 ${index < pages.length - 1 ? 'border-b border-slate-100' : ''} ${isActive ? 'bg-cyan-light' : ''}`}
                      onPress={() => handleSelect(page)}
                    >
                      <View className={`rounded-xl p-2 mr-3 ${isActive ? 'bg-cyan' : 'bg-slate-100'}`}>
                        <Ionicons name="logo-facebook" size={16} color={isActive ? '#0E1C40' : '#64748b'} />
                      </View>
                      <Text className={`flex-1 text-sm font-medium ${isActive ? 'text-navy' : 'text-slate-700'}`}>
                        {page.page_name}
                      </Text>
                      {isActive && (
                        <Ionicons name="checkmark-circle" size={18} color="#0E1C40" />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
