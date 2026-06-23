import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { signInWithOtp, supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

type AuthMessageKind = 'success' | 'error';
const MAGIC_LINK_SUCCESS_MESSAGE = 'Magic link sent. Check your inbox.';
const LOGIN_ERROR_MESSAGE = 'Unable to send a magic link. Check the email address or contact the site owner for access.';

export function AuthGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<AuthMessageKind | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setMessage(null);
    setMessageKind(null);

    const { error } = await signInWithOtp(email, `${location.pathname}${location.search}`);

    if (error) {
      setMessage(LOGIN_ERROR_MESSAGE);
      setMessageKind('error');
    } else {
      setMessage(MAGIC_LINK_SUCCESS_MESSAGE);
      setMessageKind('success');
    }

    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-2">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-2 p-4">
        <div className="w-full max-w-sm overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl shadow-gray-950/10">
          <div className="bg-charcoal px-6 py-5 text-center text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Find Your Vertical</p>
            <h1 className="mt-2 text-2xl font-bold">Creators Cockpit</h1>
            <p className="mt-2 text-sm text-gray-300">Agency access - sign in with email</p>
          </div>
          <div className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                name="email"
                autoComplete="email"
                spellCheck={false}
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setMessage(null);
                  setMessageKind(null);
                }}
                placeholder="you@agency.com"
                required
                className="field-control w-full px-4 py-3"
              />
              <button
                type="submit"
                disabled={sending}
                className="btn-primary w-full px-4 py-3"
              >
                {sending ? 'Sending...' : messageKind === 'success' ? 'Send Again' : 'Send Magic Link'}
              </button>
            </form>
            {message && (
              <p
                className={`mt-4 text-center text-sm ${
                  messageKind === 'error' ? 'text-red-700' : 'text-gray-600'
                }`}
                role={messageKind === 'error' ? 'alert' : 'status'}
              >
                {message}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
