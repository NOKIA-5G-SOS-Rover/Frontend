import React, { useState } from 'react';
import AmbientSignalField from './AmbientSignalField';

const EyeIcon = ({ visible }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
    <circle cx="12" cy="12" r="2.8" />
    {visible && <path d="m4 4 16 16" />}
  </svg>
);

export default function LoginView({ onLogin, onRegister }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Enter your user and password.');
      return;
    }

    setIsSubmitting(true);
    const result = await (isRegistering ? onRegister : onLogin)({
      username: username.trim(),
      password,
    });
    setIsSubmitting(false);

    if (!result?.success) {
      setError(result?.message || 'Incorrect user or password.');
    }
  };

  return (
    <main className="login-page">
      <AmbientSignalField />

      <header className="login-header">
        <img src="/nokia-logo.png" alt="Nokia" className="login-header__logo" />
      </header>

      <section className="login-main" aria-label="Sânzi login">
        <div className="login-card">
          <div className="login-kicker">
            <span aria-hidden="true" />
            Secure access
          </div>

          <h1>{isRegistering ? 'Create account' : 'Sign in'}</h1>
          <p>{isRegistering ? 'Create an operator account for the Sânzi control interface.' : 'Access the Sânzi control interface.'}</p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label className="login-field">
              <span>User</span>
              <input
                type="text"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="Enter user"
                aria-invalid={Boolean(error)}
              />
            </label>

            <label className="login-field">
              <span>Password</span>
              <div className="login-password-control">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={isRegistering ? 'new-password' : 'current-password'}
                  placeholder="Enter password"
                  aria-invalid={Boolean(error)}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon visible={showPassword} />
                </button>
              </div>
            </label>

            {error && (
              <div className="login-error" role="alert" aria-live="polite">
                {error}
              </div>
            )}

            <button className="login-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (isRegistering ? 'Creating account…' : 'Signing in…') : (isRegistering ? 'Create account' : 'Sign in')}
            </button>
          </form>
          <button
            type="button"
            className="login-mode-toggle"
            onClick={() => {
              setIsRegistering((current) => !current);
              setError('');
            }}
          >
            {isRegistering ? 'Already have an account? Sign in' : 'Need an account? Create one'}
          </button>
        </div>
      </section>
    </main>
  );
}
