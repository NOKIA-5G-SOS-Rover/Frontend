export const REVIEW_STATUSES = ['unverified', 'confirmed-threat', 'false-alarm'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const normalizeConfidence = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;

  const percentage = numericValue >= 0 && numericValue <= 1
    ? numericValue * 100
    : numericValue;

  return Math.round(clamp(percentage, 0, 100) * 10) / 10;
};

export const normalizeReviewStatus = (event = {}) => {
  const candidates = [
    event.verificationStatus,
    event.reviewStatus,
    event.operatorStatus,
    event.status,
  ];

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;

    const normalized = String(candidate)
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-');

    if (REVIEW_STATUSES.includes(normalized)) {
      return normalized;
    }
  }

  // Backend /events entries are AI detections and require operator review by default.
  return 'unverified';
};

const normalizeSeverityValue = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  return ['critical', 'warning', 'info'].includes(normalized) ? normalized : null;
};

export const inferEventSeverity = (event = {}) => {
  const explicitSeverity = normalizeSeverityValue(event.severity || event.priority);
  if (explicitSeverity) return explicitSeverity;

  const eventText = [
    event.alertType,
    event.type,
    event.title,
    event.description,
  ]
    .filter(Boolean)
    .map((value) => String(value)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' '))
    .join(' ')
    .toLowerCase();

  // Human/person detections are the critical SOS case for Sânzi.
  if (/\b(human|person|survivor)\b/.test(eventText) || /\bsos\b/.test(eventText)) {
    return 'critical';
  }

  if (/\b(system|connection|network|online|ready|telemetry)\b/.test(eventText)) {
    return 'info';
  }

  return 'warning';
};

export const formatAlertTitle = (value) => {
  if (!value) return 'System alert';

  const words = String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!words) return 'System alert';
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const resolveEventImageUrl = (imageUrl, backendUrl = '') => {
  if (!imageUrl) return null;

  const stringUrl = String(imageUrl);

  if (/^(?:https?:|data:|blob:)/i.test(stringUrl)) {
    return stringUrl;
  }

  if (stringUrl.startsWith('/detections/')) {
    return stringUrl;
  }

  return `${backendUrl}${stringUrl.startsWith('/') ? '' : '/'}${stringUrl}`;
};

export const toEventDateKey = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const sortEventsNewestFirst = (events = []) => (
  [...events].sort((a, b) => {
    const bTime = new Date(b?.timestamp).getTime();
    const aTime = new Date(a?.timestamp).getTime();
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  })
);
