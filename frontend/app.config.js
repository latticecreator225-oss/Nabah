// Dynamic Expo config.
//
// Everything lives in app.json — this wrapper only toggles cleartext (plain
// HTTP) traffic. It's OFF by default (app.json sets usesCleartextTraffic:false)
// so production only ever talks to an HTTPS backend. Local/LAN dev needs HTTP,
// so a build may opt back in by setting EXPO_PUBLIC_ALLOW_CLEARTEXT=1 (the
// dev/preview EAS profiles do this). Production must never set it.
//
// There is no Firebase/FCM configuration — reminders are local (on-device)
// notifications, which need no google-services.json.

module.exports = ({ config }) => {
  const allowCleartext = process.env.EXPO_PUBLIC_ALLOW_CLEARTEXT === '1';
  const plugins = (config.plugins || []).map((p) => {
    if (Array.isArray(p) && p[0] === 'expo-build-properties') {
      const opts = p[1] || {};
      return [
        'expo-build-properties',
        { ...opts, android: { ...(opts.android || {}), usesCleartextTraffic: allowCleartext } },
      ];
    }
    return p;
  });
  return { ...config, plugins };
};
