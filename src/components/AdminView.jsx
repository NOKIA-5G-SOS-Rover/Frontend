import React, { useEffect, useMemo, useState } from 'react';
import { ALL_PERMISSIONS, PERMISSION_OPTIONS, PERMISSIONS } from '../auth/permissions';

const ADMIN_DEMO_STORAGE_KEY = 'sanzi-admin-demo-state-v2';

const ROVERS = [
  {
    id: 'sanzi',
    name: 'Sânzi',
  },
];

const INITIAL_STATE = {
  accounts: [
    {
      id: 'account-admin',
      username: 'admin',
      enabled: true,
      roverIds: ['sanzi'],
      permissions: [...ALL_PERMISSIONS],
      createdAt: null,
      lastLogin: null,
    },
  ],
  sessions: [],
  loginRequests: [],
  activity: [],
};

const cloneInitialState = () => JSON.parse(JSON.stringify(INITIAL_STATE));

const readAdminDemoState = () => {
  try {
    const stored = window.localStorage.getItem(ADMIN_DEMO_STORAGE_KEY);
    if (!stored) return cloneInitialState();
    const parsed = JSON.parse(stored);
    if (!parsed?.accounts || !parsed?.sessions || !parsed?.loginRequests || !parsed?.activity) {
      return cloneInitialState();
    }

    const storedAdmin = parsed.accounts.find((account) => account.id === 'account-admin');
    const normalizedAdmin = {
      ...(storedAdmin || cloneInitialState().accounts[0]),
      id: 'account-admin',
      username: storedAdmin?.username || 'admin',
      enabled: true,
      permissions: [...ALL_PERMISSIONS],
    };

    return {
      ...parsed,
      accounts: [
        normalizedAdmin,
        ...parsed.accounts.filter((account) => account.id !== 'account-admin'),
      ],
    };
  } catch (error) {
    return cloneInitialState();
  }
};

const formatDateTime = (value) => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const getAccountRole = (account) => (
  account.permissions.includes(PERMISSIONS.ACCESS_ADMIN) ? 'Admin' : 'Operator'
);

const getPermissionLabel = (permissionKey) => (
  PERMISSION_OPTIONS.find((permission) => permission.key === permissionKey)?.label || permissionKey
);

