// Firebase config — Google sign-in requires:
// 1. Authentication → Sign-in method → Google → Enable (set support email)
// 2. Authentication → Settings → Authorized domains: add your site (e.g. localhost or your hosting URL)
// 3. Run the app over HTTP/HTTPS (not file://)
const firebaseConfig = {
  apiKey: "AIzaSyAKr0ZkGDzBEFyxxtqt7VSqvcVPHwb2K3w",
  authDomain: "pho-docuarchive.firebaseapp.com",
  projectId: "pho-docuarchive",
  storageBucket: "pho-docuarchive.firebasestorage.app",
  messagingSenderId: "504464228292",
  appId: "1:504464228292:web:9e5b546984dde7cdc5ee91",
  measurementId: "G-5EK48SB8Y9"
};