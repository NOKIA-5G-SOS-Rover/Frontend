import { fireEvent, render, screen } from '@testing-library/react';
import PastAlertsView from './PastAlertsView';

test('renders a clean Event, Confidence, Location table and keeps the opened row selected', () => {
  const event = {
    id: 'human-1',
    alertType: 'HumanDetected',
    source: 'YOLOv8-Camera',
    injuryClass: 'Unknown',
    confidenceScore: 0.905,
    locationX: 28,
    locationY: 0,
    timestamp: '2026-08-10T10:00:00.000Z',
    status: 'unverified',
    imageUrl: '/detections/person-detected.svg',
  };

  render(
    <PastAlertsView
      liveEvents={[]}
      archiveEvents={[event]}
      focusedAlertId={null}
      connection={null}
    />
  );

  expect(screen.getByText('Event')).toBeInTheDocument();
  expect(screen.getByText('Confidence')).toBeInTheDocument();
  expect(screen.getByText('Location')).toBeInTheDocument();
  expect(screen.queryByText('Status')).not.toBeInTheDocument();
  expect(screen.getByText('Human detected - Detected via YOLOv8-Camera. Injury Class: Unknown')).toBeInTheDocument();
  expect(screen.getByText('90.5%')).toBeInTheDocument();
  expect(screen.getByText('X:28 Y:0')).toBeInTheDocument();
  expect(screen.queryByText(/Confidence 90\.5%/)).not.toBeInTheDocument();

  const rowButton = screen.getByRole('button', { name: /open human detected/i });
  fireEvent.click(rowButton);
  expect(rowButton.closest('li')).toHaveClass('selected');
  expect(screen.getByRole('complementary', { name: /selected alert details/i })).toBeInTheDocument();
});
