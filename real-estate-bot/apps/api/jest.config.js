module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'js'],
  moduleNameMapper: {
    '^@real-estate-bot/shared(.*)$': '<rootDir>/../../packages/shared/src$1',
    '^@real-estate-bot/database(.*)$': '<rootDir>/../../packages/database/src$1',
    '^@real-estate-bot/providers(.*)$': '<rootDir>/../../packages/providers/src$1',
  },
};