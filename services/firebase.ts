import { initializeApp } from 'firebase/app';
import { initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

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

