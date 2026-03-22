module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/lib'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  globals: {
    __DEV__: false,
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.jest.json',
    }],
  },
  moduleNameMapper: {
    '^expo-secure-store$': '<rootDir>/lib/__tests__/__mocks__/expo-secure-store.ts',
    '^expo-localization$': '<rootDir>/lib/__tests__/__mocks__/expo-localization.ts',
    '^\\.\\./widget-bridge$': '<rootDir>/lib/__tests__/__mocks__/widget-bridge.ts',
    '^\\.\\./\\.\\./widget-bridge$': '<rootDir>/lib/__tests__/__mocks__/widget-bridge.ts',
    '^\\./widget-bridge$': '<rootDir>/lib/__tests__/__mocks__/widget-bridge.ts',
  },
};
