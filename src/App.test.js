import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

jest.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="alert-history-chart" aria-label="Alert history chart" />,
}));

const loginAsOperator = async () => {
  fireEvent.change(screen.getByPlaceholderText(/enter user/i), {
    target: { value: 'operator' },
  });
  fireEvent.change(screen.getByPlaceholderText(/enter password/i), {
    target: { value: 'sanzi2026' },
  });
  fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
  });
};

beforeEach(() => {
  window.sessionStorage.clear();
});

test('blocks the control interface until the operator signs in', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: /^sign in$/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /cameras/i })).not.toBeInTheDocument();
});

test('shows a clear error for incorrect credentials', async () => {
  render(<App />);

  fireEvent.change(screen.getByPlaceholderText(/enter user/i), {
    target: { value: 'operator' },
  });
  fireEvent.change(screen.getByPlaceholderText(/enter password/i), {
    target: { value: 'wrong-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect user or password/i);
});

test('renders the original overview after login', async () => {
  render(<App />);
  await loginAsOperator();

  expect(screen.getAllByText(/Sânzi/i).length).toBeGreaterThan(0);
  expect(screen.getByRole('heading', { name: /live event feed/i })).toBeInTheDocument();
  expect(screen.getByTestId('alert-history-chart')).toBeInTheDocument();
});

test('keeps the original camera page and controls accessible after login', async () => {
  render(<App />);
  await loginAsOperator();

  fireEvent.click(screen.getByRole('link', { name: /^cameras$/i }));

  expect(screen.getByRole('heading', { name: /cameras & drive control/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^auto$/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^manual$/i })).toBeInTheDocument();
});

test('keeps the original past alerts page accessible after login', async () => {
  render(<App />);
  await loginAsOperator();

  fireEvent.click(screen.getByRole('link', { name: /past alerts/i }));

  expect(screen.getByRole('heading', { name: /^past alerts$/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /filter archive/i })).toBeInTheDocument();
});


test('logs the operator out and blocks the interface again', async () => {
  render(<App />);
  await loginAsOperator();

  fireEvent.click(screen.getByRole('button', { name: /log out/i }));

  expect(screen.getByRole('heading', { name: /^sign in$/i })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /^cameras$/i })).not.toBeInTheDocument();
  expect(window.sessionStorage.getItem('sanzi-operator-session-v2')).toBeNull();
});

test('keeps the stream at 12, treats human detections as critical, and counts unreviewed alarms', async () => {
  const originalFetch = global.fetch;
  const now = Date.now();
  const backendEvents = Array.from({ length: 13 }, (_, index) => ({
    id: `backend-human-${index}`,
    alertType: 'HumanDetected',
    source: 'Camera 2',
    confidenceScore: 0.9,
    locationX: index,
    locationY: index + 1,
    timestamp: new Date(now - index * 1000).toISOString(),
    status: 'unverified',
    imageUrl: '/detections/person-detected.svg',
  }));

  global.fetch = jest.fn(async (url, options = {}) => {
    if (String(url).endsWith('/events') && (!options.method || options.method === 'GET')) {
      return {
        ok: true,
        json: async () => backendEvents,
      };
    }

    return { ok: true, json: async () => ({}) };
  });

  try {
    render(<App />);
    await loginAsOperator();

    await waitFor(() => {
      expect(screen.getByText('0 of 12 reviewed')).toBeInTheDocument();
    });

    expect(screen.getByText('Events in stream').nextSibling).toHaveTextContent('12');
    expect(screen.getByText('Critical').nextSibling).toHaveTextContent('12');
    expect(screen.getByText('Awaiting review').nextSibling).toHaveTextContent('12');
    expect(screen.getAllByText('90% confidence').length).toBeGreaterThan(0);
    expect(screen.getAllByText('critical').length).toBeGreaterThan(0);
  } finally {
    global.fetch = originalFetch;
  }
});
