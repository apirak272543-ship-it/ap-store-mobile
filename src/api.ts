import * as SecureStore from "expo-secure-store";

const URL = "https://abtsctwfkgzciseppach.supabase.co";
const KEY = "sb_publishable_TyJWnKkbS8vKcQKKAzoqSg_BOguwKRv";
const SESSION_KEY = "ap_store_session";

export type Session = { access_token: string; user: { id: string; email?: string } };
export type Store = { id: string; owner_id: string; name: string; emoji: string; description: string; active: boolean; location?: unknown };
export type MenuItem = { id: string; store_id: string; name: string; emoji: string; description: string; price: number; stock: number; available: boolean };
export type Order = { id: string; customer_name: string; store_name: string; store_id: string; status: string; total: number; payable: number; delivery_address: string; note: string; ordered_at: string; rider_name?: string | null };
const CLOSED_ORDER_STATUSES = ["สำเร็จแล้ว", "ยกเลิก"];

export async function loadSession() { const raw = await SecureStore.getItemAsync(SESSION_KEY); return raw ? JSON.parse(raw) as Session : null; }
export async function clearSession() { await SecureStore.deleteItemAsync(SESSION_KEY); }
async function request<T>(path: string, init: RequestInit = {}, session?: Session | null): Promise<T> { const response = await fetch(`${URL}${path}`, { ...init, headers: { apikey: KEY, "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}), ...(init.headers || {}) } }); const text = await response.text(); const body = text ? JSON.parse(text) : null; if (!response.ok) throw new Error(body?.message || body?.error_description || `ไม่สามารถเชื่อมต่อระบบได้ (${response.status})`); return body as T; }
export async function signIn(identifier: string, password: string) { const result = await request<{ session: Session }>("/functions/v1/role-access", { method: "POST", body: JSON.stringify({ action: "login", role: "store_owner", identifier, password }) }); await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(result.session)); return result.session; }
export const rest = <T>(path: string, session: Session, init?: RequestInit) => request<T>(`/rest/v1/${path}`, init, session);
export async function ensureStore(session: Session) { const roles = await rest<{ role: string }[]>(`user_roles?select=role&user_id=eq.${session.user.id}`, session); if (!roles.some((r) => r.role === "store_owner" || r.role === "admin")) throw new Error("บัญชีนี้ไม่มีสิทธิ์ใช้งาน Store Application"); const stores = await rest<Store[]>(`stores?select=*&owner_id=eq.${session.user.id}&limit=1`, session); if (!stores[0]) throw new Error("บัญชีนี้ยังไม่ได้เชื่อมกับร้านค้า โปรดติดต่อแอดมิน"); return stores[0]; }
export async function getWorkspace(session: Session, store: Store) { const [orders, menu] = await Promise.all([rest<Order[]>(`delivery_orders?select=*&store_id=eq.${encodeURIComponent(store.id)}&order=ordered_at.desc&limit=100`, session), rest<MenuItem[]>(`menu_items?select=*&store_id=eq.${encodeURIComponent(store.id)}&order=name.asc`, session)]); return { orders, menu }; }
/** จำนวนออร์เดอร์ที่ Store Console ของร้านนี้เห็นเองและยังไม่ปิดงาน */
export async function countOpenStoreOrders(session: Session) {
  const stores = await rest<Pick<Store, "id">[]>(`stores?select=id&owner_id=eq.${encodeURIComponent(session.user.id)}&limit=1`, session);
  const store = stores[0];
  if (!store) return null;
  const orders = await rest<Pick<Order, "id" | "status">[]>(`delivery_orders?select=id,status&store_id=eq.${encodeURIComponent(store.id)}&order=ordered_at.desc&limit=100`, session);
  return orders.filter((order) => !CLOSED_ORDER_STATUSES.includes(order.status)).length;
}
export async function setOrderStatus(session: Session, order: Order, status: "กำลังเตรียมสินค้า" | "ไรเดอร์กำลังไปรับ") { await rest(`delivery_orders?id=eq.${encodeURIComponent(order.id)}&store_id=eq.${encodeURIComponent(order.store_id)}`, session, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status }) }); await rest("order_status_events", session, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ order_id: order.id, status, actor_id: session.user.id, actor_label: "ร้านค้า" }) }); }
export async function updateStore(session: Session, store: Store, payload: Partial<Store>) { await rest(`stores?id=eq.${encodeURIComponent(store.id)}`, session, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(payload) }); }
export async function updateMenu(session: Session, item: MenuItem, payload: Partial<MenuItem>) { await rest(`menu_items?id=eq.${encodeURIComponent(item.id)}&store_id=eq.${encodeURIComponent(item.store_id)}`, session, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(payload) }); }
export async function registerPushToken(session: Session, token: string, preferences: { tone: "ap_chime" | "ap_urgent" | "ap_priority"; enabled: boolean }) { await rest("mobile_device_tokens?on_conflict=expo_push_token", session, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ user_id: session.user.id, app_role: "store_owner", expo_push_token: token, notification_tone: preferences.tone, notifications_enabled: preferences.enabled, updated_at: new Date().toISOString() }) }); }
