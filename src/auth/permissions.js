export const PERMISSIONS = Object.freeze({
  VIEW_OVERVIEW: 'view-overview',
  VIEW_CAMERAS: 'view-cameras',
  VIEW_PAST_ALERTS: 'view-past-alerts',
  MANUAL_ROVER_CONTROL: 'manual-rover-control',
  CHANGE_OPERATING_MODE: 'change-operating-mode',
  MOTOR_POWER_CONTROLS: 'motor-power-controls',
  RESPOND_TO_ALERTS: 'respond-to-alerts',
  ACCESS_ADMIN: 'access-admin',
});

export const PERMISSION_OPTIONS = [
  {
    key: PERMISSIONS.VIEW_OVERVIEW,
    label: 'View Overview',
    description: 'Access the operational overview and live event stream.',
  },
  {
    key: PERMISSIONS.VIEW_CAMERAS,
    label: 'View Cameras',
    description: 'Watch live rover camera feeds.',
  },
  {
    key: PERMISSIONS.VIEW_PAST_ALERTS,
    label: 'View Past Alerts',
    description: 'Open the archived alerts workspace.',
  },
  {
    key: PERMISSIONS.MANUAL_ROVER_CONTROL,
    label: 'Manual rover control',
    description: 'Use directional controls and keyboard driving commands.',
  },
  {
    key: PERMISSIONS.CHANGE_OPERATING_MODE,
    label: 'Change operating mode',
    description: 'Switch the rover between manual and autonomous operation.',
  },
  {
    key: PERMISSIONS.MOTOR_POWER_CONTROLS,
    label: 'Motor / power controls',
    description: 'Adjust motor speed and power-related controls.',
  },
  {
    key: PERMISSIONS.RESPOND_TO_ALERTS,
    label: 'Acknowledge / respond to alerts',
    description: 'Change operator assessment and verification status.',
  },
  {
    key: PERMISSIONS.ACCESS_ADMIN,
    label: 'Access admin functions',
    description: 'Create accounts, edit access, manage sessions and login requests.',
  },
];

export const ALL_PERMISSIONS = PERMISSION_OPTIONS.map(({ key }) => key);

export const DEFAULT_OPERATOR_PERMISSIONS = ALL_PERMISSIONS.filter(
  (permission) => permission !== PERMISSIONS.ACCESS_ADMIN
);

export const hasPermission = (user, permission) => (
  Boolean(user?.permissions?.includes(permission))
);

export const getFirstAllowedView = (user) => {
  if (hasPermission(user, PERMISSIONS.VIEW_OVERVIEW)) return 'home-view';
  if (hasPermission(user, PERMISSIONS.VIEW_CAMERAS)) return 'cameras-view';
  if (hasPermission(user, PERMISSIONS.VIEW_PAST_ALERTS)) return 'past-alerts-view';
  if (hasPermission(user, PERMISSIONS.ACCESS_ADMIN)) return 'admin-view';
  return null;
};
