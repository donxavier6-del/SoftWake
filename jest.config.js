const jestPreset = require('jest-expo/jest-preset');

// Override the setupFiles to exclude jest-expo's setup.js
// We'll use our own setup that mocks the winter runtime first
const setupFiles = (jestPreset.setupFiles || []).filter(
  (file) => !file.includes('jest-expo') || file.includes('setup.js') === false
);

module.exports = {
  ...jestPreset,
  setupFiles: [...setupFiles, '<rootDir>/jest.setup.expo.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/__tests__/**/*.(ts|tsx|js)', '**/*.(test|spec).(ts|tsx|js)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
