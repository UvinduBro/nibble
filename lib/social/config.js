// Firebase web config for Nibble Social. These values are public identifiers (not secrets);
// access is controlled by Firebase Auth + the Firestore security rules in /firestore.rules.
// Paste the object from Firebase console → Project settings → Your apps → Web app.
export const firebaseConfig = {
  apiKey: 'AIzaSyCJ2RDDEqr0EYXBqRH-RWlpBBdUTi2XbMQ',
  authDomain: 'nibblex.firebaseapp.com',
  projectId: 'nibblex',
  storageBucket: 'nibblex.firebasestorage.app',
  messagingSenderId: '851887943576',
  appId: '1:851887943576:web:f6f9acc70ca5f85bf945ed',
};

export const socialConfigured = () => !!(firebaseConfig.apiKey && firebaseConfig.projectId);

// Local test mode: an in-browser fake backend (two tabs = two users). Only enabled for local builds.
export const useFake = () => process.env.NEXT_PUBLIC_NIBBLE_FAKE === '1';
