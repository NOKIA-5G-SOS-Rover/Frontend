import { fireEvent, render, screen, within } from '@testing-library/react';
import AdminView from './AdminView';
import { ALL_PERMISSIONS } from '../auth/permissions';

beforeEach(() => {
  window.localStorage.clear();
});

test('starts with only the admin account and no hardcoded session or login data', () => {
  render(<AdminView currentUser={{ username: 'admin', permissions: ALL_PERMISSIONS }} />);

  expect(screen.getByRole('heading', { name: /admin control/i })).toBeInTheDocument();
  expect(screen.getAllByText('admin').length).toBeGreaterThan(0);
  expect(screen.queryByText('field.operator')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: /login requests/i }));
  expect(screen.getByText(/no login conflicts/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: /active sessions/i }));
  expect(screen.getByText(/no active sessions/i)).toBeInTheDocument();
});

test('opens account creation with rover and permission assignment', () => {
  render(<AdminView currentUser={{ username: 'admin', permissions: ALL_PERMISSIONS }} />);

  fireEvent.click(screen.getByRole('button', { name: /create account/i }));

  const dialog = screen.getByRole('dialog', { name: /create account/i });
  expect(dialog).toBeInTheDocument();
  expect(within(dialog).getByText('Sânzi')).toBeInTheDocument();
  expect(within(dialog).getByRole('switch', { name: /toggle access admin functions/i })).toBeInTheDocument();
});
