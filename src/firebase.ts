// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBEs3oSK_w9p4btFp-Ebc_eQK8CO2F6vc8",
  authDomain: "travel-map-f34b3.firebaseapp.com",
  projectId: "travel-map-f34b3",
  storageBucket: "travel-map-f34b3.firebasestorage.app",
  messagingSenderId: "289234217949",
  appId: "1:289234217949:web:ef862bbbb0d18f1d666434",
  measurementId: "G-1GWKEYDBSL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const db = getFirestore(app);