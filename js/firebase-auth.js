/**
 * Firebase Auth only — for staff Google sign-in.
 * Does not use Firestore or Storage; data stays on MySQL via db-api.js.
 */
(function () {
  if (typeof firebaseConfig === 'undefined' || !firebaseConfig.projectId || firebaseConfig.projectId === 'YOUR_PROJECT_ID') {
    return;
  }
  try {
    if (typeof firebase === 'undefined') {
      console.error('Firebase SDK not loaded.');
      return;
    }
  } catch (e) {
    return;
  }

  var app, auth;
  try {
    app = firebase.initializeApp(firebaseConfig);
    auth = app.auth();
    // Keep users signed in across refresh / browser restarts
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {
      // If persistence setting fails, we still continue with default behavior.
    });
  } catch (e) {
    console.error('Firebase Auth init failed', e);
    return;
  }

  function signInWithGoogle() {
    var provider = new firebase.auth.GoogleAuthProvider();
    return auth.signInWithPopup(provider).catch(function (err) {
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        auth.signInWithRedirect(provider);
        return new Promise(function () {});
      }
      throw err;
    });
  }

  function getRedirectResult() {
    return auth.getRedirectResult();
  }

  // Staff only — no Firestore roles; everyone who signs in with Google is staff.
  function getUserRole(uid) {
    return Promise.resolve('staff');
  }

  function setUserRole(uid, email, role) {
    return Promise.resolve();
  }

  window.FirebaseAuth = {
    auth: auth,
    signInWithGoogle: signInWithGoogle,
    getRedirectResult: getRedirectResult,
    signOut: function () {
      return auth.signOut();
    },
    onAuthStateChanged: function (cb) {
      return auth.onAuthStateChanged(cb);
    },
    getCurrentUser: function () {
      return auth.currentUser;
    },
    getUserRole: getUserRole,
    setUserRole: setUserRole
  };
})();
