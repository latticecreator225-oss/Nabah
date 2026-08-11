// Dynamic Expo config.
//
// Everything still lives in app.json — this wrapper layers on two build-time
// concerns that a static file can't express:
//
//   1. Firebase is OPTIONAL for a build. Push goes through expo-notifications +
//      FCM, which needs a google-services.json. With none in the project we drop
//      the `googleServicesFile` reference so a build (e.g. a quick test APK) still
//      succeeds; add a real google-services.json and push is wired back in.
//
//   2. Cleartext (plain HTTP) traffic is OFF by default (app.json sets
//      usesCleartextTraffic:false) so production only ever talks to an HTTPS
//      backend. Local/LAN dev needs HTTP, so a build may opt back in by setting
//      EXPO_PUBLIC_ALLOW_CLEARTEXT=1 (the dev/preview EAS profiles do this).
//      Production must never set it.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  let result = config;

  const hasFirebase = fs.existsSync(path.join(__dirname, 'google-services.json'));
  if (!hasFirebase) {
    const android = { ...(result.android || {}) };
    delete android.googleServicesFile;
    result = { ...result, android };
  }

  // Cleartext: only when explicitly allowed (dev/LAN). Reflect the flag into the
  // expo-build-properties plugin so the Android manifest matches.
  const allowCleartext = process.env.EXPO_PUBLIC_ALLOW_CLEARTEXT === '1';
  const plugins = (result.plugins || []).map((p) => {
    if (Array.isArray(p) && p[0] === 'expo-build-properties') {
      const opts = p[1] || {};
      return [
        'expo-build-properties',
        { ...opts, android: { ...(opts.android || {}), usesCleartextTraffic: allowCleartext } },
      ];
    }
    return p;
  });
  result = { ...result, plugins };

  return result;
};
