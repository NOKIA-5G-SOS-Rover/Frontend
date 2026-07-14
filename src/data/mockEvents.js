export const initialMockEvents = [
  {
    id: 'event-initial-1',
    type: 'system_ready',
    title: 'Monitoring system online',
    description: '5G link, rover sensors, and Camera 2 are reporting normally.',
    severity: 'info',
    cameraId: 'Camera 2',
    location: 'Sector A',
    confidence: null,
    timestamp: new Date(Date.now() - 70000).toISOString(),
    acknowledged: false,
  },
  {
    id: 'event-initial-2',
    type: 'camera_unavailable',
    title: 'Camera 1 unavailable',
    description: 'The camera feed is temporarily unavailable. Reconnection is pending.',
    severity: 'warning',
    cameraId: 'Camera 1',
    location: 'Rover front unit',
    confidence: null,
    timestamp: new Date(Date.now() - 180000).toISOString(),
    acknowledged: false,
  },
];

const mockEventTemplates = [
  {
    type: 'person_detected',
    title: 'Possible person detected',
    description: 'Thermal and visual data indicate a possible survivor.',
    severity: 'critical',
    cameraId: 'Camera 2',
    location: 'Sector A',
    confidenceRange: [86, 97],
  },
  {
    type: 'thermal_anomaly',
    title: 'Thermal anomaly detected',
    description: 'A new heat signature was detected near the rover route.',
    severity: 'warning',
    cameraId: 'Camera 2',
    location: 'Sector B',
    confidenceRange: [68, 91],
  },
  {
    type: 'movement_detected',
    title: 'Movement detected',
    description: 'Motion was detected at the edge of the active camera frame.',
    severity: 'warning',
    cameraId: 'Camera 2',
    location: 'Grid Alpha',
    confidenceRange: [55, 82],
  },
  {
    type: 'connection_update',
    title: '5G connection stable',
    description: 'Low-latency telemetry is operating within the expected range.',
    severity: 'info',
    cameraId: null,
    location: 'Rover network',
    confidenceRange: null,
  },
  {
    type: 'route_update',
    title: 'Rover entered a new sector',
    description: 'Autonomous navigation advanced to the next scan area.',
    severity: 'info',
    cameraId: null,
    location: 'Sector C',
    confidenceRange: null,
  },
];

const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export const createMockEvent = (templateOverride = null) => {
  const template = templateOverride || mockEventTemplates[Math.floor(Math.random() * mockEventTemplates.length)];
  const confidence = template.confidenceRange
    ? randomBetween(template.confidenceRange[0], template.confidenceRange[1])
    : null;

  return {
    id: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: template.type,
    title: template.title,
    description: template.description,
    severity: template.severity,
    cameraId: template.cameraId || null,
    location: template.location || null,
    confidence,
    timestamp: new Date().toISOString(),
    acknowledged: false,
  };
};

export const createSOSEvent = () => createMockEvent({
  type: 'sos_signal',
  title: 'SOS signal received',
  description: 'Emergency signal received. Operator review is required.',
  severity: 'critical',
  cameraId: 'Camera 2',
  location: 'Sector A',
  confidenceRange: [90, 98],
});
