// src/firebase/config.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDq90RVkgbe-HzRwzkolvpk15dWd11xFA0",
  authDomain: "rapidresq-90a10.firebaseapp.com",
  projectId: "rapidresq-90a10",
  storageBucket: "rapidresq-90a10.firebasestorage.app",
  messagingSenderId: "124598436116",
  appId: "1:124598436116:web:2c76851826fb692f354201" // Use the correct web app ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);