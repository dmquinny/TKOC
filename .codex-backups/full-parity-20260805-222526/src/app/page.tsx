"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import FeedbackNotice from '@/components/FeedbackNotice';

export default function Home() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin ? { username, password } : { username, email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      if (isLogin) {
        if (data.pID === 0 || !data.pID) {
          router.push('/province/create');
        } else {
          router.push('/dashboard');
        }
      } else {
        // On successful registration, switch to login
        setIsLogin(true);
        setError('Registration successful! Please sign in.');
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message);
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
          
          {error && (
            <FeedbackNotice tone={error.includes('successful') ? 'success' : 'error'}>
              {error}
            </FeedbackNotice>
          )}

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="username">Ruler Name</label>
              <input 
                type="text" 
                id="username" 
                placeholder="Lord Commander" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Summoning...' : (isLogin ? 'Sign In' : 'Create Empire')}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              {isLogin ? "Don't have an empire? " : "Already rule an empire? "}
              <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(!isLogin); setError(''); }}>
                {isLogin ? 'Create a Province' : 'Sign In'}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
