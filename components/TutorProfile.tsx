import React, { useState, useEffect } from 'react';
import { User, UserProfile } from '../types';
import { Button } from './Button';
import { firebaseService } from '../services/firebaseService';
import { updatePassword, updateProfile, getAuth, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { User as UserIcon, Lock, Save, ArrowLeft, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface TutorProfileProps {
    user: User;
    onBack: () => void;
}

export const TutorProfile: React.FC<TutorProfileProps> = ({ user, onBack }) => {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Profile Form State
    const [displayName, setDisplayName] = useState(user.displayName || '');
    const [phone, setPhone] = useState(user.phone || '');
    const [bio, setBio] = useState(user.bio || '');

    // Password Form State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Clear messages after 3 seconds
    useEffect(() => {
        if (successMsg || errorMsg) {
            const timer = setTimeout(() => {
                setSuccessMsg(null);
                setErrorMsg(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [successMsg, errorMsg]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setSuccessMsg(null);
        setErrorMsg(null);

        try {
            const auth = getAuth();
            if (auth.currentUser) {
                // Update Firebase Auth Profile
                await updateProfile(auth.currentUser, {
                    displayName: displayName
                });

                // Update Firestore Profile
                await firebaseService.updateUserProfile(user.uid, {
                    displayName,
                    phone,
                    bio
                });

                setSuccessMsg('Profile updated successfully!');
            }
        } catch (err: any) {
            console.error(err);
            setErrorMsg(err.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setErrorMsg("New passwords don't match");
            return;
        }
        if (newPassword.length < 6) {
            setErrorMsg("Password should be at least 6 characters");
            return;
        }

        setLoading(true);
        setSuccessMsg(null);
        setErrorMsg(null);

        try {
            const auth = getAuth();
            const user = auth.currentUser;

            if (user && user.email) {
                // Re-authenticate first
                const credential = EmailAuthProvider.credential(user.email, currentPassword);
                await reauthenticateWithCredential(user, credential);

                // Update password
                await updatePassword(user, newPassword);

                setSuccessMsg('Password updated successfully!');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/wrong-password') {
                setErrorMsg('Current password is incorrect');
            } else {
                setErrorMsg(err.message || 'Failed to change password');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center space-x-4 mb-2">
                <Button variant="ghost" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
                    Back to Dashboard
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Sidebar / Info */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 text-center">
                        <div className="h-24 w-24 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-3xl mx-auto mb-4">
                            {user.displayName?.charAt(0).toUpperCase()}
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">{user.displayName}</h2>
                        <p className="text-slate-500 text-sm">{user.email}</p>
                    </div>

                    {/* Status Messages */}
                    {(successMsg || errorMsg) && (
                        <div className={`p-4 rounded-lg border flex items-start gap-3 ${successMsg ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                            {successMsg ? <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" /> : <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />}
                            <div>
                                <p className="font-medium">{successMsg ? 'Success' : 'Error'}</p>
                                <p className="text-sm">{successMsg || errorMsg}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Forms */}
                <div className="md:col-span-2 space-y-6">

                    {/* Personal Information */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                            <div className="bg-indigo-100 p-2 rounded-lg">
                                <UserIcon className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Personal Information</h3>
                                <p className="text-sm text-slate-500">Update your public profile details</p>
                            </div>
                        </div>

                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                        placeholder="Your Name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone (Optional)</label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                        placeholder="+1 (555) 000-0000"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Bio (Optional)</label>
                                <textarea
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    rows={3}
                                    className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    placeholder="Tell students about yourself..."
                                />
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button type="submit" disabled={loading}>
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* Security */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                            <div className="bg-amber-100 p-2 rounded-lg">
                                <Lock className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Security</h3>
                                <p className="text-sm text-slate-500">Change your password</p>
                            </div>
                        </div>

                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                        placeholder="Min 6 characters"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button type="submit" variant="secondary" disabled={loading}>
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                                    Update Password
                                </Button>
                            </div>
                        </form>
                    </div>

                </div>
            </div>
        </div>
    );
};
