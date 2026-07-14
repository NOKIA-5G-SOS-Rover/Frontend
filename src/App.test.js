import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the rover dashboard and live event feed', () => {
  render(<App />);
  expect(screen.getByText(/Sânzi/i)).toBeInTheDocument();
  expect(screen.getByText(/live event feed/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /simulate sos/i })).toBeInTheDocument();
});
