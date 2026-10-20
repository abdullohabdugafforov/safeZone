// Extends app.json. Set SAFEKID_ALLOW_HTTP=1 only for local test builds that talk
// to a development backend over plain HTTP; production builds keep cleartext blocked.
module.exports = ({ config }) => {
  if (process.env.SAFEKID_ALLOW_HTTP !== '1') return config;
  return {
    ...config,
    plugins: (config.plugins ?? []).map((plugin) =>
      Array.isArray(plugin) && plugin[0] === 'expo-build-properties'
        ? [
            'expo-build-properties',
            { ...plugin[1], android: { ...plugin[1].android, usesCleartextTraffic: true } },
          ]
        : plugin,
    ),
  };
};
