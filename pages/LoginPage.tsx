import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { AuthShell } from '../components/AuthShell';
import { Mail, LockKeyhole, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface LoginPageProps {
  onSwitchToRegister: () => void;
  onSwitchToPasswordReset: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToRegister, onSwitchToPasswordReset }) => {
  const { login, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!email || !password) return setLocalError('Please enter both email and password.');
    try {
      setLoading(true);
      await login(email, password);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell eyebrow="Welcome back" title="Sign in to TutorTrack" subtitle="Pick up exactly where you left your students, classes and payment records.">
      {(localError || error) && (
        <div className="mb-5 p-3.5 bg-[#fff3f0] border border-[#f1d4cf] rounded-2xl flex items-start gap-3 text-[#a84d43]">
          <AlertCircle className="w-[18px] h-[18px] mt-0.5 shrink-0" />
          <p className="text-xs leading-5 font-medium">{localError || error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-[#5f5c6d] mb-2">Email address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#aaa6b2]" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="w-full h-12 pl-[42px] pr-4 bg-[#fbfaf7] border border-[#ddd9d1] rounded-xl outline-none text-sm text-[#302e43] placeholder:text-[#b4b0ba]" disabled={loading} autoComplete="email" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className="text-xs font-bold text-[#5f5c6d]">Password</label>
            <button type="button" onClick={onSwitchToPasswordReset} className="text-xs font-bold text-[#5a568f] hover:text-[#35326e]" disabled={loading}>Forgot password?</button>
          </div>
          <div className="relative">
            <LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#aaa6b2]" />
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" className="w-full h-12 pl-[42px] pr-11 bg-[#fbfaf7] border border-[#ddd9d1] rounded-xl outline-none text-sm text-[#302e43] placeholder:text-[#b4b0ba]" disabled={loading} autoComplete="current-password" />
            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#aaa6b2] hover:text-[#5b5783]" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}</button>
          </div>
        </div>

        <Button type="submit" size="lg" disabled={loading} className="w-full mt-2">
          {loading ? 'Signing in…' : <>Sign in <ArrowRight className="w-4 h-4" /></>}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-[#e7e3dc]"/><span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#aaa6b0]">New here?</span><div className="h-px flex-1 bg-[#e7e3dc]"/></div>

      <button type="button" onClick={onSwitchToRegister} className="w-full h-11 rounded-xl border border-[#c9c4d6] bg-white text-sm font-bold text-[#4e4a80] hover:bg-[#f5f2fa] transition-colors" disabled={loading}>Create a tutor account</button>
    </AuthShell>
  );
};
