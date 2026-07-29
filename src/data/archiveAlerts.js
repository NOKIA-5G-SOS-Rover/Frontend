const ALERT_TEMPLATES = [
  { title: 'Possible person detected', confidence: 91, severity: 'critical', location: 'Rover perimeter', cameraId: 'Camera 2', hour: 8, minute: 14, imageUrl: '/detections/person-detected.svg', frequency: 4 },
  { title: 'Thermal signature detected', confidence: 88, severity: 'critical', location: 'Rover perimeter', cameraId: 'Camera 2', hour: 11, minute: 32, imageUrl: '/detections/thermal-anomaly.svg', frequency: 2 },
  { title: 'Movement near scan route', confidence: 76, severity: 'warning', location: 'Rover perimeter', cameraId: 'Camera 1', hour: 13, minute: 7, imageUrl: '/detections/movement-detected.svg', frequency: 5 },
  { title: 'Multiple targets detected', confidence: 95, severity: 'critical', location: 'Rover perimeter', cameraId: 'Camera 2', hour: 16, minute: 46, imageUrl: '/detections/sos-signal.svg', frequency: 3 },
  { title: 'Unusual heat pattern', confidence: 73, severity: 'warning', location: 'Rover perimeter', cameraId: 'Camera 2', hour: 18, minute: 21, imageUrl: '/detections/thermal-anomaly.svg', frequency: 6 },
  { title: 'Human-shaped outline detected', confidence: 84, severity: 'critical', location: 'Rover perimeter', cameraId: 'Camera 2', hour: 20, minute: 5, imageUrl: '/detections/person-detected.svg', frequency: 3 },
  { title: 'Low-confidence motion detected', confidence: 67, severity: 'info', location: 'Rover perimeter', cameraId: 'Camera 1', hour: 22, minute: 18, imageUrl: '/detections/movement-detected.svg', frequency: 2 },
];

export const toLocalDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatArchiveDate = (date) => new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}).format(date);

export const formatChartDate = (date) => new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
}).format(date);

export const buildRecentArchiveAlerts = (referenceDate = new Date()) => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  return ALERT_TEMPLATES.map((template, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (ALERT_TEMPLATES.length - 1 - index));
    date.setHours(template.hour, template.minute, 0, 0);

    return {
      sourceId: `archive-${toLocalDateKey(date)}`,
      timestamp: date.toISOString(),
      dateKey: toLocalDateKey(date),
      date: formatArchiveDate(date),
      text: template.title,
      title: template.title,
      tags: ['confidence', 'location'],
      month: date.toLocaleDateString('en-US', { month: 'long' }),
      day: `${date.getDate()}`,
      year: `${date.getFullYear()}`,
      imageUrl: template.imageUrl,
      confidence: template.confidence,
      severity: template.severity,
      location: template.location,
      cameraId: template.cameraId,
      frequency: template.frequency,
    };
  });
};
