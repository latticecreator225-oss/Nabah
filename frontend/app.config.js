// Dynamic Expo config.
//
// Everything still lives in app.json — this wrapper layers on two build-time
// concerns that a static file can't express:
//
//   1. Firebase / SuprSend FCM push is OPTIONAL. With no google-services.json in
//      the project we drop the `googleServicesFile` reference and the
//      `withSuprSendFcm` plugin so a build (e.g. a test APK via EAS) succeeds
//      without a Firebase project. Add a real google-services.json and it's
//      wired back in.
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
    const plugins = (result.plugins || []).filter((p) => {
      const name = Array.isArray(p) ? p[0] : p;
      return name !== './plugins/withSuprSendFcm';
    });
    const android = { ...(result.android || {}) };
    delete android.googleServicesFile;
    result = { ...result, plugins, android };
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
