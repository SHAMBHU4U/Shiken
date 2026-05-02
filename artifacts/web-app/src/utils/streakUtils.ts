const SUBJECTS = ["maths", "english", "hindi", "science", "social", "sanskrit"];
const BANNER_DISMISSED_KEY = "shiken_banner_dismissed";
const REMINDER_SCHEDULED_KEY = "shiken_reminder_scheduled";

interface HistoryItem { date: number; pct: number; }

export function hasTestedToday(): boolean {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (const subj of SUBJECTS) {
    const raw = localStorage.getItem(`shiken_history_${subj}`);
    if (!raw) continue;
    try {
      const history = JSON.parse(raw) as HistoryItem[];
      if (history.some(r => r.date >= today.getTime())) return true;
    } catch { /* noop */ }
  }
  return false;
}

export function getLocalStreak(): number {
  const allDates = new Set<string>();
  for (const subj of SUBJECTS) {
    const raw = localStorage.getItem(`shiken_history_${subj}`);
    if (!raw) continue;
    try {
      const history = JSON.parse(raw) as HistoryItem[];
      history.forEach(r => {
        const d = new Date(r.date);
        allDates.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      });
    } catch { /* noop */ }
  }
  if (!allDates.size) return 0;
  let streak = 0;
  const cur = new Date(); cur.setHours(0, 0, 0, 0);
  const todayKey = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
  if (!allDates.has(todayKey)) cur.setDate(cur.getDate() - 1);
  while (true) {
    const key = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
    if (allDates.has(key)) { streak++; cur.setDate(cur.getDate() - 1); }
    else break;
  }
  return streak;
}

export function isBannerDismissedToday(): boolean {
  const ts = localStorage.getItem(BANNER_DISMISSED_KEY);
  if (!ts) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return parseInt(ts) >= today.getTime();
}

export function dismissBannerForToday(): void {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  localStorage.setItem(BANNER_DISMISSED_KEY, String(today.getTime()));
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function requestAndScheduleReminder(): Promise<"scheduled" | "denied" | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "denied") return "denied";
  let finalPerm: NotificationPermission = Notification.permission;
  if (finalPerm === "default") {
    finalPerm = await Notification.requestPermission();
  }
  if (finalPerm !== "granted") return "denied";
  scheduleEveningReminder();
  return "scheduled";
}

export function scheduleEveningReminder(): void {
  const now = new Date();
  const reminder = new Date();
  reminder.setHours(20, 0, 0, 0);
  if (reminder <= now) reminder.setDate(reminder.getDate() + 1);
  const msUntil = reminder.getTime() - now.getTime();
  const existing = localStorage.getItem(REMINDER_SCHEDULED_KEY);
  if (existing && parseInt(existing) > now.getTime()) return;
  localStorage.setItem(REMINDER_SCHEDULED_KEY, String(reminder.getTime()));
  setTimeout(() => {
    if (hasTestedToday()) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const streak = getLocalStreak();
    new Notification("🔥 SHIKEN — Practice करो आज!", {
      body: streak > 0
        ? `${streak}-day streak है तुम्हारा! टूटने मत दो — अभी Mini Test दो 📚`
        : "आज practice नहीं हुई। थोड़ी practice रोज़ करने से बड़ा फ़र्क पड़ता है! 📚",
      icon: "/favicon.ico",
      tag: "shiken-streak-reminder",
    });
  }, msUntil);
}
