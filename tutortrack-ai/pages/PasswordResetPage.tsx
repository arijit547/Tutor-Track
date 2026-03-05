import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { GraduationCap, Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

interface PasswordResetPageProps {
  onSwitchToLogin: () => void;
}

export const PasswordResetPage: React.FC<PasswordResetPageProps> = ({ onSwitchToLogin }) => {
  const { resetPassword, error } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setSuccess(false);

    if (!email) {
      setLocalError('Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      await resetPassword(email);
      setSuccess(true);
      setEmail('');
    } catch (err: any) {
      setLocalError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-indigo-600 p-3 rounded-lg">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Reset Password</h1>
          <p className="text-slate-500 mt-2">We'll send you an email to reset your password</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-900">Check your email!</p>
              <p className="text-sm text-green-700 mt-1">
                We've sent a password reset link to {email}. Follow the link to create a new password.
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {(localError || error) && !success && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{localError || error}</p>
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  disabled={loading}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full mt-6"
            >
              {loading ? 'Sending...' : 'Send Reset Email'}
            </Button>
          </form>
        )}

        {/* Back to Login */}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="w-full flex items-center justify-center gap-2 text-indigo-600 font-medium hover:text-indigo-700"
          disabled={loading}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </button>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 mt-6">
          Remember your password? <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-indigo-600 font-medium hover:text-indigo-700"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};
