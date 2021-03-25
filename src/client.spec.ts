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
    it('throws exception if not initialized', async () => {
      await expect(client.fetch('/test')).rejects.toThrow(
        new Error('Client is not initialized, baseUrl not configured')
      );
    });
    it('calls refreshAccessToken if access token expired', async () => {
      const isAccessTokenExpiredMock = jest
        .spyOn(client, 'isAccessTokenExpired')
        .mockImplementation(() => true);
      const refreshAccessTokenMock = jest.spyOn(client, 'refreshAccessToken');
      client.setOptions({ baseUrl: BASE_URL });
      await client.fetch('/test');
      expect(isAccessTokenExpiredMock.mock.calls.length).toBe(1);
      expect(refreshAccessTokenMock.mock.calls.length).toBe(1);
    });
    it('does not call refreshAccessToken if access token is valid', async () => {
      const isAccessTokenExpiredMock = jest
        .spyOn(client, 'isAccessTokenExpired')
        .mockImplementation(() => false);
      const refreshAccessTokenMock = jest.spyOn(client, 'refreshAccessToken');
      client.setOptions({ baseUrl: BASE_URL });
      await client.fetch('/test');
      expect(isAccessTokenExpiredMock.mock.calls.length).toBe(1);
      expect(refreshAccessTokenMock.mock.calls.length).toBe(0);
    });
    it('fetches correct url and passes access token in authorizaton header', async () => {
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
    it('calls refreshAccessToken if 401 response received', async () => {
      jest.spyOn(client, 'isAccessTokenExpired').mockImplementation(() => true);
      const refreshAccessTokenMock = jest.spyOn(client, 'refreshAccessToken');
      fetchMock.mockResponse('Unauthorized', {
        status: 401,
      });
      client.setOptions({ baseUrl: BASE_URL });
      await client.fetch('/test');
      expect(refreshAccessTokenMock.mock.calls.length).toBe(2);
    });
    it('calls refreshAccessToken if 403 response received', async () => {
      jest.spyOn(client, 'isAccessTokenExpired').mockImplementation(() => true);
      const refreshAccessTokenMock = jest.spyOn(client, 'refreshAccessToken');
      fetchMock.mockResponse('Unauthorized', {
        status: 403,
      });
      client.setOptions({ baseUrl: BASE_URL });
      await client.fetch('/test');
      expect(refreshAccessTokenMock.mock.calls.length).toBe(2);
    });
    it('throws on transport layer error', async () => {
      const err = new Error('Transport layer error');
      fetchMock.mockReject(err);
      client.setOptions({ baseUrl: BASE_URL });
      await expect(async () => client.fetch('/test')).rejects.toThrow(err);
    });
  });
  describe(`login`, () => {
    it('logs in', () => {
      client.login({
        access_token: 'AT',
        token_type: 'Bearer',
        expires_in: 3600,
      });
      expect(client.isAccessTokenExpired()).toBe(false);
    });
    it('logs out', () => {
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
