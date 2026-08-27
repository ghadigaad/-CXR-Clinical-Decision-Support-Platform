import { zodResolver } from '@hookform/resolvers/zod';
import { Activity, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { ApiError } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import { AI_DISCLAIMER, DemoBanner, isDemoMode } from '../../components/safety/Disclaimers';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { LoadingState } from '../../components/ui/States';

const emailSchema = z.object({
  email: z.string().min(1, 'Enter your email address.').email('Enter a valid email address.'),
});

const codeSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^\d{6,8}$/, 'Enter the 6-digit code from your email.'),
});

type EmailValues = z.infer<typeof emailSchema>;
type CodeValues = z.infer<typeof codeSchema>;

export function LoginPage() {
  const { doctor, isLoading, requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const emailForm = useForm<EmailValues>({ resolver: zodResolver(emailSchema) });
  const codeForm = useForm<CodeValues>({ resolver: zodResolver(codeSchema) });

  if (isLoading) return <LoadingState label="Checking your session" />;
  if (doctor) return <Navigate to="/" replace />;

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  async function onSendCode(values: EmailValues) {
    setFormError(null);
    try {
      await requestOtp(values.email);
      setSentTo(values.email.trim().toLowerCase());
      codeForm.reset();
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'Could not send a code. Please check your connection and try again.',
      );
    }
  }

  async function onVerify(values: CodeValues) {
    if (!sentTo) return;
    setFormError(null);
    try {
      await verifyOtp(sentTo, values.token.trim());
      navigate(from, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'Sign-in failed. Please check the code and try again.',
      );
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-clinical-600 text-white shadow-sm">
            <Activity className="size-6" aria-hidden />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">CXR Decision Support</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in with your email. We will send a one-time code.
          </p>
        </div>

        {isDemoMode ? (
          <div className="mb-6">
            <DemoBanner />
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {sentTo ? (
            <form onSubmit={codeForm.handleSubmit(onVerify)} className="space-y-5" noValidate>
              {formError ? <Alert tone="danger">{formError}</Alert> : null}
              <Alert tone="info" title="Check your inbox">
                <p>
                  A sign-in code was sent to <strong>{sentTo}</strong>. It may take a minute, and
                  it can land in spam. Demo only — not for clinical use.
                </p>
              </Alert>
              <TextField
                label="One-time code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
                placeholder="6-digit code"
                error={codeForm.formState.errors.token?.message}
                {...codeForm.register('token')}
              />
              <Button type="submit" fullWidth size="lg" isLoading={codeForm.formState.isSubmitting}>
                Sign in
              </Button>
              <button
                type="button"
                className="w-full text-center text-sm text-clinical-700 hover:underline"
                onClick={() => {
                  setSentTo(null);
                  setFormError(null);
                }}
              >
                Use a different email
              </button>
            </form>
          ) : (
            <form onSubmit={emailForm.handleSubmit(onSendCode)} className="space-y-5" noValidate>
              {formError ? <Alert tone="danger">{formError}</Alert> : null}
              <TextField
                label="Email address"
                type="email"
                autoComplete="username"
                autoFocus
                required
                placeholder="you@example.org"
                error={emailForm.formState.errors.email?.message}
                {...emailForm.register('email')}
              />
              <Button type="submit" fullWidth size="lg" isLoading={emailForm.formState.isSubmitting}>
                Send code
              </Button>
            </form>
          )}

          <div className="mt-6 flex gap-2 border-t border-slate-100 pt-5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
            <p className="text-xs leading-relaxed text-slate-500">
              {isDemoMode
                ? 'This hosted copy is a demonstration. Do not upload real patient images.'
                : 'Access is logged. Each email only sees the patients it creates.'}
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">{AI_DISCLAIMER}</p>
      </div>
    </div>
  );
}
