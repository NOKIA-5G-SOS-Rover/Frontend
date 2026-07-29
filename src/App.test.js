import { fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';

jest.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="alert-history-chart" aria-label="Alert history chart" />,
}));

test('renders the rover overview and live event feed', () => {
  render(<App />);

  expect(screen.getAllByText(/Sânzi/i).length).toBeGreaterThan(0);
  expect(screen.getByRole('heading', { name: /live event feed/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /simulate sos/i })).toBeInTheDocument();
  expect(screen.getByTestId('alert-history-chart')).toBeInTheDocument();
});

test('opens the camera operations page with its controls intact', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /^cameras$/i }));

  expect(screen.getByRole('heading', { name: /cameras & drive control/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^auto$/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^manual$/i })).toBeInTheDocument();
  const manualButton = screen.getByRole('button', { name: /^manual$/i });
  fireEvent.click(manualButton);
  fireEvent.click(screen.getByRole('button', { name: /increase speed/i }));
  expect(screen.getByRole('button', { name: /current speed 60 percent/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /move rover forward/i })).toBeEnabled();
  expect(screen.getByRole('button', { name: /move rover backward/i })).toBeEnabled();
  expect(screen.queryByRole('button', { name: /^stop$/i })).not.toBeInTheDocument();
});


test('allows direct percentage speed entry and clamps values at 100', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /^cameras$/i }));
  fireEvent.click(screen.getByRole('button', { name: /^manual$/i }));

  const speedValue = screen.getByRole('button', { name: /current speed 50 percent/i });
  fireEvent.doubleClick(speedValue);

  const speedInput = screen.getByRole('spinbutton', { name: /set rover speed percentage/i });
  fireEvent.change(speedInput, { target: { value: '145' } });
  fireEvent.keyDown(speedInput, { key: 'Enter' });

  expect(screen.getByRole('button', { name: /current speed 100 percent/i })).toBeInTheDocument();
});

test('opens the focused past-alert archive with filters and event details', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /past alerts/i }));

  expect(screen.getByRole('heading', { name: /^past alerts$/i })).toBeInTheDocument();
  const filterButton = screen.getByRole('button', { name: /filter archive/i });
  fireEvent.click(filterButton);
  expect(screen.getByRole('checkbox', { name: /has confidence/i })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: /has location/i })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /month/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: /has confidence/i }));
  expect(screen.getByRole('checkbox', { name: /has confidence/i })).toBeChecked();
});

test('keeps the event verification workflow interactive', () => {
  render(<App />);
  const statusGroup = screen.getByLabelText(/verification status for possible person detected/i);
  const confirmedButton = within(statusGroup).getByRole('button', { name: /confirmed threat/i });
  fireEvent.click(confirmedButton);
  expect(confirmedButton).toHaveAttribute('aria-pressed', 'true');
});
