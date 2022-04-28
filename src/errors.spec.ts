import { CreateProfileApiError, CreateProviderApiError, ServiceApiError, ServiceClientError } from './errors';

describe('errors', () => {
  describe('ServiceClientError', () => {
    it('should work with instanceof operator', () => {
      const error = new ServiceClientError('Service Client Error');

      expect(error instanceof ServiceClientError).toBeTruthy();
    });
  });

  describe('ServiceApiError', () => {
    it('should work with instanceof operator', () => {
      const error = new ServiceApiError({
        status: 500,
        title: 'Error',
        detail: 'Test error',
        instance: '/mocked',
      });

      expect(error instanceof ServiceApiError).toBeTruthy();
    });
  });

  describe('CreateProviderApiError', () => {
    it('should work with instanceof operator', () => {
      const error = new CreateProviderApiError({
        status: 500,
        title: 'Error',
        detail: 'Test error',
        instance: '/mocked',
      });

      expect(error instanceof CreateProviderApiError).toBeTruthy();
    });
  });

  describe('CreateProfileApiError', () => {
    it('should work with instanceof operator', () => {
      const error = new CreateProfileApiError({
        status: 500,
        title: 'Error',
        detail: 'Test error',
        instance: '/mocked',
      });

      expect(error instanceof CreateProfileApiError).toBeTruthy();
    });
  });
});
