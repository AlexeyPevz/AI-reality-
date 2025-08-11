module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/pages/api/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@real-estate-bot/shared(.*)$': '<rootDir>/../../packages/shared/src$1',
    '^@real-estate-bot/database(.*)$': '<rootDir>/../../packages/database/src$1',
  },
};