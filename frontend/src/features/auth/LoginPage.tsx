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

const schema = z.object({
  email: z.string().min(1, 'Enter your email address.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { doctor, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (isLoading) return <LoadingState label="Checking your session" />;
  if (doctor) return <Navigate to="/" replace />;

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await login(values.email, values.password);
      // Return the clinician to wherever they were headed before the session check.
      const from = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(from, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'Sign-in failed. Please check your connection and try again.',
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
            Sign in to access AI-assisted chest X-ray analysis
          </p>
        </div>

        {isDemoMode ? (
          <div className="mb-6">
            <DemoBanner />
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {formError ? <Alert tone="danger">{formError}</Alert> : null}

            <TextField
              label="Email address"
              type="email"
              autoComplete="username"
              autoFocus
              required
              placeholder="clinician@hospital.org"
              error={errors.email?.message}
              {...register('email')}
            />

            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              error={errors.password?.message}
              {...register('password')}
            />

            <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
              Sign in
            </Button>
          </form>

          <div className="mt-6 flex gap-2 border-t border-slate-100 pt-5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
            <p className="text-xs leading-relaxed text-slate-500">
              {isDemoMode
                ? 'This hosted copy is a demonstration. Do not upload real patient images.'
                : 'This system processes protected health information. Access is logged and restricted to authorized clinicians.'}
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">{AI_DISCLAIMER}</p>
      </div>
    </div>
  );
}
