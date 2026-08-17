import { fireEvent, render, screen } from '@testing-library/react';
import HomeView from './HomeView';

jest.mock('react-chartjs-2', () => ({
  Bar: ({ data, options }) => (
    <div data-testid="alert-history-chart">
      {data.labels.map((label, index) => (
        <button
          type="button"
          key={`${label}-${index}`}
          data-testid={`chart-bar-${index}`}
          onClick={() => options.onClick({}, [{ index }])}
        >
          {label}:{data.datasets[0].data[index]}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('./AmbientSignalField', () => () => <div data-testid="ambient-signal" />);

const makeEvent = ({ id, daysAgo = 0, status = 'unverified', severity = 'warning', hour = 12 }) => {
  const timestamp = new Date();
  timestamp.setDate(timestamp.getDate() - daysAgo);
  timestamp.setHours(hour, 0, 0, 0);

  return {
    id,
    sourceId: id,
    title: `Alarm ${id}`,
    description: 'Backend alarm',
    severity,
    confidence: 90,
    timestamp: timestamp.toISOString(),
    verificationStatus: status,
    imageUrl: '/detections/person-detected.svg',
  };
};

test('shows only the 12-event stream review summary and uses actual alerts in the 7-day chart drilldown', () => {
  const liveEvents = Array.from({ length: 12 }, (_, index) => makeEvent({
    id: `live-${index}`,
    status: 'unverified',
    severity: index < 3 ? 'critical' : 'warning',
  }));

  const chartAlert = makeEvent({ id: 'actual-today-alert', hour: 9, severity: 'critical' });
  const olderAlert = makeEvent({ id: 'older-than-seven-days', daysAgo: 10 });
  const allEvents = [chartAlert, olderAlert, ...liveEvents];
  const openPastAlert = jest.fn();

  render(
    <HomeView
      activeCriticalAlert={null}
      closeAlert={jest.fn()}
      onAlertClick={jest.fn()}
      onOpenPastAlert={openPastAlert}
      onExploreRover={jest.fn()}
      liveEvents={liveEvents}
      allEvents={allEvents}
      onUpdateEventStatus={jest.fn()}
      connection={null}
    />
  );

  expect(screen.getByText('Events in stream').nextSibling).toHaveTextContent('12');
  expect(screen.getByText('Awaiting review').nextSibling).toHaveTextContent('12');
  expect(screen.getByText('0 of 12 reviewed')).toBeInTheDocument();

  fireEvent.click(screen.getByTestId('chart-bar-6'));

  expect(screen.getByText('Alarm actual-today-alert')).toBeInTheDocument();
  expect(screen.queryByText('Alarm older-than-seven-days')).not.toBeInTheDocument();

  fireEvent.click(screen.getByText('Alarm actual-today-alert'));
  expect(openPastAlert).toHaveBeenCalledWith('actual-today-alert');
});


test('shows rover battery and response from telemetry props instead of hardcoded values', () => {
  render(
    <HomeView
      activeCriticalAlert={null}
      closeAlert={jest.fn()}
      onAlertClick={jest.fn()}
      onOpenPastAlert={jest.fn()}
      onExploreRover={jest.fn()}
      liveEvents={[]}
      allEvents={[]}
      batteryLevel={64.2}
      responseTimeMs={27.6}
      onUpdateEventStatus={jest.fn()}
      connection={null}
    />
  );

  expect(screen.getByText('Battery').nextSibling).toHaveTextContent('64.2%');
  expect(screen.getByText('Response').nextSibling).toHaveTextContent('27.6 ms');
  expect(screen.queryByText('87%')).not.toBeInTheDocument();
  expect(screen.queryByText('18 ms')).not.toBeInTheDocument();
});
