import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { AuthShell } from '../components/AuthShell';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Send } from 'lucide-react';

interface PasswordResetPageProps { onSwitchToLogin: () => void; }

export const PasswordResetPage: React.FC<PasswordResetPageProps> = ({ onSwitchToLogin }) => {
  const { resetPassword, error } = useAuth();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!email) return setLocalError('Please enter your email address.');
    try {
      setLoading(true);
      await resetPassword(email);
      setSentTo(email);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to send reset email');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell eyebrow="Account recovery" title="Reset your password" subtitle="Enter the email connected to TutorTrack and we’ll send the recovery link there.">
      {sentTo ? (
        <div className="text-center py-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-[#edf7f1] text-[#37815c] grid place-items-center"><CheckCircle2 className="w-6 h-6" /></div>
          <h3 className="mt-4 font-extrabold text-[#2e2c43]">Check your inbox</h3>
          <p className="mt-2 text-sm leading-6 text-[#7d7988]">A reset link was sent to <span className="font-semibold text-[#4d496a]">{sentTo}</span>.</p>
          <Button onClick={onSwitchToLogin} variant="secondary" className="mt-5 w-full" icon={<ArrowLeft className="w-4 h-4" />}>Back to sign in</Button>
        </div>
      ) : (
        <>
          {(localError || error) && <div className="mb-5 p-3.5 bg-[#fff3f0] border border-[#f1d4cf] rounded-2xl flex items-start gap-3 text-[#a84d43]"><AlertCircle className="w-[18px] h-[18px] mt-0.5 shrink-0"/><p className="text-xs leading-5 font-medium">{localError || error}</p></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#5f5c6d] mb-2">Email address</label>
              <div className="relative"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#aaa6b2]"/><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="w-full h-12 pl-[42px] pr-4 bg-[#fbfaf7] border border-[#ddd9d1] rounded-xl outline-none text-sm" disabled={loading}/></div>
            </div>
            <Button type="submit" size="lg" disabled={loading} className="w-full" icon={<Send className="w-4 h-4" />}>{loading ? 'Sending…' : 'Send reset link'}</Button>
          </form>
          <button type="button" onClick={onSwitchToLogin} className="mt-5 w-full flex items-center justify-center gap-2 text-sm font-bold text-[#5a568f] hover:text-[#35326e]" disabled={loading}><ArrowLeft className="w-4 h-4"/> Back to sign in</button>
        </>
      )}
    </AuthShell>
  );
};
