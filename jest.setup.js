// AsyncStorage is a native module, so every suite that reaches the services
// layer needs its JS mock — the place cache and the recents store both sit
// under code that unrelated tests import.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
