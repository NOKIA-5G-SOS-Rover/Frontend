import { fireEvent, render, screen } from '@testing-library/react';
import LiveEventFeed from './LiveEventFeed';

const criticalEventWithoutBackendImage = {
  id: 'critical-without-image',
  type: 'person_detected',
  title: 'Possible person detected',
  description: 'A critical detection requires operator review.',
  severity: 'critical',
  cameraId: 'Camera 2',
  location: 'Sector A',
  confidence: 96,
  timestamp: '2026-08-05T10:00:00.000Z',
  verificationStatus: 'unverified',
  imageUrl: null,
};

test('opens the detected-frame modal for a critical alarm without a backend image URL', () => {
  render(
    <LiveEventFeed
      events={[criticalEventWithoutBackendImage]}
      onStatusChange={jest.fn()}
    />
  );

  fireEvent.click(
    screen.getByLabelText(/inspect detected frame: possible person detected/i)
  );

  expect(screen.getByRole('dialog', { name: /possible person detected/i })).toBeInTheDocument();
  expect(screen.getByAltText(/detected frame for possible person detected/i)).toHaveAttribute(
    'src',
    '/detections/person-detected.svg'
  );
  expect(screen.getByText(/operator assessment/i)).toBeInTheDocument();
});


test('defensively renders only the latest 12 events', () => {
  const events = Array.from({ length: 15 }, (_, index) => ({
    ...criticalEventWithoutBackendImage,
    id: `critical-${index}`,
    title: `Human detected ${index}`,
  }));

  const { container } = render(
    <LiveEventFeed
      events={events}
      onStatusChange={jest.fn()}
    />
  );

  expect(container.querySelectorAll('.live-event-item')).toHaveLength(12);
  expect(screen.getByRole('heading', { name: 'Live event feed' })).toBeInTheDocument();
});
