import fetchMock from 'jest-fetch-mock';

import { BrainClient } from './client';
import { TokenVerificationStatus } from './interfaces/passwordless_verify_response';

describe('client', () => {
  const BASE_URL = 'http://baseurl';
  let client: BrainClient;
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.resetMocks();
    client = new BrainClient();
  });

  describe('fetch', () => {
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

  describe('login', () => {
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

  describe('passwordless', () => {
    const VERIFY_URL = 'https://superface.test/passwordless/verify';

    describe('login', () => {
      it('should send login email and return verify url', async () => {
        fetchMock.mockResponse(JSON.stringify({ verify_url: VERIFY_URL }), {
          status: 200,
        });
        const result = await client.passwordlessLogin('mail@mydomain.com');
        expect(result).toBe(VERIFY_URL);
      });
    });

    describe('verify', () => {
      describe('for confirmed token', () => {
        const authToken = {
          access_token: 'AT',
          token_type: 'Bearer',
          expires_in: 3600,
        };
        beforeEach(() => {
          fetchMock.mockResponse(JSON.stringify(authToken), {
            status: 200,
          });
        });

        it('should return authToken', async () => {
          const result = await client.verifyPasswordlessLogin(VERIFY_URL);
          expect(result.authToken).toEqual(authToken);
        });

        it('should return verificationStatus = CONFIRMED', async () => {
          const result = await client.verifyPasswordlessLogin(VERIFY_URL);
          expect(result.verificationStatus).toBe(
            TokenVerificationStatus.CONFIRMED
          );
        });

        it('should call login mock', async () => {
          const loginMock = jest.spyOn(client, 'login');
          await client.verifyPasswordlessLogin(VERIFY_URL);
          expect(loginMock.mock.calls.length).toBe(1);
        });
      });

      it('should return pending status when token confirmation pending', async () => {
        fetchMock.mockResponse(
          JSON.stringify({
            title: 'Token is pending confirmation',
            status: 'PENDING',
          }),
          {
            status: 400,
          }
        );
        const result = await client.verifyPasswordlessLogin(VERIFY_URL);
        expect(result.verificationStatus).toBe(TokenVerificationStatus.PENDING);
      });

      it('should return expired status when token expired', async () => {
        fetchMock.mockResponse(
          JSON.stringify({
            title: 'Token is expired',
            status: 'EXPIRED',
          }),
          {
            status: 400,
          }
        );
        const result = await client.verifyPasswordlessLogin(VERIFY_URL);
        expect(result.verificationStatus).toBe(TokenVerificationStatus.EXPIRED);
      });

      it('should return used status when token was already used', async () => {
        fetchMock.mockResponse(
          JSON.stringify({
            title: 'Token was already used',
            status: 'USED',
          }),
          {
            status: 400,
          }
        );
        const result = await client.verifyPasswordlessLogin(VERIFY_URL);
        expect(result.verificationStatus).toBe(TokenVerificationStatus.USED);
      });

      it('should throw when bad request status received', async () => {
        fetchMock.mockResponse(
          JSON.stringify({
            title: 'Bad request',
          }),
          {
            status: 400,
          }
        );
        await expect(
          client.verifyPasswordlessLogin(VERIFY_URL)
        ).rejects.toThrow();
      });
    });
  });

  describe('github', () => {
    it('should return valid github login url', () => {
      client.setOptions({ baseUrl: BASE_URL });
      expect(client.getGithubLoginUrl()).toBe(`${BASE_URL}/auth/github`);
    });
  });
});
