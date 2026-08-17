import {
  formatAlertTitle,
  inferEventSeverity,
  normalizeConfidence,
  normalizeReviewStatus,
} from './eventNormalization';

test('converts backend confidence from 0-1 into 0-100 percentages', () => {
  expect(normalizeConfidence(0.96)).toBe(96);
  expect(normalizeConfidence(0.735)).toBe(73.5);
  expect(normalizeConfidence(96)).toBe(96);
});

test('treats human detections as critical even when status is an operator-review status', () => {
  expect(inferEventSeverity({ alertType: 'HumanDetected', status: 'unverified' })).toBe('critical');
  expect(formatAlertTitle('HumanDetected')).toBe('Human detected');
});

test('uses backend status as review state and defaults detections to unverified', () => {
  expect(normalizeReviewStatus({ status: 'confirmed-threat' })).toBe('confirmed-threat');
  expect(normalizeReviewStatus({ status: 'critical' })).toBe('unverified');
  expect(normalizeReviewStatus({})).toBe('unverified');
});
