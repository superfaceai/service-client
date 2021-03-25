import fetchMock from 'jest-fetch-mock';

import { BrainClient } from './client';

describe('client', () => {
  const BASE_URL = 'http://baseurl';
  let client: BrainClient;
  beforeEach(() => {
    jest.clearAllMocks();
    client = new BrainClient();
  });
  describe(`fetch`, () => {
    it('should call refreshAccessToken if access token expired', async () => {
      const isAccessTokenExpiredMock = jest
        .spyOn(client, 'isAccessTokenExpired')
        .mockImplementation(() => true);
      const refreshAccessTokenMock = jest.spyOn(client, 'refreshAccessToken');
      client.setOptions({ baseUrl: BASE_URL });
      await client.fetch('/test');
      expect(isAccessTokenExpiredMock.mock.calls.length).toBe(1);
      expect(refreshAccessTokenMock.mock.calls.length).toBe(1);
    });
    it('should not not call refreshAccessToken if access token is valid', async () => {
      const isAccessTokenExpiredMock = jest
        .spyOn(client, 'isAccessTokenExpired')
        .mockImplementation(() => false);
      const refreshAccessTokenMock = jest.spyOn(client, 'refreshAccessToken');
      client.setOptions({ baseUrl: BASE_URL });
      await client.fetch('/test');
      expect(isAccessTokenExpiredMock.mock.calls.length).toBe(1);
      expect(refreshAccessTokenMock.mock.calls.length).toBe(0);
    });
    it('should fetch correct url and pass access token in authorizaton header', async () => {
      jest.spyOn(client, 'isAccessTokenExpired').mockImplementation(() => true);
      fetchMock.mockResponse(
        JSON.stringify({
          access_token: 'AT',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        {
          status: 201,
        }
      );
      client.setOptions({ baseUrl: BASE_URL });
      await client.fetch('/test');
      expect(fetchMock.mock.calls[1][0]).toBe(`${BASE_URL}/test`);
      expect(fetchMock.mock.calls[1][1]).toEqual({
        credentials: 'include',
        headers: {
          Authorization: 'Bearer AT',
        },
      });
    });
    it('should call refreshAccessToken if 401 response received', async () => {
      jest
        .spyOn(client, 'isAccessTokenExpired')
        .mockImplementation(() => false);
      const refreshAccessTokenMock = jest.spyOn(client, 'refreshAccessToken');
      fetchMock.mockResponse('Unauthorized', {
        status: 401,
      });
      client.setOptions({ baseUrl: BASE_URL });
      await client.fetch('/test');
      expect(refreshAccessTokenMock.mock.calls.length).toBe(1);
    });
    it('should call refreshAccessToken if 403 response received', async () => {
      jest
        .spyOn(client, 'isAccessTokenExpired')
        .mockImplementation(() => false);
      const refreshAccessTokenMock = jest.spyOn(client, 'refreshAccessToken');
      fetchMock.mockResponse('Unauthorized', {
        status: 403,
      });
      client.setOptions({ baseUrl: BASE_URL });
      await client.fetch('/test');
      expect(refreshAccessTokenMock.mock.calls.length).toBe(1);
    });
    it('should pass through transport layer exception', async () => {
      const err = new Error('Transport layer error');
      fetchMock.mockReject(err);
      client.setOptions({ baseUrl: BASE_URL });
      await expect(async () => client.fetch('/test')).rejects.toThrow(err);
    });
  });
  describe(`login`, () => {
    it('should login', () => {
      client.login({
        access_token: 'AT',
        token_type: 'Bearer',
        expires_in: 3600,
      });
      expect(client.isAccessTokenExpired()).toBe(false);
    });
    it('should logout', () => {
      client.login({
        access_token: 'AT',
        token_type: 'Bearer',
        expires_in: 3600,
      });
      client.logout();
      expect(client.isAccessTokenExpired()).toBe(true);
    });
  });
});
