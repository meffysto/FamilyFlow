module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/lib', '<rootDir>/hooks'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  globals: {
    __DEV__: false,
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.jest.json',
      diagnostics: false,
    }],
  },
  moduleNameMapper: {
    '^expo-secure-store$': '<rootDir>/lib/__tests__/__mocks__/expo-secure-store.ts',
    '^expo-localization$': '<rootDir>/lib/__tests__/__mocks__/expo-localization.ts',
    '^\\.\\./widget-bridge$': '<rootDir>/lib/__tests__/__mocks__/widget-bridge.ts',
    '^\\.\\./\\.\\./widget-bridge$': '<rootDir>/lib/__tests__/__mocks__/widget-bridge.ts',
    '^\\./widget-bridge$': '<rootDir>/lib/__tests__/__mocks__/widget-bridge.ts',
    '\\.(png|jpg|jpeg|gif|svg|webp)$': '<rootDir>/lib/__tests__/__mocks__/file-asset.ts',
    '^react-native$': '<rootDir>/lib/__tests__/__mocks__/react-native.ts',
  },
};
