import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import type { NotificationPreferences, NotificationTone } from "./notification-settings";

const toneLabels: Record<NotificationTone, string> = {
  ap_chime: "เสียงกริ่งชัดเจน",
  ap_urgent: "เสียงเร่งด่วน",
  ap_priority: "เสียงสำคัญมาก",
};

export const notificationToneLabel = (tone: NotificationTone) => toneLabels[tone];
export const storeChannelId = (tone: NotificationTone) => `store-${tone}`;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

async function createStoreChannels() {
  if (Platform.OS !== "android") return;
  const tones: NotificationTone[] = ["ap_chime", "ap_urgent", "ap_priority"];
  await Promise.all(tones.map((tone) => Notifications.setNotificationChannelAsync(storeChannelId(tone), {
    name: `ออร์เดอร์ร้านค้า · ${toneLabels[tone]}`,
    description: "ใช้สำหรับออร์เดอร์และข้อความใหม่ของร้านค้า",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: tone === "ap_priority" ? [0, 700, 160, 700, 160, 700, 160, 700] : [0, 250, 180, 250],
    sound: `${tone}.wav`,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  })));
}

export async function setupStoreNotifications() {
  await createStoreChannels();
  if (!Device.isDevice) throw new Error("ต้องเปิดจากโทรศัพท์จริงเพื่อรับการแจ้งเตือน");
  const current = await Notifications.getPermissionsAsync();
  const status = current.status === "granted" ? current.status : (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") throw new Error("ยังไม่ได้อนุญาตการแจ้งเตือน กรุณาเปิดสิทธิ์ Notifications ของ AP Store ในการตั้งค่าโทรศัพท์");
  const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("ไม่พบรหัสโครงการสำหรับสร้าง Push token");
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  if (!token) throw new Error("ยังสร้าง Push token ไม่สำเร็จ โปรดตรวจสอบอินเทอร์เน็ตแล้วเปิดแอปใหม่");
  return token;
}

export async function notifyNewOrder(count: number, preferences: NotificationPreferences) {
  if (!preferences.enabled) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: "มีออร์เดอร์ใหม่", body: `มี ${count} ออร์เดอร์รอร้านยืนยัน`, sound: "ap_priority.wav", priority: Notifications.AndroidNotificationPriority.MAX, data: { screen: "orders", kind: "order" } },
    trigger: Platform.OS === "android" ? { channelId: storeChannelId("ap_priority") } : null,
  });
}

export async function notifyStoreActionConfirmed(preferences: NotificationPreferences) {
  if (!preferences.enabled) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: "ยืนยันคำสั่งแล้ว", body: "ระบบกำลังดำเนินการ", sound: "ap_chime.wav", data: { kind: "action" } },
    trigger: Platform.OS === "android" ? { channelId: storeChannelId("ap_chime") } : null,
  });
}

export async function notifyNewMessage(body: string, preferences: NotificationPreferences) {
  if (!preferences.enabled) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: "มีข้อความใหม่", body, sound: `${preferences.tone}.wav`, data: { screen: "orders", kind: "message" } },
    trigger: Platform.OS === "android" ? { channelId: storeChannelId(preferences.tone) } : null,
  });
}

export async function playStoreNotificationPreview(preferences: NotificationPreferences) {
  await notifyNewOrder(1, preferences);
}
