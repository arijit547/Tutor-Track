import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { AuthShell } from '../components/AuthShell';
import { Mail, LockKeyhole, User, Phone, AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface RegisterPageProps { onSwitchToLogin: () => void; }

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin }) => {
  const { signUp, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!email || !password || !confirmPassword || !displayName) return setLocalError('Please complete all required fields.');
    if (password !== confirmPassword) return setLocalError('Passwords do not match.');
    if (password.length < 6) return setLocalError('Password must be at least 6 characters.');

    try {
      setLoading(true);
      await signUp(email, password, displayName, phone || undefined, bio || undefined);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to create account');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell eyebrow="Create your workspace" title="Start with TutorTrack" subtitle="Set up your tutor profile and keep every student, session and payment connected to your account.">
      {(localError || error) && (
        <div className="mb-5 p-3.5 bg-[#fff3f0] border border-[#f1d4cf] rounded-2xl flex items-start gap-3 text-[#a84d43]">
          <AlertCircle className="w-[18px] h-[18px] mt-0.5 shrink-0" />
          <p className="text-xs leading-5 font-medium">{localError || error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-[#5f5c6d] mb-2">Full name *</label>
          <div className="relative"><User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#aaa6b2]"/><input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" className="w-full h-12 pl-[42px] pr-4 bg-[#fbfaf7] border border-[#ddd9d1] rounded-xl outline-none text-sm" disabled={loading}/></div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#5f5c6d] mb-2">Email *</label>
            <div className="relative"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#aaa6b2]"/><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="w-full h-12 pl-[42px] pr-3 bg-[#fbfaf7] border border-[#ddd9d1] rounded-xl outline-none text-sm" disabled={loading}/></div>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#5f5c6d] mb-2">Phone</label>
            <div className="relative"><Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#aaa6b2]"/><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="01XXXXXXXXX" className="w-full h-12 pl-[42px] pr-3 bg-[#fbfaf7] border border-[#ddd9d1] rounded-xl outline-none text-sm" disabled={loading}/></div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#5f5c6d] mb-2">Short bio <span className="font-medium text-[#aaa6b2]">(optional)</span></label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Subjects you teach, experience, etc." rows={2} className="w-full px-3.5 py-3 bg-[#fbfaf7] border border-[#ddd9d1] rounded-xl outline-none text-sm resize-none" disabled={loading}/>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#5f5c6d] mb-2">Password *</label>
          <div className="relative"><LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#aaa6b2]"/><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" className="w-full h-12 pl-[42px] pr-11 bg-[#fbfaf7] border border-[#ddd9d1] rounded-xl outline-none text-sm" disabled={loading}/><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#aaa6b2] hover:text-[#5b5783]">{showPassword ? <EyeOff className="w-[18px] h-[18px]"/> : <Eye className="w-[18px] h-[18px]"/>}</button></div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#5f5c6d] mb-2">Confirm password *</label>
          <div className="relative"><LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#aaa6b2]"/><input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" className="w-full h-12 pl-[42px] pr-4 bg-[#fbfaf7] border border-[#ddd9d1] rounded-xl outline-none text-sm" disabled={loading}/></div>
        </div>

        <Button type="submit" size="lg" disabled={loading} className="w-full mt-1">{loading ? 'Creating account…' : <>Create account <ArrowRight className="w-4 h-4"/></>}</Button>
      </form>

      <button type="button" onClick={onSwitchToLogin} className="mt-5 w-full flex items-center justify-center gap-2 text-sm font-bold text-[#5a568f] hover:text-[#35326e]" disabled={loading}><ArrowLeft className="w-4 h-4"/> Already have an account? Sign in</button>
    </AuthShell>
  );
};
