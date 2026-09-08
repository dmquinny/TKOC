"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FeedbackNotice from '@/components/FeedbackNotice';
import { apiPost, errorMessage } from '@/lib/client/api';

export default function LoginForm() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsLoading(true);
    try {
      if (isLogin) {
        const data = await apiPost<{ pID?: number }>('/api/auth/login', { username, password });
        router.push(data.pID ? '/dashboard' : '/province/create');
        router.refresh();
      } else {
        await apiPost('/api/auth/register', { username, email, password });
        setIsLogin(true);
        setNotice('Registration successful. Please sign in.');
        setPassword('');
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="landing-container">
      <div className="hero-section">
        <div className="game-title">
          <span className="title-the">The</span>
          <h1 className="title-main">Kingdoms of Chaos</h1>
        </div>
        <p className="subtitle">Forging empires from the ashes of the old world.</p>

        <div className="auth-box">
          <h2>{isLogin ? 'Enter the Realm' : 'Forge Your Empire'}</h2>

          {error && <FeedbackNotice tone="error">{error}</FeedbackNotice>}
          {notice && <FeedbackNotice tone="success">{notice}</FeedbackNotice>}

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="username">Ruler Name</label>
              <input
                type="text"
                id="username"
                placeholder="Lord Commander"
                autoComplete="username"
                value={username}
                onChange={event => setUsername(event.target.value)}
                required
              />
            </div>

            {!isLogin && (
              <div className="input-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  placeholder="commander@empire.com"
                  autoComplete="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  required
                />
              </div>
            )}

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                placeholder="••••••••"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={password}
                onChange={event => setPassword(event.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Summoning…' : (isLogin ? 'Sign In' : 'Create Empire')}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              {isLogin ? "Don't have an empire? " : 'Already rule an empire? '}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setIsLogin(current => !current);
                  setError('');
                  setNotice('');
                }}
              >
                {isLogin ? 'Create a Province' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
