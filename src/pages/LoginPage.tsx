import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import coresLogo from '@/assets/cores-logo.svg';

const LoginPage = () => {
  const { t } = useLanguage();
  const { login, loginSSO, authMode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingSSO, setIsSubmittingSSO] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Sign in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSSOLogin = async () => {
    setFormError('');
    setIsSubmittingSSO(true);

    try {
      await loginSSO();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'SSO sign in failed.');
    } finally {
      setIsSubmittingSSO(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardContent className="p-8">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <img src={coresLogo} alt="Cores" className="h-12" />
          </div>

          <h1 className="mb-6 text-center text-xl font-semibold text-foreground">
            {t('login.title')}
          </h1>

          {/* Microsoft SSO */}
          <button
            onClick={handleSSOLogin}
            disabled={isSubmittingSSO || isSubmitting}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#2F2F2F] px-4 py-3 text-sm font-medium text-white hover:bg-[#1a1a1a] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            {t('login.sso')}
          </button>

          {authMode === 'mock' && (
            <p className="mt-3 text-xs text-muted-foreground">
              Supabase is not configured yet. Login currently uses mock mode.
            </p>
          )}

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{t('login.or')}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t('login.email')}</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@cores.nl"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t('login.password')}</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isSubmitting || isSubmittingSSO}
              className="w-full text-white font-semibold"
              style={{ background: 'linear-gradient(135deg, #84e9e9, #84e988)' }}
            >
              {isSubmitting ? 'Signing in...' : t('login.submit')}
            </Button>

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
