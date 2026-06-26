// ======================================================
// FILE: src/services/firebase.ts
// ======================================================
/// <reference types="node" />

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  enableIndexedDbPersistence,
  CACHE_SIZE_UNLIMITED
} from 'firebase/firestore';

// Firebase configuration
// Replace with your actual config from Firebase Console
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase
class FirebaseService {
  private static instance: FirebaseService;
  public app: FirebaseApp;
  public auth: Auth;
  public db: Firestore;

  private constructor() {
    this.app = initializeApp(firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    
    // Enable offline persistence for better performance
    this.enableOfflinePersistence();
  }
private async enableOfflinePersistence(): Promise<void> {
  try {
    await enableIndexedDbPersistence(this.db);
    console.log('Firestore persistence enabled');
  } catch (err: any) {
    if (err.code === 'failed-precondition') {
      console.warn('Persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Persistence not supported by browser');
    }
  }
}

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }
}

// Export singleton instance
export const firebaseService = FirebaseService.getInstance();
export const auth = firebaseService.auth;
export const db = firebaseService.db;