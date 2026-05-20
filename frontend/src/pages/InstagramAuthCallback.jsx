import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import client from '../api/client';

export default function InstagramAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Connecting your Instagram account...');

  useEffect(() => {
    const connectInstagram = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error_description') || searchParams.get('error');

      if (error) {
        setStatus('error');
        setMessage(error);
        return;
      }

      if (!code || !state) {
        setStatus('error');
        setMessage('Missing Instagram authorization code.');
        return;
      }

      if (!state.startsWith('travelbot_instagram_connect:')) {
        setStatus('error');
        setMessage('This callback was not started by TravelBot Instagram connection.');
        return;
      }

      const expectedState = sessionStorage.getItem('travelbot_instagram_oauth_state');
      if (expectedState && expectedState !== state) {
        setStatus('error');
        setMessage('Instagram authorization state did not match. Please try again.');
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/auth/meta/callback`;
        await client.post('/agencies/me/instagram-connection/connect', { code, redirectUri });
        sessionStorage.removeItem('travelbot_instagram_oauth_state');
        setStatus('success');
        setMessage('Instagram connected successfully.');
        setTimeout(() => navigate('/settings'), 1400);
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to connect Instagram.');
      }
    };

    connectInstagram();
  }, [navigate, searchParams]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f5f5f5] px-4">
      <div className="w-full max-w-md rounded-[28px] border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <p className="eyebrow">Instagram</p>
        <h1 className="mt-2 text-2xl font-extrabold text-neutral-950">
          {status === 'loading' ? 'Connecting account' : status === 'success' ? 'Connected' : 'Connection failed'}
        </h1>
        <p className="mt-3 text-sm text-neutral-500">{message}</p>
        {status === 'loading' ? (
          <div className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-950" />
        ) : (
          <Link to="/settings" className="shell-button-primary mt-6 inline-flex">
            Back to Settings
          </Link>
        )}
      </div>
    </div>
  );
}
