import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { clearSession, ensureStore, getWorkspace, loadSession, MenuItem, Order, registerPushToken, Session, setOrderStatus, signIn, Store, updateMenu, updateStore } from "./src/api";
import { DEFAULT_NOTIFICATION_PREFERENCES, loadNotificationPreferences, NotificationPreferences, NotificationTone, saveNotificationPreferences } from "./src/notification-settings";
import { notificationToneLabel, notifyNewOrder, playStoreNotificationPreview, setupStoreNotifications } from "./src/notifications";
import { applyOtaUpdate, downloadOtaUpdate, OtaResult } from "./src/ota";

type Tab = "ออร์เดอร์" | "เมนู" | "ร้านค้า";
const TONES: NotificationTone[] = ["ap_chime", "ap_urgent", "ap_priority"];
const money = (value: number) => `฿${Number(value || 0).toLocaleString("th-TH")}`;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [tab, setTab] = useState<Tab>("ออร์เดอร์");
  const [loading, setLoading] = useState(true);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [otaLoading, setOtaLoading] = useState(false);
  const [otaResult, setOtaResult] = useState<OtaResult | null>(null);

  const refresh = async (activeSession = session, activeStore = store, show = true) => {
    if (!activeSession || !activeStore) return;
    try {
      const workspace = await getWorkspace(activeSession, activeStore);
      const newOrders = workspace.orders.filter((order) => ["ร้านค้ารับออร์เดอร์", "รอตรวจสอบเครดิต"].includes(order.status));
      if (seen.size && newOrders.some((order) => !seen.has(order.id))) await notifyNewOrder(newOrders.length, preferences);
      setSeen(new Set(workspace.orders.map((order) => order.id)));
      setOrders(workspace.orders);
      setMenu(workspace.menu);
      if (show) Alert.alert("อัปเดตแล้ว", "ข้อมูลร้านค้าล่าสุดแล้ว");
    } catch (error) {
      Alert.alert("รีเฟรชไม่สำเร็จ", error instanceof Error ? error.message : "ตรวจสอบอินเทอร์เน็ต");
    }
  };

  const boot = async (given?: Session | null) => {
    const next = given || await loadSession();
    if (!next) { setLoading(false); return; }
    try {
      const [profile, savedPreferences] = await Promise.all([ensureStore(next), loadNotificationPreferences()]);
      setSession(next);
      setStore(profile);
      setPreferences(savedPreferences);
      await refresh(next, profile, false);
      const token = await setupStoreNotifications();
      if (token) { setPushToken(token); await registerPushToken(next, token, savedPreferences); }
    } catch (error) {
      await clearSession();
      Alert.alert("ไม่สามารถเข้าสู่ระบบร้านค้า", error instanceof Error ? error.message : "โปรดลองใหม่");
    } finally { setLoading(false); }
  };

  useEffect(() => { void boot(); }, []);
  useEffect(() => {
    if (!session || !store) return;
    const timer = setInterval(() => { void refresh(session, store, false); }, 15000);
    return () => clearInterval(timer);
  }, [session, store, preferences, seen]);

  const login = async () => {
    setLoading(true);
    try { await boot(await signIn(identifier.trim(), password)); }
    catch (error) { Alert.alert("เข้าสู่ระบบไม่สำเร็จ", error instanceof Error ? error.message : "ตรวจสอบ Login ID/อีเมล และรหัสผ่านอีกครั้ง"); setLoading(false); }
  };

  const updatePreferences = async (next: NotificationPreferences) => {
    setPreferences(next);
    await saveNotificationPreferences(next);
    if (session && pushToken) await registerPushToken(session, pushToken, next);
  };

  const previewTone = async () => {
    try { await playStoreNotificationPreview(preferences); }
    catch { Alert.alert("ยังไม่สามารถเล่นตัวอย่าง", "โปรดอนุญาตการแจ้งเตือนในการตั้งค่าโทรศัพท์ก่อน"); }
  };

  const checkOta = async () => {
    setOtaLoading(true);
    const result = await downloadOtaUpdate();
    setOtaResult(result);
    setOtaLoading(false);
    if (result.state === "ready") {
      Alert.alert("อัปเดตพร้อมแล้ว", result.message, [{ text: "ภายหลัง", style: "cancel" }, { text: "เริ่มใช้ตอนนี้", onPress: () => { void applyOtaUpdate(); } }]);
    } else {
      Alert.alert(result.state === "up-to-date" ? "อัปเดตแอป" : "สถานะ OTA", result.message);
    }
  };

  const updateOrder = (order: Order, status: "กำลังเตรียมสินค้า" | "ไรเดอร์กำลังไปรับ") => {
    if (!session || !store) return;
    const label = status === "กำลังเตรียมสินค้า" ? "เริ่มเตรียมสินค้า" : "ยืนยันว่าพร้อมให้ไรเดอร์รับ";
    Alert.alert("ยืนยันอัปเดตออร์เดอร์", `${label}\n\nออร์เดอร์: ${order.id}\nลูกค้า: ${order.customer_name}\nยอด: ${money(order.payable || order.total)}`, [{ text: "กลับ", style: "cancel" }, { text: "ยืนยัน", onPress: async () => { try { await setOrderStatus(session, order, status); await refresh(session, store, false); } catch (error) { Alert.alert("อัปเดตสถานะไม่สำเร็จ", error instanceof Error ? error.message : "โปรดลองอีกครั้ง"); } } }]);
  };

  const confirmStoreActive = (active: boolean) => {
    if (!session || !store) return;
    Alert.alert("ยืนยันสถานะร้าน", `${active ? "เปิดรับออร์เดอร์" : "ปิดรับออร์เดอร์ชั่วคราว"}สำหรับ ${store.name} หรือไม่`, [{ text: "กลับ", style: "cancel" }, { text: "ยืนยัน", onPress: async () => { try { await updateStore(session, store, { active }); setStore({ ...store, active }); } catch (error) { Alert.alert("อัปเดตสถานะร้านไม่สำเร็จ", error instanceof Error ? error.message : "โปรดลองอีกครั้ง"); } } }]);
  };

  const confirmMenuUpdate = (item: MenuItem, payload: Partial<MenuItem>, label: string) => {
    if (!session || !store) return;
    Alert.alert("ยืนยันแก้ไขเมนู", `${label}\n\nเมนู: ${item.name}`, [{ text: "กลับ", style: "cancel" }, { text: "ยืนยันบันทึก", onPress: async () => { try { await updateMenu(session, item, payload); await refresh(session, store, false); } catch (error) { Alert.alert("บันทึกเมนูไม่สำเร็จ", error instanceof Error ? error.message : "โปรดลองอีกครั้ง"); } } }]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0B6E5B" /></View>;
  if (!session || !store) return <SafeAreaView style={styles.auth}><Text style={styles.brand}>AP Store</Text><Text style={styles.subtitle}>จัดการเฉพาะร้านค้า ออร์เดอร์ และเมนูของคุณ</Text><TextInput style={styles.input} placeholder="อีเมล หรือ Login ID ที่แอดมินออกให้" autoCapitalize="none" value={identifier} onChangeText={setIdentifier} /><TextInput style={styles.input} placeholder="รหัสผ่าน" secureTextEntry value={password} onChangeText={setPassword} /><Pressable style={styles.primary} onPress={login}><Text style={styles.primaryText}>เข้าสู่ระบบร้านค้า</Text></Pressable><Text style={styles.help}>ผู้ดูแลต้องสร้างและผูกบัญชีนี้กับร้านค้าใน Supabase ก่อนเริ่มใช้งาน</Text></SafeAreaView>;

  const pending = orders.filter((order) => ["ร้านค้ารับออร์เดอร์", "รอตรวจสอบเครดิต"].includes(order.status));
  const preparing = orders.filter((order) => order.status === "กำลังเตรียมสินค้า");
  const live = orders.filter((order) => !["สำเร็จแล้ว", "ยกเลิก"].includes(order.status));
  const orderCard = ({ item }: { item: Order }) => <View style={styles.card}><View style={styles.row}><View><Text style={styles.orderId}>{item.id}</Text><Text style={styles.muted}>{item.customer_name} · {money(item.payable || item.total)}</Text></View><Text style={styles.pill}>{item.status}</Text></View><Text style={styles.line}>จัดส่ง: {item.delivery_address || "ยังไม่ระบุ"}</Text>{item.note ? <Text style={styles.note}>หมายเหตุ: {item.note}</Text> : null}<View style={styles.actions}>{["ร้านค้ารับออร์เดอร์", "รอตรวจสอบเครดิต"].includes(item.status) ? <Pressable style={styles.primarySmall} onPress={() => updateOrder(item, "กำลังเตรียมสินค้า")}><Text style={styles.primaryText}>เริ่มเตรียมสินค้า</Text></Pressable> : null}{item.status === "กำลังเตรียมสินค้า" ? <Pressable style={styles.primarySmall} onPress={() => updateOrder(item, "ไรเดอร์กำลังไปรับ")}><Text style={styles.primaryText}>พร้อมให้ไรเดอร์รับ</Text></Pressable> : null}{item.rider_name ? <Text style={styles.rider}>ไรเดอร์: {item.rider_name}</Text> : null}</View></View>;

  return <SafeAreaView style={styles.page}><StatusBar barStyle="dark-content" /><View style={styles.header}><View><Text style={styles.kicker}>STORE WORKSPACE</Text><Text style={styles.title}>{store.name}</Text></View><Pressable style={styles.refresh} onPress={() => void refresh()}><Text>↻</Text></Pressable></View><View style={styles.openStrip}><Text style={styles.muted}>รับออร์เดอร์</Text><Switch value={store.active} trackColor={{ true: "#0B6E5B" }} onValueChange={confirmStoreActive} /><Text style={styles.openText}>{store.active ? "เปิดร้าน" : "ปิดชั่วคราว"}</Text></View>{tab === "ออร์เดอร์" ? <View style={{ flex: 1 }}><View style={styles.stats}><Stat label="ออร์เดอร์ใหม่" value={pending.length} /><Stat label="กำลังเตรียม" value={preparing.length} /><Stat label="งานค้าง" value={live.length} /></View><FlatList contentContainerStyle={styles.list} data={live} keyExtractor={(item) => item.id} renderItem={orderCard} ListHeaderComponent={<Text style={styles.section}>ออร์เดอร์ของร้าน</Text>} ListEmptyComponent={<View style={styles.empty}><Text style={styles.muted}>ยังไม่มีออร์เดอร์ที่ต้องดำเนินการ</Text></View>} /></View> : tab === "เมนู" ? <FlatList contentContainerStyle={styles.list} data={menu} keyExtractor={(item) => item.id} ListHeaderComponent={<Text style={styles.section}>เมนู ราคา และสต็อก</Text>} renderItem={({ item }) => <View style={styles.card}><View style={styles.row}><Text style={styles.emoji}>{item.emoji}</Text><View style={{ flex: 1 }}><Text style={styles.orderId}>{item.name}</Text><Text style={styles.muted}>{money(item.price)} · เหลือ {item.stock}</Text></View><Switch value={item.available} trackColor={{ true: "#0B6E5B" }} onValueChange={(available) => confirmMenuUpdate(item, { available }, available ? "เปิดขายสินค้า" : "ปิดขายสินค้าชั่วคราว")} /></View><View style={styles.menuFields}><TextInput style={styles.menuInput} keyboardType="numeric" defaultValue={String(item.price)} onEndEditing={(event) => confirmMenuUpdate(item, { price: Number(event.nativeEvent.text || 0) }, `เปลี่ยนราคาเป็น ${money(Number(event.nativeEvent.text || 0))}`)} placeholder="ราคา" /><TextInput style={styles.menuInput} keyboardType="numeric" defaultValue={String(item.stock)} onEndEditing={(event) => confirmMenuUpdate(item, { stock: Number(event.nativeEvent.text || 0) }, `เปลี่ยนสต็อกเป็น ${Number(event.nativeEvent.text || 0)} ชิ้น`)} placeholder="สต็อก" /></View></View>} /> : <ScrollView contentContainerStyle={styles.list}><Text style={styles.section}>ข้อมูลหน้าร้าน</Text><View style={styles.card}><Text style={styles.orderId}>ชื่อร้าน</Text><Text style={styles.muted}>{store.name}</Text><Text style={[styles.orderId, { marginTop: 16 }]}>รายละเอียด</Text><Text style={styles.muted}>{store.description || "ยังไม่มีรายละเอียด"}</Text></View><View style={styles.settingsCard}><View style={styles.settingsRow}><View style={{ flex: 1 }}><Text style={styles.settingsTitle}>แจ้งเตือนออร์เดอร์และข้อความใหม่</Text><Text style={styles.muted}>เปิดเสียงเตือนเมื่อมีรายการใหม่เข้าร้าน</Text></View><Switch value={preferences.enabled} trackColor={{ true: "#0B6E5B" }} onValueChange={(enabled) => void updatePreferences({ ...preferences, enabled })} /></View><Text style={styles.settingsTitle}>เลือกเสียงแจ้งเตือน</Text><View style={styles.toneList}>{TONES.map((tone) => <Pressable key={tone} style={[styles.toneButton, preferences.tone === tone && styles.toneButtonActive]} onPress={() => void updatePreferences({ ...preferences, tone })}><Text style={[styles.toneText, preferences.tone === tone && styles.toneTextActive]}>{notificationToneLabel(tone)}</Text></Pressable>)}</View><Pressable style={styles.outline} onPress={() => void previewTone()}><Text style={styles.outlineText}>ทดสอบเสียงที่เลือก</Text></Pressable></View><View style={styles.otaCard}><Text style={styles.settingsTitle}>อัปเดตภายในแอป</Text><Text style={styles.muted}>ตรวจและดาวน์โหลดการแก้ไขหน้าจอหรือฟังก์ชันใหม่โดยไม่ต้องติดตั้ง APK ซ้ำ</Text>{otaResult ? <Text style={styles.otaStatus}>{otaResult.message}</Text> : null}<Pressable style={styles.primarySmall} onPress={() => void checkOta()} disabled={otaLoading}><Text style={styles.primaryText}>{otaLoading ? "กำลังตรวจสอบ..." : "ตรวจสอบการอัปเดต"}</Text></Pressable><Text style={styles.help}>การเพิ่มสิทธิ์โทรศัพท์ เสียงใหม่ หรือส่วน native จะต้องติดตั้ง APK รุ่นใหม่</Text></View><Pressable style={[styles.outline, { marginTop: 24 }]} onPress={() => Alert.alert("ยืนยันออกจากระบบ", "ต้องการออกจากบัญชีร้านค้านี้หรือไม่", [{ text: "กลับ", style: "cancel" }, { text: "ออกจากระบบ", style: "destructive", onPress: async () => { await clearSession(); setSession(null); setStore(null); } }])}><Text style={styles.outlineText}>ออกจากระบบ</Text></Pressable></ScrollView>}<View style={styles.nav}>{(["ออร์เดอร์", "เมนู", "ร้านค้า"] as Tab[]).map((item) => <Pressable key={item} style={styles.navItem} onPress={() => setTab(item)}><Text style={[styles.navText, tab === item && styles.navActive]}>{item === "ออร์เดอร์" ? "ออร์เดอร์" : item === "เมนู" ? "เมนู" : "ร้านค้า"}</Text></Pressable>)}</View></SafeAreaView>;
}

const Stat = ({ label, value }: { label: string; value: number }) => <View style={styles.stat}><Text style={styles.muted}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FBFAF7" }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, auth: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#FBFAF7" }, brand: { color: "#0B6E5B", fontWeight: "900", fontSize: 34 }, subtitle: { color: "#63726D", marginTop: 8, marginBottom: 24, lineHeight: 21 }, input: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#DDE7E3", borderRadius: 14, padding: 14, fontSize: 16, marginBottom: 12 }, primary: { backgroundColor: "#0B6E5B", padding: 15, borderRadius: 14, alignItems: "center" }, primarySmall: { backgroundColor: "#0B6E5B", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignSelf: "flex-start", marginTop: 12 }, primaryText: { color: "#FFF", fontWeight: "800" }, help: { color: "#6D7A76", marginTop: 12, fontSize: 12, lineHeight: 18 }, header: { padding: 18, backgroundColor: "#FFF", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, kicker: { color: "#0B6E5B", fontSize: 10, letterSpacing: 1.1, fontWeight: "900" }, title: { color: "#15352E", fontWeight: "900", fontSize: 23, marginTop: 4 }, refresh: { backgroundColor: "#DDF5EE", padding: 12, borderRadius: 14 }, openStrip: { backgroundColor: "#EFF8F4", flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 }, openText: { color: "#0B6E5B", fontWeight: "800", fontSize: 12 }, stats: { flexDirection: "row", gap: 10, margin: 16 }, stat: { flex: 1, padding: 13, backgroundColor: "#FFF", borderRadius: 16 }, statValue: { color: "#0B6E5B", fontWeight: "900", fontSize: 23, marginTop: 7 }, list: { padding: 16, paddingBottom: 100 }, section: { color: "#15352E", fontSize: 18, fontWeight: "900", marginBottom: 10 }, card: { backgroundColor: "#FFF", borderRadius: 18, borderWidth: 1, borderColor: "#E3EBE7", padding: 14, marginBottom: 10 }, row: { flexDirection: "row", alignItems: "center", gap: 10 }, orderId: { color: "#15352E", fontWeight: "900" }, muted: { color: "#6D7A76", fontSize: 12, lineHeight: 18 }, pill: { color: "#0B6E5B", fontSize: 11, backgroundColor: "#DDF5EE", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, maxWidth: 140 }, line: { color: "#33433F", marginTop: 10, fontSize: 13 }, note: { color: "#A35E00", fontSize: 12, marginTop: 7 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }, rider: { color: "#0B6E5B", fontSize: 12, fontWeight: "800" }, emoji: { fontSize: 28 }, menuFields: { flexDirection: "row", gap: 8, marginTop: 12 }, menuInput: { flex: 1, borderWidth: 1, borderColor: "#DDE7E3", padding: 10, borderRadius: 10, fontSize: 13 }, outline: { borderWidth: 1, borderColor: "#AFC4BA", paddingHorizontal: 12, paddingVertical: 10, alignSelf: "flex-start", borderRadius: 10, marginTop: 10 }, outlineText: { color: "#0B6E5B", fontWeight: "800", fontSize: 12 }, empty: { backgroundColor: "#FFF", borderRadius: 16, padding: 24, alignItems: "center" }, settingsCard: { backgroundColor: "#EFF8F4", borderRadius: 16, padding: 14, marginTop: 8 }, settingsRow: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 14 }, settingsTitle: { color: "#15352E", fontSize: 14, fontWeight: "900", marginBottom: 5 }, toneList: { gap: 8, marginTop: 5 }, toneButton: { borderWidth: 1, borderColor: "#B6D0C5", padding: 10, borderRadius: 10 }, toneButtonActive: { backgroundColor: "#0B6E5B", borderColor: "#0B6E5B" }, toneText: { color: "#0B6E5B", fontWeight: "700", fontSize: 12 }, toneTextActive: { color: "#FFF" }, otaCard: { backgroundColor: "#FFF7E7", borderRadius: 16, padding: 14, marginTop: 14 }, otaStatus: { color: "#9A6400", fontSize: 12, lineHeight: 18, marginTop: 8 }, nav: { flexDirection: "row", paddingVertical: 12, backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#E3EBE7" }, navItem: { flex: 1, alignItems: "center" }, navText: { color: "#76847F", fontSize: 12 }, navActive: { color: "#0B6E5B", fontWeight: "900" },
});
