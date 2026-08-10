module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets (Reanimated 4's worklet compiler) MUST be last.
    plugins: ['react-native-worklets/plugin'],
  };
};
