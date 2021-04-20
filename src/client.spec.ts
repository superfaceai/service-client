import fetchMock from 'jest-fetch-mock';

import { BrainClient } from './client';
import { CancellationToken } from './interfaces/passwordless_verify_options';
import { VerificationStatus } from './interfaces/passwordless_verify_response';

const VERIFY_PENDING_STATUS_RESPONSE_BODY = {
  title: 'Token is pending confirmation',
  status: 'PENDING',
};

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
    const EXPIRES_AT = new Date('2021-04-13T12:08:27.103Z');

    describe('login', () => {
      it('should send login email and return verify url with code expiration date', async () => {
        fetchMock.mockResponse(
          JSON.stringify({ verify_url: VERIFY_URL, expires_at: EXPIRES_AT }),
          { status: 200 }
        );
        const result = await client.passwordlessLogin('mail@mydomain.com');
        expect(result).toStrictEqual({
          verifyUrl: VERIFY_URL,
          expiresAt: EXPIRES_AT,
        });
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
          expect(result.verificationStatus).toBe(VerificationStatus.CONFIRMED);
        });

        it('should call login mock', async () => {
          const loginMock = jest.spyOn(client, 'login');
          await client.verifyPasswordlessLogin(VERIFY_URL);
          expect(loginMock.mock.calls.length).toBe(1);
        });
      });

      it('should return polling timeout status when token confirmation is pending', async () => {
        fetchMock.mockResponse(
          JSON.stringify(VERIFY_PENDING_STATUS_RESPONSE_BODY),
          {
            status: 400,
          }
        );
        const result = await client.verifyPasswordlessLogin(VERIFY_URL, {
          pollingTimeoutSeconds: 1,
        });
        expect(result.verificationStatus).toBe(
          VerificationStatus.POLLING_TIMEOUT
        );
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
        expect(result.verificationStatus).toBe(VerificationStatus.EXPIRED);
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
        expect(result.verificationStatus).toBe(VerificationStatus.USED);
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

      it('should poll verfication endpoint for pollingTimeoutSeconds', async () => {
        const testStart = new Date();
        fetchMock.mockResponse(
          JSON.stringify(VERIFY_PENDING_STATUS_RESPONSE_BODY),
          {
            status: 400,
          }
        );
        const pollingTimeoutSeconds = 2;
        await client.verifyPasswordlessLogin(VERIFY_URL, {
          pollingTimeoutSeconds: pollingTimeoutSeconds,
        });
        expect(new Date().getTime() - testStart.getTime()).toBeGreaterThan(
          pollingTimeoutSeconds * 1000
        );
      });

      it('should cancel polling', async () => {
        fetchMock.mockResponse(
          JSON.stringify(VERIFY_PENDING_STATUS_RESPONSE_BODY),
          {
            status: 400,
          }
        );
        const pollingTimeoutSeconds = 10;
        const pollingCancellationToken = new CancellationToken();
        const resultPromise = client.verifyPasswordlessLogin(VERIFY_URL, {
          pollingTimeoutSeconds: pollingTimeoutSeconds,
          cancellationToken: pollingCancellationToken,
        });
        pollingCancellationToken.isCancellationRequested = true;
        expect(await resultPromise).toEqual({
          verificationStatus: VerificationStatus.POLLING_CANCELLED,
        });
      });

      it('should call cancel polling callback', async () => {
        fetchMock.mockResponse(
          JSON.stringify(VERIFY_PENDING_STATUS_RESPONSE_BODY),
          {
            status: 400,
          }
        );

        const cancelCallback = jest.fn();
        const cancellationToken = new CancellationToken(cancelCallback);
        cancellationToken.isCancellationRequested = true;

        await client.verifyPasswordlessLogin(VERIFY_URL, {
          pollingTimeoutSeconds: 2,
          cancellationToken,
        });

        expect(cancelCallback).toBeCalled();
      });
    });
  });

  describe('github', () => {
    beforeEach(() => {
      client.setOptions({ baseUrl: BASE_URL });
    });

    it('should return github login url', () => {
      expect(client.getGithubLoginUrl()).toBe(`${BASE_URL}/auth/github`);
    });

    it('should return github login url with urlencoded returnTo query parameter', () => {
      const returnTo = 'https://superface.dev/login/callback';
      expect(client.getGithubLoginUrl(returnTo)).toBe(
        `${BASE_URL}/auth/github?return_to=${encodeURIComponent(returnTo)}`
      );
    });
  });

  describe('signout', () => {
    it('signing out from all devices • should set `all` option in API call', async () => {
      const client = new BrainClient({ baseUrl: BASE_URL });
      const mock = fetchMock.mockResponse('', { status: 204 });
      await client.signOut({ fromAllDevices: true });

      expect(mock).toHaveBeenCalledWith(`${BASE_URL}/auth/signout`, {
        body: '{"all":true}',
        method: 'DELETE',
      });
    });

    it('signing out from current session • should unset `all` option in API call', async () => {
      const client = new BrainClient({ baseUrl: BASE_URL });
      const mock = fetchMock.mockResponse('', { status: 204 });
      await client.signOut();

      expect(mock).toHaveBeenCalledWith(`${BASE_URL}/auth/signout`, {
        body: '{"all":false}',
        method: 'DELETE',
      });
    });

    it('when server responds with 204 • should return null & call internal `logout` method', async () => {
      fetchMock.mockResponse('', { status: 204 });
      const logoutSpy = jest.spyOn(client, 'logout');
      const result = await client.signOut();

      expect(logoutSpy).toHaveBeenCalledTimes(1);
      expect(result).toBe(null);
    });

    const errorCodes = [401, 403];
    for (const errorCode of errorCodes) {
      it(`when server responds with ${errorCode} • throws`, async () => {
        fetchMock.mockResponse(
          JSON.stringify({
            status: errorCode,
            title: 'Forbidden',
            detail: 'Forbidden resource',
            instance: '/auth/signout',
          }),
          { status: errorCode }
        );
        const logoutSpy = jest.spyOn(client, 'logout');

        expect(logoutSpy).toHaveBeenCalledTimes(0);
        expect(() => client.signOut()).rejects.toEqual(
          Error("No session found, couldn't log out")
        );
      });
    }

    it(`when server responds with 500 • throws unknown error`, async () => {
      fetchMock.mockResponse(
        JSON.stringify({
          status: 500,
          title: 'Something went wrong',
          detail: 'Unknown error',
          instance: '/auth/signout',
        }),
        { status: 500 }
      );
      const logoutSpy = jest.spyOn(client, 'logout');

      expect(logoutSpy).toHaveBeenCalledTimes(0);
      expect(() => client.signOut()).rejects.toEqual(
        Error("Couldn't log out due to unknown reasons")
      );
    });
  });
});
