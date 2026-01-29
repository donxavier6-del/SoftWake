// Custom Expo setup that mocks the winter runtime before it's required
// Based on jest-expo/src/preset/setup.js but with winter runtime mocked

'use strict';

// Mock the winter runtime BEFORE anything else
jest.mock('expo/src/winter', () => ({
  __esModule: true,
}));

jest.mock('expo/src/winter/runtime', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('expo/src/winter/runtime.native', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('expo/src/winter/installGlobal', () => ({
  __esModule: true,
  default: () => {},
}));

jest.mock('expo/src/winter/FormData', () => ({
  installFormDataPatch: jest.fn(),
}));

// Now safe to load the rest of expo-modules
const mockNativeModules = require('react-native/Libraries/BatchedBridge/NativeModules').default;

// window isn't defined as of react-native 0.45+ it seems
if (typeof window !== 'object') {
  globalThis.window = global;
  globalThis.window.navigator = {};
}

if (typeof globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ === 'undefined') {
  globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    isDisabled: true,
    renderers: {
      values: () => [],
    },
    on() {},
    off() {},
  };
  globalThis.window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
}

const mockImageLoader = {
  configurable: true,
  enumerable: true,
  get: () => ({
    prefetchImage: jest.fn(),
    getSize: jest.fn((uri, success) => process.nextTick(() => success(320, 240))),
  }),
};
Object.defineProperty(mockNativeModules, 'ImageLoader', mockImageLoader);
Object.defineProperty(mockNativeModules, 'ImageViewManager', mockImageLoader);

Object.defineProperty(mockNativeModules, 'LinkingManager', {
  configurable: true,
  enumerable: true,
  get: () => ({
    openURL: jest.fn(),
    canOpenURL: jest.fn(() => Promise.resolve(true)),
    getInitialURL: jest.fn(() => Promise.resolve(null)),
  }),
});

// Mock expo-modules-core polyfill
try {
  require('expo-modules-core/src/polyfill/dangerous-internal').installExpoGlobalPolyfill();
} catch (e) {
  // Ignore if not available
}
