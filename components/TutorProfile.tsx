import React, { useEffect, useState } from 'react';
import { updatePassword, updateProfile, getAuth, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { User } from '../types';
import { firebaseService } from '../services/firebaseService';
import { Button } from './Button';
import { User as UserIcon, Lock, Save, ArrowLeft, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface TutorProfileProps {
  user: User;
  onBack: () => void;
}

export const TutorProfile: React.FC<TutorProfileProps> = ({ user, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [bio, setBio] = useState(user.bio || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    setDisplayName(user.displayName || '');
    setPhone(user.phone || '');
    setBio(user.bio || '');
  }, [user]);

  useEffect(() => {
    if (!successMsg && !errorMsg) return;
    const timer = window.setTimeout(() => {
      setSuccessMsg(null);
      setErrorMsg(null);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [successMsg, errorMsg]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const auth = getAuth();
      if (!auth.currentUser) throw new Error('No signed-in user found.');
      await updateProfile(auth.currentUser, { displayName });
      const updated = await firebaseService.updateUserProfile(user.uid, { displayName, phone, bio });
      if (!updated) throw new Error('Profile could not be saved to Firestore.');
      setSuccessMsg('Profile updated successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return setErrorMsg("New passwords don't match.");
    if (newPassword.length < 6) return setErrorMsg('Password should be at least 6 characters.');

    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const auth = getAuth();
      const authUser = auth.currentUser;
      if (!authUser?.email) throw new Error('No signed-in email account found.');
      const credential = EmailAuthProvider.credential(authUser.email, currentPassword);
      await reauthenticateWithCredential(authUser, credential);
      await updatePassword(authUser, newPassword);
      setSuccessMsg('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMsg(err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' ? 'Current password is incorrect.' : (err.message || 'Failed to change password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>Dashboard</Button>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
        <aside className="space-y-4">
          <div className="tt-card rounded-[24px] p-6 text-center">
            <div className="h-20 w-20 rounded-[24px] bg-[#34326f] text-white grid place-items-center text-2xl font-extrabold mx-auto shadow-[0_10px_24px_rgba(52,50,111,.2)]">
              {(user.displayName || user.email || 'T').charAt(0).toUpperCase()}
            </div>
            <h2 className="mt-4 text-xl font-extrabold tracking-[-.03em] text-[#2d2b43]">{user.displayName || 'Tutor'}</h2>
            <p className="mt-1 text-sm text-[#888493] break-all">{user.email}</p>
            <div className="mt-5 rounded-2xl bg-[#f7f5ef] px-4 py-3 text-left">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#aaa6b0]">Account</p>
              <p className="mt-1 text-xs font-semibold text-[#676474]">Firebase authentication enabled</p>
            </div>
          </div>

          {(successMsg || errorMsg) && (
            <div className={`rounded-[18px] border p-4 flex items-start gap-3 ${successMsg ? 'bg-[#f1f8f4] border-[#d8e9df] text-[#3b7257]' : 'bg-[#fff3f0] border-[#f1d4cf] text-[#a84d43]'}`}>
              {successMsg ? <CheckCircle className="w-[18px] h-[18px] mt-0.5 shrink-0" /> : <AlertCircle className="w-[18px] h-[18px] mt-0.5 shrink-0" />}
              <div><p className="text-xs font-extrabold">{successMsg ? 'Saved' : 'Could not save'}</p><p className="mt-1 text-xs leading-5 opacity-80">{successMsg || errorMsg}</p></div>
            </div>
          )}
        </aside>

        <div className="space-y-5">
          <section className="tt-card rounded-[24px] p-5 sm:p-6">
            <div className="flex items-center gap-3 pb-5 border-b border-[#eeece6]">
              <div className="h-10 w-10 rounded-[13px] bg-[#eeecf7] text-[#55518f] grid place-items-center"><UserIcon className="w-[18px] h-[18px]" /></div>
              <div><h3 className="font-extrabold text-[#323047]">Profile information</h3><p className="mt-0.5 text-xs text-[#8d8997]">Your basic tutor details</p></div>
            </div>
            <form onSubmit={handleUpdateProfile} className="mt-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-[#666374] mb-2">Display name</label><input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full rounded-xl border border-[#dcd8d0] bg-[#fbfaf7] px-3.5 py-2.5 text-sm outline-none" placeholder="Your name" /></div>
                <div><label className="block text-xs font-bold text-[#666374] mb-2">Phone</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full rounded-xl border border-[#dcd8d0] bg-[#fbfaf7] px-3.5 py-2.5 text-sm outline-none" placeholder="01XXXXXXXXX" /></div>
              </div>
              <div><label className="block text-xs font-bold text-[#666374] mb-2">Bio</label><textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full rounded-xl border border-[#dcd8d0] bg-[#fbfaf7] px-3.5 py-3 text-sm outline-none resize-none" placeholder="Subjects, experience, or a short introduction" /></div>
              <div className="flex justify-end"><Button type="submit" disabled={loading} icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}>{loading ? 'Saving…' : 'Save profile'}</Button></div>
            </form>
          </section>

          <section className="tt-card rounded-[24px] p-5 sm:p-6">
            <div className="flex items-center gap-3 pb-5 border-b border-[#eeece6]">
              <div className="h-10 w-10 rounded-[13px] bg-[#fff4df] text-[#9a6a28] grid place-items-center"><Lock className="w-[18px] h-[18px]" /></div>
              <div><h3 className="font-extrabold text-[#323047]">Password & security</h3><p className="mt-0.5 text-xs text-[#8d8997]">Re-authentication is required before changing your password</p></div>
            </div>
            <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
              <div><label className="block text-xs font-bold text-[#666374] mb-2">Current password</label><input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full rounded-xl border border-[#dcd8d0] bg-[#fbfaf7] px-3.5 py-2.5 text-sm outline-none" placeholder="••••••••" required /></div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-[#666374] mb-2">New password</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full rounded-xl border border-[#dcd8d0] bg-[#fbfaf7] px-3.5 py-2.5 text-sm outline-none" placeholder="Minimum 6 characters" required /></div>
                <div><label className="block text-xs font-bold text-[#666374] mb-2">Confirm password</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full rounded-xl border border-[#dcd8d0] bg-[#fbfaf7] px-3.5 py-2.5 text-sm outline-none" placeholder="Repeat new password" required /></div>
              </div>
              <div className="flex justify-end"><Button type="submit" variant="secondary" disabled={loading} icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}>{loading ? 'Updating…' : 'Update password'}</Button></div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};
