import { Logger } from '@nestjs/common';

beforeAll(() => {
  // Keep test output focused on pass/fail; tested error paths still execute.
  Logger.overrideLogger(false);

  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => undefined);
});

afterAll(() => {
  // Restore default levels for any subsequent non-test process in the same runtime.
  Logger.overrideLogger(['log', 'error', 'warn', 'debug', 'verbose']);
  jest.restoreAllMocks();
});
