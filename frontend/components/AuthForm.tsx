'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { ErrorBox } from './States';

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const isLogin = mode === 'login';

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      if (isLogin) await login(String(f.get('email')), String(f.get('password')));
      else await register(String(f.get('name')), String(f.get('email')), String(f.get('password')));
      router.push('/');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.code === 'VALIDATION_ERROR') setFieldErrors(err.details as Record<string, string[]>);
      } else setError('Could not reach the server');
      setBusy(false);
    }
  }

  const field = (name: string, label: string, type = 'text', extra = {}) => (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} type={type} required className="input" aria-invalid={!!fieldErrors[name]} aria-describedby={fieldErrors[name] ? `${name}-err` : undefined} {...extra} />
      {fieldErrors[name] && <p id={`${name}-err`} className="mt-1 text-xs text-red-600">{fieldErrors[name].join(', ')}</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={submit} className="card space-y-4 p-6" noValidate>
        <h1 className="text-2xl font-bold">{isLogin ? 'Log in' : 'Create your account'}</h1>
        {error && <ErrorBox message={error} />}
        {!isLogin && field('name', 'Full name', 'text', { autoComplete: 'name' })}
        {field('email', 'Email', 'email', { autoComplete: 'email' })}
        {field('password', 'Password', 'password', { autoComplete: isLogin ? 'current-password' : 'new-password', minLength: isLogin ? undefined : 8 })}
        {!isLogin && <p className="text-xs text-slate-500">At least 8 characters.</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : isLogin ? 'Log in' : 'Sign up'}</button>
        <p className="text-center text-sm text-slate-500">
          {isLogin ? (<>New here? <Link className="font-semibold text-indigo-600" href="/register">Create an account</Link></>)
                   : (<>Already registered? <Link className="font-semibold text-indigo-600" href="/login">Log in</Link></>)}
        </p>
      </form>
    </div>
  );
}
