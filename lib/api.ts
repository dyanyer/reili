import { supabase } from "./supabase";

const BASE_URL = "https://botmate-api-production.up.railway.app";

async function request(path: string, options?: RequestInit) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
      // Always send x-user-id so @Public() backend endpoints (e.g. save-page)
      // can associate the resource with the correct Supabase user.
      ...(session?.user?.id ? { "x-user-id": session.user.id } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}

// Pages
export const pagesApi = {
  getAll: () => request("/pages"),

  getStats: (pageId: string) => request(`/pages/${pageId}/stats`),

  getAnalytics: (pageId: string, days?: number) =>
    request(`/pages/${pageId}/analytics${days ? `?days=${days}` : ""}`),

  getSettings: (pageId: string) => request(`/pages/${pageId}/settings`),

  toggleActive: (pageId: string) =>
    request(`/pages/${pageId}/toggle`, { method: "PATCH" }),

  disconnect: (pageId: string) =>
    request(`/pages/${pageId}`, { method: "DELETE" }),

  savePushToken: (pageId: string, push_token: string) =>
    request(`/pages/${pageId}/push-token`, {
      method: "PATCH",
      body: JSON.stringify({ push_token }),
    }),

  updateSettings: (
    pageId: string,
    data: {
      default_reply?: string;
      welcome_message?: string;
      payment_info?: string;
      away_enabled?: boolean;
      away_message?: string;
      away_schedule?:
        | { start: number; end: number }
        | { start: number; end: number }[]
        | null;
      order_confirmation_template?: string;
      order_steps?: { key: string; prompt: string }[] | null;
    },
  ) =>
    request(`/pages/${pageId}/settings`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// Triggers
export const triggersApi = {
  getAll: (pageId: string) => request(`/pages/${pageId}/triggers`),

  create: (
    pageId: string,
    data: {
      keywords: string[];
      response_text: string;
      image_url?: string;
      quick_replies?: { title: string; payload: string }[];
      match_mode?: string;
    },
  ) =>
    request(`/pages/${pageId}/triggers`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    pageId: string,
    triggerId: string,
    data: {
      keywords?: string[];
      response_text?: string;
      image_url?: string;
      quick_replies?: { title: string; payload: string }[];
      match_mode?: string;
    },
  ) =>
    request(`/pages/${pageId}/triggers/${triggerId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  toggle: (pageId: string, triggerId: string) =>
    request(`/pages/${pageId}/triggers/${triggerId}/toggle`, {
      method: "PATCH",
    }),

  delete: (pageId: string, triggerId: string) =>
    request(`/pages/${pageId}/triggers/${triggerId}`, {
      method: "DELETE",
    }),

  reorder: (pageId: string, orderedIds: string[]) =>
    request(`/pages/${pageId}/triggers/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ orderedIds }),
    }),

  getTop: (pageId: string) => request(`/pages/${pageId}/triggers/top`),
};

// Orders
export const ordersApi = {
  getAll: (pageId: string) => request(`/pages/${pageId}/orders`),

  updateStatus: (orderId: string, status: string) =>
    request(`/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  updatePrice: (orderId: string, total_price: number | null) =>
    request(`/orders/${orderId}/price`, {
      method: "PATCH",
      body: JSON.stringify({ total_price }),
    }),
};

// Broadcasts
export const broadcastsApi = {
  getAll: (pageId: string) => request(`/pages/${pageId}/broadcasts`),

  send: (
    pageId: string,
    message_text: string,
    scheduled_at?: string,
    segment?: string,
    image_url?: string,
  ) =>
    request(`/pages/${pageId}/broadcasts`, {
      method: "POST",
      body: JSON.stringify({ message_text, scheduled_at, segment, image_url }),
    }),

  getRecipientCounts: (pageId: string) =>
    request(`/pages/${pageId}/broadcasts/recipient-count`),
};

// Connect (Facebook Page connection from mobile app)
export const connectApi = {
  listPages: (accessToken: string) =>
    request("/connect/list-pages", {
      method: "POST",
      body: JSON.stringify({ accessToken }),
    }),

  savePage: (page_id: string, page_name: string, page_token: string) =>
    request("/connect/save-page", {
      method: "POST",
      body: JSON.stringify({ page_id, page_name, page_token }),
    }),
};

// Conversations
export const conversationsApi = {
  getAll: (pageId: string, includeArchived = false) =>
    request(
      `/pages/${pageId}/conversations${includeArchived ? "?include_archived=true" : ""}`,
    ),

  getMessages: (conversationId: string) =>
    request(`/conversations/${conversationId}/messages`),

  reply: (conversationId: string, message_text: string, image_url?: string) =>
    request(`/conversations/${conversationId}/reply`, {
      method: "POST",
      body: JSON.stringify({ message_text, image_url }),
    }),

  markAsRead: (conversationId: string) =>
    request(`/conversations/${conversationId}/read`, { method: "PATCH" }),

  getNote: (conversationId: string) =>
    request(`/conversations/${conversationId}/note`),

  updateNote: (conversationId: string, notes: string) =>
    request(`/conversations/${conversationId}/note`, {
      method: "PATCH",
      body: JSON.stringify({ notes }),
    }),

  togglePin: (conversationId: string) =>
    request(`/conversations/${conversationId}/pin`, { method: "PATCH" }),

  toggleArchive: (conversationId: string) =>
    request(`/conversations/${conversationId}/archive`, { method: "PATCH" }),
};
