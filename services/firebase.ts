import { initializeApp } from 'firebase/app';
import { initializeAuth, indexedDBLocalPersistence, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Check if Firebase is configured
export const isFirebaseConfigured = () => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.authDomain
  );
};

let app: any;
let auth: any;
let db: any;

if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig);
    
    // Initialize auth with IndexedDB persistence for web and Capacitor compatibility
    auth = initializeAuth(app, {
      persistence: indexedDBLocalPersistence
    });
    
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true
    });

    // No automatic anonymous sign-in - users must login with email/password
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}

export { auth, db };
export default app;