function Switch({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      className={`admin-switch ${checked ? 'is-on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

function StatusPill({ children, tone = 'neutral' }) {
  return <span className={`admin-status-pill admin-status-pill--${tone}`}>{children}</span>;
}

function CreateAccountPanel({ onClose, onCreate }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roverIds, setRoverIds] = useState(['sanzi']);
  const [permissions, setPermissions] = useState([
    PERMISSIONS.VIEW_OVERVIEW,
    PERMISSIONS.VIEW_CAMERAS,
    PERMISSIONS.VIEW_PAST_ALERTS,
  ]);
  const [error, setError] = useState('');
  const [permissionsOpen, setPermissionsOpen] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const toggleRover = (roverId) => {
    setRoverIds((current) => (
      current.includes(roverId)
        ? current.filter((id) => id !== roverId)
        : [...current, roverId]
    ));
  };

  const togglePermission = (permission) => {
    setPermissions((current) => (
      current.includes(permission)
        ? current.filter((key) => key !== permission)
        : [...current, permission]
    ));
  };

  const submit = async (event) => {
    event.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      setError('Enter a username and password.');
      return;
    }
    if (!roverIds.length) {
      setError('Assign at least one rover.');
      return;
    }
    if (!permissions.length) {
      setError('Choose at least one permission.');
      return;
    }

    const result = await onCreate({
      username: cleanUsername,
      password,
      roverIds,
      permissions,
    });

    if (!result?.success) {
      setError(result?.message || 'The account could not be created.');
      return;
    }

    onClose();
  };

  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="admin-account-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-account-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="admin-panel-header">
          <div>
            <span className="admin-panel-eyebrow">Account provisioning</span>
            <h2 id="create-account-title">Create account</h2>
          </div>
          <button type="button" className="admin-icon-button" onClick={onClose} aria-label="Close create account panel">×</button>
        </div>

        <form className="admin-create-form" onSubmit={submit}>
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Username</span>
              <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="e.g. response.operator" autoComplete="off" autoFocus />
            </label>
            <label className="admin-field">
              <span>Initial password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Set initial password" autoComplete="new-password" />
            </label>
          </div>

          <fieldset className="admin-form-section">
            <legend>Assigned rovers</legend>
            <p>An account can be assigned to multiple backend-provided rovers. Only Sânzi is available right now.</p>
            <div className="admin-rover-picker">
              {ROVERS.map((rover) => {
                const selected = roverIds.includes(rover.id);
                return (
                  <button
                    key={rover.id}
                    type="button"
                    className={`admin-rover-option ${selected ? 'is-selected' : ''}`}
                    onClick={() => toggleRover(rover.id)}
                    aria-pressed={selected}
                  >
                    <span className="admin-rover-option__signal" />
                    <span><strong>{rover.name}</strong></span>
                    <span>{selected ? 'Assigned' : 'Assign'}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="admin-form-section admin-form-section--collapsible">
            <button
              type="button"
              className="admin-collapse-trigger"
              aria-expanded={permissionsOpen}
              onClick={() => setPermissionsOpen((open) => !open)}
            >
              <span>
                <strong>Permissions</strong>
                <small>{permissions.length}/{PERMISSION_OPTIONS.length} selected</small>
              </span>
              <span className={`admin-chevron ${permissionsOpen ? 'is-open' : ''}`} aria-hidden="true">⌄</span>
            </button>
            <div className={`admin-collapse-content ${permissionsOpen ? 'is-open' : ''}`}>
              <div className="admin-collapse-content__inner">
                <p>Access is granted per capability and can be changed instantly later.</p>
                <div className="admin-permission-grid">
                  {PERMISSION_OPTIONS.map((permission) => {
                    const enabled = permissions.includes(permission.key);
                    return (
                      <div key={permission.key} className={`admin-permission-option ${enabled ? 'is-enabled' : ''}`}>
                        <div><strong>{permission.label}</strong><small>{permission.description}</small></div>
                        <Switch checked={enabled} onChange={() => togglePermission(permission.key)} label={`Toggle ${permission.label}`} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {error && <div className="admin-form-error" role="alert">{error}</div>}

          <div className="admin-panel-actions">
            <button type="button" className="admin-secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="admin-primary-button">Create account <span aria-hidden="true">↗</span></button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AccountDetail({ account, sessions, onTogglePermission, onToggleRover, onToggleEnabled, onDelete, onForceLogout }) {
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [roverPickerOpen, setRoverPickerOpen] = useState(false);
  const accountSessions = sessions.filter((session) => session.accountId === account.id);
  const isCurrentAdmin = account.id === 'account-admin';
  const assignedRovers = account.roverIds
    .map((roverId) => ROVERS.find((rover) => rover.id === roverId))
    .filter(Boolean);
  const availableRovers = ROVERS.filter((rover) => !account.roverIds.includes(rover.id));

  return (
    <div className="admin-account-detail">
      <div className="admin-account-detail__head">
        <div>
          <span className="admin-panel-eyebrow">Selected account</span>
          <h3>{account.username}</h3>
          <div className="admin-inline-meta">
            <StatusPill tone={account.enabled ? 'online' : 'disabled'}>{account.enabled ? 'Enabled' : 'Disabled'}</StatusPill>
            <StatusPill tone={getAccountRole(account) === 'Admin' ? 'admin' : 'neutral'}>{getAccountRole(account)}</StatusPill>
            {accountSessions.length > 0 && <StatusPill tone="online">{accountSessions.length} active session{accountSessions.length === 1 ? '' : 's'}</StatusPill>}
          </div>
        </div>
        <span className="admin-account-monogram" aria-hidden="true">{account.username.slice(0, 2).toUpperCase()}</span>
      </div>

      <div className="admin-detail-section">
        <div className="admin-detail-heading admin-rover-detail-heading">
          <div><span>Rover access</span><small>Backend inventory</small></div>
          <div className="admin-detail-heading__actions">
            <button
              type="button"
              className="admin-add-rover-button"
              aria-expanded={roverPickerOpen}
              onClick={() => setRoverPickerOpen((open) => !open)}
            >
              Add rover <span aria-hidden="true">＋</span>
            </button>
          </div>
        </div>

        <div className={`admin-rover-add-panel ${roverPickerOpen ? 'is-open' : ''}`}>
          <div className="admin-rover-add-panel__inner">
            {availableRovers.length ? (
              availableRovers.map((rover) => (
                <button
                  key={rover.id}
                  type="button"
                  className="admin-rover-add-option"
                  onClick={() => {
                    onToggleRover(account.id, rover.id);
                    setRoverPickerOpen(false);
                  }}
                >
                  <span className="admin-rover-dot" />
                  <strong>{rover.name}</strong>
                  <span>Add</span>
                </button>
              ))
            ) : (
              <p>No additional backend rovers are available.</p>
            )}
          </div>
        </div>

        <div className="admin-rover-access-list">
          {assignedRovers.map((rover) => (
            <div key={rover.id} className="admin-rover-access-row">
              <div><span className="admin-rover-dot" /><strong>{rover.name}</strong></div>
              <Switch checked onChange={() => onToggleRover(account.id, rover.id)} label={`Remove ${rover.name} from ${account.username}`} />
            </div>
          ))}
          {!assignedRovers.length && (
            <div className="admin-rover-access-empty">No rover assigned to this account.</div>
          )}
        </div>
      </div>

      <div className="admin-detail-section admin-detail-section--permissions">
        <button
          type="button"
          className="admin-detail-heading admin-detail-heading--collapsible"
          aria-expanded={permissionsOpen}
          onClick={() => setPermissionsOpen((open) => !open)}
        >
          <div><span>Permissions</span><small>{isCurrentAdmin ? 'Admin permissions are always enabled' : 'Changes apply to active access'}</small></div>
          <span className="admin-detail-heading__meta">
            <strong>{account.permissions.length}/{PERMISSION_OPTIONS.length}</strong>
            <span className={`admin-chevron ${permissionsOpen ? 'is-open' : ''}`} aria-hidden="true">⌄</span>
          </span>
        </button>
        <div className={`admin-collapse-content ${permissionsOpen ? 'is-open' : ''}`}>
          <div className="admin-collapse-content__inner">
            <div className="admin-permission-list">
              {PERMISSION_OPTIONS.map((permission) => {
                const enabled = account.permissions.includes(permission.key);
                return (
                  <div key={permission.key} className="admin-permission-row">
                    <div><strong>{permission.label}</strong><small>{permission.description}</small></div>
                    <Switch
                      checked={enabled}
                      onChange={() => onTogglePermission(account.id, permission.key)}
                      disabled={isCurrentAdmin}
                      label={isCurrentAdmin
                        ? `${permission.label} is always enabled for the admin account`
                        : `Toggle ${permission.label} for ${account.username}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="admin-account-actions">
        <button
          type="button"
          className="admin-secondary-button"
          onClick={() => onToggleEnabled(account.id)}
          disabled={isCurrentAdmin}
          title={isCurrentAdmin ? 'The current demo admin cannot disable itself.' : undefined}
        >
          {account.enabled ? 'Disable account' : 'Enable account'}
        </button>
        <button
          type="button"
          className="admin-secondary-button"
          onClick={() => onForceLogout(account.id)}
          disabled={!accountSessions.length || isCurrentAdmin}
          title={isCurrentAdmin ? 'Use the navbar to log out of the current session.' : undefined}
        >
          Force logout
        </button>
        <button
          type="button"
          className="admin-danger-button"
          onClick={() => onDelete(account.id)}
          disabled={isCurrentAdmin}
        >
          Delete account
        </button>
      </div>
    </div>
  );
}

export default function AdminView() {
  const [adminState, setAdminState] = useState(readAdminDemoState);
  const [activeSection, setActiveSection] = useState('accounts');
  const [selectedAccountId, setSelectedAccountId] = useState('account-admin');
  const [accountSearch, setAccountSearch] = useState('');

  const { accounts, sessions, loginRequests, activity } = adminState;

  useEffect(() => {
    try {
      window.localStorage.setItem(ADMIN_DEMO_STORAGE_KEY, JSON.stringify(adminState));
    } catch (error) {
      // Keep the admin preview usable even when localStorage is unavailable.
    }
  }, [adminState]);

  const appendActivity = (entry) => {
    const nextActivity = {
      id: makeId('activity'),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    return (current) => [nextActivity, ...current].slice(0, 80);
  };

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) || accounts[0] || null;

  useEffect(() => {
    if (selectedAccountId && accounts.some((account) => account.id === selectedAccountId)) return;
    setSelectedAccountId(accounts[0]?.id || null);
  }, [accounts, selectedAccountId]);

  const filteredAccounts = useMemo(() => {
    const query = accountSearch.trim().toLowerCase();
    if (!query) return accounts;
    return accounts.filter((account) => {
      const rovers = account.roverIds.map((id) => ROVERS.find((rover) => rover.id === id)?.name || id).join(' ');
      return `${account.username} ${getAccountRole(account)} ${rovers}`.toLowerCase().includes(query);
    });
  }, [accountSearch, accounts]);

  const pendingRequests = loginRequests.filter((request) => request.status === 'pending');
  const enabledAccounts = accounts.filter((account) => account.enabled);
  const adminAccounts = accounts.filter((account) => account.permissions.includes(PERMISSIONS.ACCESS_ADMIN));

  const togglePermission = (accountId, permissionKey) => {
    setAdminState((current) => {
      const account = current.accounts.find((item) => item.id === accountId);
      if (!account || account.id === 'account-admin') return current;
      const enabled = account.permissions.includes(permissionKey);
      const updatedPermissions = enabled
        ? account.permissions.filter((key) => key !== permissionKey)
        : [...account.permissions, permissionKey];

      return {
        ...current,
        accounts: current.accounts.map((item) => item.id === accountId ? { ...item, permissions: updatedPermissions } : item),
        activity: appendActivity({
          type: 'permission',
          title: enabled ? 'Permission revoked' : 'Permission granted',
          detail: `${account.username} · ${getPermissionLabel(permissionKey)}`,
        })(current.activity),
      };
    });
  };

  const toggleRover = (accountId, roverId) => {
    setAdminState((current) => {
      const account = current.accounts.find((item) => item.id === accountId);
      if (!account) return current;
      const assigned = account.roverIds.includes(roverId);
      const updatedRovers = assigned
        ? account.roverIds.filter((id) => id !== roverId)
        : [...account.roverIds, roverId];
      const rover = ROVERS.find((item) => item.id === roverId);

      return {
        ...current,
        accounts: current.accounts.map((item) => item.id === accountId ? { ...item, roverIds: updatedRovers } : item),
        activity: appendActivity({
          type: 'rover',
          title: assigned ? 'Rover access removed' : 'Rover access assigned',
          detail: `${account.username} · ${rover?.name || roverId}`,
        })(current.activity),
      };
    });
  };

  const toggleEnabled = (accountId) => {
    setAdminState((current) => {
      const account = current.accounts.find((item) => item.id === accountId);
      if (!account) return current;
      const nextEnabled = !account.enabled;
      return {
        ...current,
        accounts: current.accounts.map((item) => item.id === accountId ? { ...item, enabled: nextEnabled } : item),
        sessions: nextEnabled ? current.sessions : current.sessions.filter((session) => session.accountId !== accountId),
        activity: appendActivity({
          type: 'account',
          title: nextEnabled ? 'Account enabled' : 'Account disabled',
          detail: account.username,
        })(current.activity),
      };
    });
  };

  const deleteAccount = (accountId) => {
    const account = accounts.find((item) => item.id === accountId);
    if (!account) return;
    if (!window.confirm(`Delete ${account.username}? This action is intended to be permanent.`)) return;

    setAdminState((current) => ({
      ...current,
      accounts: current.accounts.filter((item) => item.id !== accountId),
      sessions: current.sessions.filter((session) => session.accountId !== accountId),
      loginRequests: current.loginRequests.filter((request) => request.accountId !== accountId),
      activity: appendActivity({ type: 'account', title: 'Account deleted', detail: account.username })(current.activity),
    }));
  };

  const forceLogout = (accountId) => {
    const account = accounts.find((item) => item.id === accountId);
    if (!account) return;
    setAdminState((current) => ({
      ...current,
      sessions: current.sessions.filter((session) => session.accountId !== accountId),
      activity: appendActivity({ type: 'session', title: 'Session revoked by admin', detail: account.username })(current.activity),
    }));
  };

  const rejectRequest = (requestId) => {
    const request = loginRequests.find((item) => item.id === requestId);
    const account = accounts.find((item) => item.id === request?.accountId);
    if (!request || !account) return;
    setAdminState((current) => ({
      ...current,
      loginRequests: current.loginRequests.map((item) => item.id === requestId ? { ...item, status: 'rejected' } : item),
      activity: appendActivity({ type: 'login-request', title: 'Concurrent login rejected', detail: `${account.username} · ${request.device}` })(current.activity),
    }));
  };

  const approveRequest = (requestId) => {
    const request = loginRequests.find((item) => item.id === requestId);
    const account = accounts.find((item) => item.id === request?.accountId);
    if (!request || !account) return;
    const newSession = {
      id: makeId('session'),
      accountId: account.id,
      device: request.device,
      address: request.address,
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      current: false,
    };

    setAdminState((current) => ({
      ...current,
      sessions: [...current.sessions.filter((session) => session.accountId !== account.id), newSession],
      loginRequests: current.loginRequests.map((item) => item.id === requestId ? { ...item, status: 'approved' } : item),
      activity: appendActivity({ type: 'login-request', title: 'New login approved · previous session revoked', detail: `${account.username} · ${request.device}` })(current.activity),
    }));
  };


  return (
    <main className="dashboard view active-view admin-page" id="admin-view">
      <section className="admin-hero page-section">
        <div className="page-inner admin-hero__inner">
          <div className="admin-hero__copy">
            <h1>Admin control</h1>
          </div>
        </div>
      </section>

      <section className="admin-workspace page-section">
        <div className="page-inner">
          <div className="admin-summary-grid" aria-label="Admin account summary">
            <article><span>Accounts</span><strong>{accounts.length.toString().padStart(2, '0')}</strong><small>{enabledAccounts.length} enabled</small></article>
            <article><span>Active sessions</span><strong>{sessions.length.toString().padStart(2, '0')}</strong><small>Revocable instantly</small></article>
            <article className={pendingRequests.length ? 'has-attention' : ''}><span>Login requests</span><strong>{pendingRequests.length.toString().padStart(2, '0')}</strong><small>{pendingRequests.length ? 'Waiting for decision' : 'No conflicts'}</small></article>
            <article><span>Administrators</span><strong>{adminAccounts.length.toString().padStart(2, '0')}</strong><small>Admin-capable accounts</small></article>
          </div>

          <div className="admin-toolbar">
            <div className="admin-tabs" role="tablist" aria-label="Admin sections">
              {[
                ['accounts', 'Accounts', accounts.length],
                ['requests', 'Login requests', pendingRequests.length],
                ['sessions', 'Active sessions', sessions.length],
                ['activity', 'Activity', activity.length],
              ].map(([id, label, count]) => (
                <button key={id} type="button" role="tab" aria-selected={activeSection === id} className={activeSection === id ? 'active' : ''} onClick={() => setActiveSection(id)}>
                  <span>{label}</span><strong>{count}</strong>
                </button>
              ))}
            </div>
          </div>

          {activeSection === 'accounts' && (
            <div className="admin-accounts-surface">
              <section className="admin-list-panel" aria-labelledby="accounts-heading">
                <div className="admin-list-panel__header">
                  <div><span className="admin-panel-eyebrow">Directory</span><h2 id="accounts-heading">All accounts</h2></div>
                  <label className="admin-search"><span aria-hidden="true">⌕</span><input value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Search accounts" aria-label="Search accounts" /></label>
                </div>
                <div className="admin-account-list">
                  {filteredAccounts.map((account) => {
                    const accountSessions = sessions.filter((session) => session.accountId === account.id).length;
                    const roverNames = account.roverIds.map((id) => ROVERS.find((rover) => rover.id === id)?.name || id);
                    return (
                      <button key={account.id} type="button" className={`admin-account-row ${selectedAccount?.id === account.id ? 'is-selected' : ''}`} onClick={() => setSelectedAccountId(account.id)}>
                        <span className="admin-account-row__avatar">{account.username.slice(0, 2).toUpperCase()}</span>
                        <span className="admin-account-row__main"><strong>{account.username}</strong><small>{roverNames.join(', ') || 'No rover assigned'} · {account.permissions.length} permissions</small></span>
                        <span className="admin-account-row__status">
                          <StatusPill tone={account.enabled ? (accountSessions ? 'online' : 'neutral') : 'disabled'}>{account.enabled ? (accountSessions ? 'Online' : 'Enabled') : 'Disabled'}</StatusPill>
                          <small>{getAccountRole(account)}</small>
                        </span>
                      </button>
                    );
                  })}
                  {!filteredAccounts.length && <div className="admin-empty-state"><strong>No accounts found</strong><span>Try a different search.</span></div>}
                </div>
              </section>

              {selectedAccount && (
                <AccountDetail
                  account={selectedAccount}
                  sessions={sessions}
                  onTogglePermission={togglePermission}
                  onToggleRover={toggleRover}
                  onToggleEnabled={toggleEnabled}
                  onDelete={deleteAccount}
                  onForceLogout={forceLogout}
                />
              )}
            </div>
          )}

          {activeSection === 'requests' && (
            <section className="admin-table-panel" aria-labelledby="requests-heading">
              <div className="admin-section-heading"><div><span className="admin-panel-eyebrow">Concurrent access</span><h2 id="requests-heading">Login requests</h2></div><p>A new device cannot take over an occupied account until an admin decides.</p></div>
              <div className="admin-request-list">
                {pendingRequests.map((request) => {
                  const account = accounts.find((item) => item.id === request.accountId);
                  const existingSession = sessions.find((session) => session.accountId === request.accountId);
                  return (
                    <article key={request.id} className="admin-request-card">
                      <div className="admin-request-card__head">
                        <div><span className="admin-attention-dot" /><div><strong>{account?.username || 'Unknown account'}</strong><small>{request.attempts} login attempt{request.attempts === 1 ? '' : 's'} · {formatDateTime(request.attemptedAt)}</small></div></div>
                        <StatusPill tone="warning">Approval required</StatusPill>
                      </div>
                      <div className="admin-session-compare">
                        <div><span>Current session</span><strong>{existingSession?.device || 'No active device'}</strong><small>{existingSession ? `${existingSession.address} · started ${formatDateTime(existingSession.startedAt)}` : 'Session record unavailable'}</small></div>
                        <span className="admin-session-arrow" aria-hidden="true">→</span>
                        <div className="is-new"><span>New login</span><strong>{request.device}</strong><small>{request.address} · attempted {formatDateTime(request.attemptedAt)}</small></div>
                      </div>
                      <div className="admin-request-actions">
                        <button type="button" className="admin-secondary-button" onClick={() => rejectRequest(request.id)}>Reject</button>
                        <button type="button" className="admin-primary-button" onClick={() => approveRequest(request.id)}>Allow &amp; log out current</button>
                      </div>
                    </article>
                  );
                })}
                {!pendingRequests.length && <div className="admin-empty-state admin-empty-state--large"><span className="admin-empty-state__icon">✓</span><strong>No login conflicts</strong><span>New concurrent login requests will appear here for approval.</span></div>}
              </div>
            </section>
          )}

          {activeSection === 'sessions' && (
            <section className="admin-table-panel" aria-labelledby="sessions-heading">
              <div className="admin-section-heading"><div><span className="admin-panel-eyebrow">Session control</span><h2 id="sessions-heading">Active sessions</h2></div><p>Revoking a backend session should return that operator to the login screen immediately.</p></div>
              <div className="admin-data-table admin-sessions-table">
                <div className="admin-data-table__header"><span>Account</span><span>Device</span><span>Started</span><span>Last activity</span><span>Action</span></div>
                {sessions.map((session) => {
                  const account = accounts.find((item) => item.id === session.accountId);
                  return (
                    <div key={session.id} className="admin-data-table__row">
                      <span><strong>{account?.username || 'Unknown'}</strong><small>{session.current ? 'Current admin session' : getAccountRole(account || { permissions: [] })}</small></span>
                      <span><strong>{session.device}</strong><small>{session.address}</small></span>
                      <span>{formatDateTime(session.startedAt)}</span>
                      <span>{formatDateTime(session.lastActivity)}</span>
                      <span><button type="button" className="admin-row-action" disabled={session.current} onClick={() => forceLogout(session.accountId)}>{session.current ? 'Current' : 'Force logout'}</button></span>
                    </div>
                  );
                })}
                {!sessions.length && <div className="admin-empty-state admin-empty-state--large admin-table-empty"><strong>No active sessions</strong><span>Backend session records will appear here.</span></div>}
              </div>
            </section>
          )}

          {activeSection === 'activity' && (
            <section className="admin-table-panel" aria-labelledby="activity-heading">
              <div className="admin-section-heading"><div><span className="admin-panel-eyebrow">Audit surface</span><h2 id="activity-heading">Activity</h2></div></div>
              <div className="admin-activity-list">
                {activity.map((item, index) => (
                  <article key={item.id} className="admin-activity-row">
                    <span className={`admin-activity-marker admin-activity-marker--${item.type}`} />
                    <span className="admin-activity-index">{String(index + 1).padStart(2, '0')}</span>
                    <div><strong>{item.title}</strong><small>{item.detail}</small></div>
                    <time dateTime={item.timestamp}>{formatDateTime(item.timestamp)}</time>
                  </article>
                ))}
                {!activity.length && <div className="admin-empty-state admin-empty-state--large"><strong>No activity yet</strong><span>Backend audit events will appear here.</span></div>}
              </div>
            </section>
          )}
        </div>
      </section>

      <footer className="site-footer site-footer--light">
        <span>NOKIA · 5G SOS ROVER</span>
        <span>SÂNZI CONTROL INTERFACE / ADMIN / 2026</span>
      </footer>

    </main>
  );
}
