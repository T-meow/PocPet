export const cloudReminderSchemaVersion = 1 as const;
export const cloudReminderStorageKey = 'pocpet.cloud-reminder.v1';
export const cloudReminderFirstDelayMs = 3 * 24 * 60 * 60 * 1000;
export const cloudReminderIntervalMs = 7 * 24 * 60 * 60 * 1000;

export interface CloudReminderPreferencesV1 {
  schemaVersion: 1;
  enabled: boolean;
  snoozedUntil?: number;
  lastShownDateKey?: string;
}

export interface CloudReminderDecision {
  due: boolean;
  dueAt: number;
  suppressedToday: boolean;
}

export const shouldDisplayCloudReminder = (
  cloudStatusReadable: boolean,
  decision: CloudReminderDecision,
) => cloudStatusReadable && decision.due && !decision.suppressedToday;

export const defaultCloudReminderPreferences = (): CloudReminderPreferencesV1 => ({
  schemaVersion: cloudReminderSchemaVersion,
  enabled: true,
});

const isFiniteTimestamp = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export const normalizeCloudReminderPreferences = (value: unknown): CloudReminderPreferencesV1 => {
  const fallback = defaultCloudReminderPreferences();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== cloudReminderSchemaVersion) return fallback;
  return {
    schemaVersion: cloudReminderSchemaVersion,
    enabled: raw.enabled !== false,
    snoozedUntil: isFiniteTimestamp(raw.snoozedUntil) ? raw.snoozedUntil : undefined,
    lastShownDateKey: typeof raw.lastShownDateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastShownDateKey)
      ? raw.lastShownDateKey
      : undefined,
  };
};

export const getLocalNaturalDateKey = (now = Date.now()) => {
  const date = new Date(now);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

export const getCloudReminderDecision = ({
  createdAt,
  uploadedAt,
  now = Date.now(),
  preferences,
}: {
  createdAt: number;
  uploadedAt?: number;
  now?: number;
  preferences: CloudReminderPreferencesV1;
}): CloudReminderDecision => {
  const safeCreatedAt = isFiniteTimestamp(createdAt) ? Math.min(createdAt, now) : now;
  const safeUploadedAt = isFiniteTimestamp(uploadedAt) ? uploadedAt : undefined;
  const backupDueAt = safeUploadedAt !== undefined
    ? safeUploadedAt + cloudReminderIntervalMs
    : safeCreatedAt + cloudReminderFirstDelayMs;
  const dueAt = Math.max(backupDueAt, preferences.snoozedUntil ?? 0);
  const suppressedToday = preferences.lastShownDateKey === getLocalNaturalDateKey(now);
  return {
    due: preferences.enabled && now >= dueAt,
    dueAt,
    suppressedToday,
  };
};

export const readCloudReminderPreferences = (): CloudReminderPreferencesV1 => {
  if (typeof window === 'undefined') return defaultCloudReminderPreferences();
  try {
    return normalizeCloudReminderPreferences(JSON.parse(window.localStorage.getItem(cloudReminderStorageKey) ?? 'null'));
  } catch {
    return defaultCloudReminderPreferences();
  }
};

export const writeCloudReminderPreferences = (preferences: CloudReminderPreferencesV1) => {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(cloudReminderStorageKey, JSON.stringify(normalizeCloudReminderPreferences(preferences)));
    } catch {
      // Reminders remain session-local when storage is disabled or full.
    }
  }
};

export const snoozeCloudReminder = (preferences: CloudReminderPreferencesV1, now = Date.now()) => ({
  ...preferences,
  snoozedUntil: now + cloudReminderIntervalMs,
  lastShownDateKey: getLocalNaturalDateKey(now),
});

export const markCloudReminderShownToday = (preferences: CloudReminderPreferencesV1, now = Date.now()) => ({
  ...preferences,
  lastShownDateKey: getLocalNaturalDateKey(now),
});
