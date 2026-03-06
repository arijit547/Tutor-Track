import React, { createContext, useState, useEffect, ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../services/firebase';
import { firebaseService } from '../services/firebaseService';
import { User, UserProfile } from '../types';

export interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, displayName: string, phone?: string, bio?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen to auth state changes
  useEffect(() => {
    console.log('[AuthContext] Setting up auth listener');
    if (!isFirebaseConfigured() || !auth) {
      console.log('[AuthContext] Firebase not configured, setting loading to false');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log('[AuthContext] onAuthStateChanged fired, user:', firebaseUser?.email || 'null');
      try {
        if (firebaseUser) {
          // Load user profile from Firestore
          const profile = await firebaseService.getUserProfile(firebaseUser.uid);
          if (profile) {
            setCurrentUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: profile.displayName,
              phone: profile.phone,
              bio: profile.bio,
            });
          } else {
            // Fallback if profile doesn't exist yet
            setCurrentUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: '',
            });
          }
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('Error loading user profile:', err);
        setError('Failed to load user profile');
      } finally {
        console.log('[AuthContext] Setting loading to false');
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    phone?: string,
    bio?: string
  ) => {
    try {
      setError(null);

      // Create Firebase auth user
      const { user } = await createUserWithEmailAndPassword(auth, email, password);

      // Create tutor profile in Firestore
      const profile: UserProfile = {
        uid: user.uid,
        email,
        displayName,
        phone,
        bio,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await firebaseService.createUserProfile(user.uid, profile);

      // Migrate localStorage data
      await firebaseService.migrateLocalDataToFirebase(user.uid);

      // Update local state
      setCurrentUser({
        uid: user.uid,
        email,
        displayName,
        phone,
        bio,
      });
    } catch (err: any) {
      const errorMessage = err.code === 'auth/email-already-in-use'
        ? 'Email already in use'
        : err.code === 'auth/weak-password'
        ? 'Password is too weak (min 6 characters)'
        : err.message || 'Failed to sign up';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      const { user } = await signInWithEmailAndPassword(auth, email, password);

      // Load user profile
      const profile = await firebaseService.getUserProfile(user.uid);
      if (profile) {
        setCurrentUser({
          uid: user.uid,
          email: user.email || '',
          displayName: profile.displayName,
          phone: profile.phone,
          bio: profile.bio,
        });
      }
    } catch (err: any) {
      const errorMessage = err.code === 'auth/user-not-found'
        ? 'No account found with this email'
        : err.code === 'auth/wrong-password'
        ? 'Incorrect password'
        : err.message || 'Failed to login';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
      setCurrentUser(null);
    } catch (err: any) {
      setError(err.message || 'Failed to logout');
      throw new Error(err.message);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setError(null);
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      const errorMessage = err.code === 'auth/user-not-found'
        ? 'No account found with this email'
        : err.message || 'Failed to send reset email';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const value: AuthContextType = {
    currentUser,
    loading,
    error,
    signUp,
    login,
    logout,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
