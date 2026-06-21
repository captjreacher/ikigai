import { useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AssessmentWizard } from './components/wizard/AssessmentWizard';
import { ReportPage } from './components/report/ReportPage';
import { CockpitLayout } from './components/cockpit/CockpitLayout';
import { CreatorPipeline } from './components/cockpit/CreatorPipeline';
import { CreatorProfileView } from './components/cockpit/CreatorProfileView';
import { AgencyDashboard } from './components/cockpit/AgencyDashboard';
import { AuthGate } from './components/cockpit/AuthGate';
import { AssessmentTemplates } from './components/cockpit/AssessmentTemplates';
import {
  consumeAuthRedirectPath,
  getStoredAuthRedirectPath,
  supabase,
} from './lib/supabase';
import type { EmailOtpType } from '@supabase/supabase-js';

function routeWithSearch(pathname: string, search: string) {
  return `${pathname}${search}`;
}

function AuthSessionBridge() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const routeParams = new URLSearchParams(location.search);
    const rawHash = window.location.hash;
    const hasAuthParams = routeParams.has('code') || routeParams.has('token_hash');
    const hasRawAuthFragment = /(?:access_token|refresh_token|error_code)=/.test(rawHash);
    const hasStoredRedirect = Boolean(getStoredAuthRedirectPath());
    const shouldHandleAuthRedirect = hasAuthParams || hasRawAuthFragment || hasStoredRedirect;
    const currentRoute = hasAuthParams
      ? location.pathname
      : routeWithSearch(location.pathname, location.search);
    const destination = getStoredAuthRedirectPath()
      ?? (location.pathname.startsWith('/cockpit') ? currentRoute : '/cockpit');

    const finishAuthRedirect = () => {
      const next = consumeAuthRedirectPath() ?? destination;
      navigate(next, { replace: true });
    };

    const exchangeAuthParams = async () => {
      const code = routeParams.get('code');
      const tokenHash = routeParams.get('token_hash');
      const type = routeParams.get('type') as EmailOtpType | null;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && mounted) finishAuthRedirect();
        return;
      }

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (!error && mounted) finishAuthRedirect();
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session && shouldHandleAuthRedirect && mounted) {
        finishAuthRedirect();
      }
    };

    void exchangeAuthParams();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' && shouldHandleAuthRedirect && mounted) {
        finishAuthRedirect();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [location.pathname, location.search, navigate]);

  return null;
}

export default function App() {
  return (
    <HashRouter>
      <AuthSessionBridge />
      <Routes>
        {/* Public */}
        <Route path="/" element={<AssessmentWizard />} />
        <Route path="/report/:slug" element={<ReportPage />} />

        {/* Cockpit (authenticated) */}
        <Route path="/cockpit" element={<AuthGate><CockpitLayout /></AuthGate>}>
          <Route index element={<AgencyDashboard />} />
          <Route path="creators" element={<CreatorPipeline />} />
          <Route path="creators/:profileId" element={<CreatorProfileView />} />
          <Route path="settings/assessment-templates" element={<AssessmentTemplates />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
