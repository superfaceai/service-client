import fetchMock from 'jest-fetch-mock';

import { ServiceClient } from './client';
import {
  MEDIA_TYPE_JSON,
  MEDIA_TYPE_MAP,
  MEDIA_TYPE_MAP_AST,
  MEDIA_TYPE_PROFILE,
  MEDIA_TYPE_PROFILE_AST,
  MEDIA_TYPE_TEXT,
} from './constants';
import { ServiceClientError, ServiceApiError } from './errors';
import {
  MapRevisionResponse,
  ProfileVersionResponse,
  ProviderResponse,
  LoginConfirmationErrorCode,
} from './interfaces';
import { CancellationToken } from './interfaces/passwordless_verify_options';
import { VerificationStatus } from './interfaces/passwordless_verify_response';

const VERIFY_PENDING_STATUS_RESPONSE_BODY = {
  title: 'Token is pending confirmation',
  status: 'PENDING',
};

describe('client', () => {
  const BASE_URL = 'http://baseurl';
  let client: ServiceClient;
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.resetMocks();
    client = new ServiceClient();
  });

  describe('fetch', () => {
    describe('when using authentication (default)', () => {
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
        jest
          .spyOn(client, 'isAccessTokenExpired')
          .mockImplementation(() => true);
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

    describe('when NOT using authentication', () => {
      it('should not check isAccessTokenExpired nor call refreshAccessToken', async () => {
        const isAccessTokenExpiredMock = jest
          .spyOn(client, 'isAccessTokenExpired')
          .mockImplementation(() => true);
        const refreshAccessTokenMock = jest.spyOn(client, 'refreshAccessToken');

        client.setOptions({ baseUrl: BASE_URL });

        await client.fetch('/test', { authenticate: false });

        expect(isAccessTokenExpiredMock.mock.calls.length).toBe(0);
        expect(refreshAccessTokenMock.mock.calls.length).toBe(0);
      });

      it('should fetch correct url without passing any access token in authorizaton header', async () => {
        client.setOptions({ baseUrl: BASE_URL });

        await client.fetch('/test', { authenticate: false });

        expect(fetchMock.mock.calls[0][0]).toBe(`${BASE_URL}/test`);
        expect(fetchMock.mock.calls[0][1]).toEqual({
          credentials: 'include',
          headers: {},
        });
      });

      it('should not call refreshAccessToken if 401 response received', async () => {
        jest
          .spyOn(client, 'isAccessTokenExpired')
          .mockImplementation(() => false);
        const refreshAccessTokenMock = jest.spyOn(client, 'refreshAccessToken');
        fetchMock.mockResponse('Unauthorized', {
          status: 401,
        });
        client.setOptions({ baseUrl: BASE_URL });

        await client.fetch('/test', { authenticate: false });

        expect(refreshAccessTokenMock.mock.calls.length).toBe(0);
      });
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
      it('when successful • should send login email and return verify url with code expiration date', async () => {
        fetchMock.mockResponse(
          JSON.stringify({ verify_url: VERIFY_URL, expires_at: EXPIRES_AT }),
          { status: 200 }
        );
        const result = await client.passwordlessLogin('mail@mydomain.com');
        expect(result).toStrictEqual({
          success: true,
          verifyUrl: VERIFY_URL,
          expiresAt: EXPIRES_AT,
        });
      });

      it("when email doesn't exist • should return unsuccess with response title & optionally detail", async () => {
        fetchMock.mockResponse(
          JSON.stringify({
            status: 400,
            instance: '/auth/passwordless',
            title: 'Email not found',
            detail: "user with mail@mydomain.com doesn't exist",
          }),
          { status: 400 }
        );
        const result = await client.passwordlessLogin('mail@mydomain.com');
        expect(result).toStrictEqual({
          success: false,
          title: 'Email not found',
          detail: "user with mail@mydomain.com doesn't exist",
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

    describe('confirm', () => {
      const email = 'email@superface.test';
      const code =
        '3d5665e8ff18a5c306c6df53bcc617d8b5923d7ea02b992b96f1773ec36ee152';

      const confirmedRes = { status: 'CONFIRMED' };

      const usedRes = {
        status: 400,
        instance: '/auth/passwordless/confirm',
        title: 'Token already confirmed',
        detail: `Code ${code} was already used to confirm login`,
      };

      const expiredRes = {
        status: 400,
        instance: '/auth/passwordless/confirm',
        title: 'Code is expired',
        detail: `Code ${code} is expired`,
      };

      const invalidRes = {
        status: 400,
        instance: '/auth/passwordless/confirm',
        title: "Email doesn't match",
        detail: `Email ${email} doesn't match with email for confirmation`,
      };

      it(`when API responds with status ${confirmedRes.status} • returns success`, async () => {
        fetchMock.mockResponse(JSON.stringify(confirmedRes), { status: 200 });

        const result = await client.confirmPasswordlessLogin(email, code);

        expect(result).toStrictEqual({ success: true });
      });

      it(`when API responds with status 400 and title '${usedRes.title}' • returns failure with code 'USED'`, async () => {
        fetchMock.mockResponse(JSON.stringify(usedRes), { status: 400 });

        const result = await client.confirmPasswordlessLogin(email, code);

        expect(result).toStrictEqual({
          success: false,
          code: LoginConfirmationErrorCode.USED,
        });
      });

      it(`when API responds with status 400 and title '${expiredRes.title}' • returns failure with code 'EXPIRED'`, async () => {
        fetchMock.mockResponse(JSON.stringify(expiredRes), { status: 400 });

        const result = await client.confirmPasswordlessLogin(email, code);

        expect(result).toStrictEqual({
          success: false,
          code: LoginConfirmationErrorCode.EXPIRED,
        });
      });

      it(`when API responds with status 400 and title '${invalidRes.title}' • returns failure with code 'INVALID'`, async () => {
        fetchMock.mockResponse(JSON.stringify(invalidRes), { status: 400 });

        const result = await client.confirmPasswordlessLogin(email, code);

        expect(result).toStrictEqual({
          success: false,
          code: LoginConfirmationErrorCode.INVALID,
        });
      });

      it('when API responds with unfamiliar response • throws', () => {
        fetchMock.mockResponse('500 Internal Server Error', { status: 500 });

        expect(() =>
          client.confirmPasswordlessLogin(email, code)
        ).rejects.toStrictEqual(
          new Error(
            'Cannot deserialize confirmation API response: Unexpected token I in JSON at position 4'
          )
        );
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

    it('should return github login url with mode query parameter', () => {
      expect(client.getGithubLoginUrl(undefined, 'register')).toBe(
        `${BASE_URL}/auth/github?mode=register`
      );
    });

    it('should return github login url with both returnTo and mode query parameters', () => {
      const returnTo = 'https://superface.dev/login/callback';
      expect(client.getGithubLoginUrl(returnTo, 'register')).toBe(
        `${BASE_URL}/auth/github?return_to=${encodeURIComponent(
          returnTo
        )}&mode=register`
      );
    });
  });

  describe('createProvider', () => {
    it('should create provider', async () => {
      const mockResponse = {
        ok: true,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.createProvider('test')).resolves.toBeUndefined();
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/providers', {
        method: 'POST',
        body: 'test',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should throw error', async () => {
      const payload = {
        status: 400,
        instance: '/providers',
        title: 'Already exists',
        detail: 'Provider already exists',
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.createProvider('test')).rejects.toEqual(
        new ServiceApiError(payload)
      );
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/providers', {
        method: 'POST',
        body: 'test',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('findAllProviders', () => {
    it('should find all providers', async () => {
      const mockResult: ProviderResponse[] = [
        {
          url: 'testUrl',
          name: 'testName',
          deployments: [],
          security: [],
        },
      ];
      const mockResponse = {
        ok: true,
        json: async () => mockResult,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.findAllProviders()).resolves.toEqual(mockResult);
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/providers', {
        authenticate: false,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should throw error', async () => {
      const payload = {
        status: 404,
        instance: '/providers',
        title: 'Not Found',
        detail: 'Provider not found',
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.findAllProviders()).rejects.toEqual(
        new ServiceApiError(payload)
      );
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/providers', {
        authenticate: false,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('findOneProvider', () => {
    it('should get one provider', async () => {
      const mockResult: ProviderResponse = {
        url: 'testUrl',
        name: 'testName',
        deployments: [],
        security: [],
      };

      const mockResponse = {
        ok: true,
        json: async () => mockResult,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.findOneProvider('test')).resolves.toEqual(mockResult);
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/providers/test', {
        authenticate: false,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should throw error', async () => {
      const payload = {
        status: 404,
        instance: '/providers',
        title: 'Not Found',
        detail: 'Provider not found',
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.findOneProvider('test')).rejects.toEqual(
        new ServiceApiError(payload)
      );
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/providers/test', {
        authenticate: false,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('createProfile', () => {
    it('should create profile', async () => {
      const mockResponse = {
        ok: true,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.createProfile('test')).resolves.toBeUndefined();
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/profiles', {
        method: 'POST',
        body: 'test',
        headers: {
          'Content-Type': MEDIA_TYPE_TEXT,
        },
      });
    });

    it('should throw error', async () => {
      const payload = {
        status: 400,
        instance: '/profiles',
        title: 'Already exists',
        detail: 'Profile already exists',
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.createProfile('test')).rejects.toEqual(
        new ServiceApiError(payload)
      );
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/profiles', {
        method: 'POST',
        body: 'test',
        headers: {
          'Content-Type': MEDIA_TYPE_TEXT,
        },
      });
    });
  });
  describe('parseProfile', () => {
    it('should parse profile', async () => {
      const mockResponse = {
        ok: true,
        text: async () => 'profileAst',
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.parseProfile('profileSource')).resolves.toEqual(
        'profileAst'
      );
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/parse', {
        authenticate: false,
        method: 'POST',
        body: 'profileSource',
        headers: {
          'Content-Type': MEDIA_TYPE_PROFILE,
        },
      });
    });

    it('should throw error', async () => {
      const payload = {
        status: 500,
        instance: '/parse',
        title: 'Internal Server Exception',
        detail: 'Unknow parser error',
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.parseProfile('profileSource')).rejects.toEqual(
        new ServiceApiError(payload)
      );
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/parse', {
        authenticate: false,
        method: 'POST',
        body: 'profileSource',
        headers: {
          'Content-Type': MEDIA_TYPE_PROFILE,
        },
      });
    });
  });
  describe('getProfile', () => {
    it('should get one profile', async () => {
      const mockResult: ProfileVersionResponse = {
        profile_id: 'testId',
        profile_name: 'testName',
        profile_version: '1.0.0',
        url: 'testUrl',
        published_at: new Date(),
        published_by: 'test',
        owner: 'testOwner',
        owner_url: 'testOwnerUrl',
      };

      const mockResponse = {
        ok: true,
        json: async () => mockResult,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(
        client.getProfile('vcs', '1.0.0', 'user-repos')
      ).resolves.toEqual(mockResult);
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/vcs/user-repos@1.0.0', {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: MEDIA_TYPE_JSON,
        },
      });
    });

    it('should throw error', async () => {
      const payload = {
        status: 404,
        instance: '/vcs/user-repos@1.0.0',
        title: 'Not Found',
        detail: 'Profile not found',
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(
        client.getProfile('vcs', '1.0.0', 'user-repos')
      ).rejects.toEqual(new ServiceApiError(payload));
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/vcs/user-repos@1.0.0', {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: MEDIA_TYPE_JSON,
        },
      });
    });
  });
  describe('getProfileSource', () => {
    it('should get profile source', async () => {
      const mockResponse = {
        ok: true,
        text: async () => 'profileSource',
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(
        client.getProfileSource('vcs', '1.0.0', 'user-repos')
      ).resolves.toEqual('profileSource');
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/vcs/user-repos@1.0.0', {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: MEDIA_TYPE_PROFILE,
        },
      });
    });

    it('should throw error', async () => {
      const payload = {
        status: 404,
        instance: '/vcs/user-repos@1.0.0',
        title: 'Not Found',
        detail: 'Profile not found',
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(
        client.getProfileSource('vcs', '1.0.0', 'user-repos')
      ).rejects.toEqual(new ServiceApiError(payload));
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/vcs/user-repos@1.0.0', {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: MEDIA_TYPE_PROFILE,
        },
      });
    });
  });

  describe('getProfileAST', () => {
    it('should get profile AST', async () => {
      const mockResponse = {
        ok: true,
        text: async () => 'profileAST',
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(
        client.getProfileAST('vcs', '1.0.0', 'user-repos')
      ).resolves.toEqual('profileAST');
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/vcs/user-repos@1.0.0', {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: MEDIA_TYPE_PROFILE_AST,
        },
      });
    });

    it('should throw error', async () => {
      const payload = {
        status: 404,
        instance: '/vcs/user-repos@1.0.0',
        title: 'Not Found',
        detail: 'Profile not found',
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(
        client.getProfileAST('vcs', '1.0.0', 'user-repos')
      ).rejects.toEqual(new ServiceApiError(payload));
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/vcs/user-repos@1.0.0', {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: MEDIA_TYPE_PROFILE_AST,
        },
      });
    });
  });

  describe('createMap', () => {
    it('should create map', async () => {
      const mockResponse = {
        ok: true,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.createMap('test')).resolves.toBeUndefined();
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/maps', {
        method: 'POST',
        body: 'test',
        headers: {
          'Content-Type': MEDIA_TYPE_TEXT,
        },
      });
    });

    it('should throw error', async () => {
      const payload = {
        status: 400,
        instance: '/maps',
        title: 'Already exists',
        detail: 'Map already exists',
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.createMap('test')).rejects.toEqual(
        new ServiceApiError(payload)
      );
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/maps', {
        method: 'POST',
        body: 'test',
        headers: {
          'Content-Type': MEDIA_TYPE_TEXT,
        },
      });
    });
  });

  describe('parseMap', () => {
    it('should parse map', async () => {
      const mockResponse = {
        ok: true,
        text: async () => 'mapAst',
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.parseMap('mapSource')).resolves.toEqual('mapAst');
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/parse', {
        authenticate: false,
        method: 'POST',
        body: 'mapSource',
        headers: {
          'Content-Type': MEDIA_TYPE_MAP,
        },
      });
    });

    it('should throw error', async () => {
      const payload = {
        status: 500,
        instance: '/parse',
        title: 'Internal Server Exception',
        detail: 'Unknow parser error',
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.parseMap('mapSource')).rejects.toEqual(
        new ServiceApiError(payload)
      );
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/parse', {
        authenticate: false,
        method: 'POST',
        body: 'mapSource',
        headers: {
          'Content-Type': MEDIA_TYPE_MAP,
        },
      });
    });
  });

  describe('getMap', () => {
    it('should get one map', async () => {
      const mockResult: MapRevisionResponse = {
        map_id: 'testId',
        profile_name: 'testName',
        profile_version: '1.0.0',
        url: 'testUrl',
        published_at: new Date(),
        published_by: 'test',
        owner: 'testOwner',
        owner_url: 'testOwnerUrl',
        profile_url: 'testprofileUrl',
        map_revision: 'testRevision',
        map_provider: 'testProvider',
        map_provider_url: 'testProviderUrl',
        map_variant: 'testMapVariant',
      };

      const mockResponse = {
        ok: true,
        json: async () => mockResult,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(
        client.getMap('vcs', '1.0.0', 'user-repos', 'github')
      ).resolves.toEqual(mockResult);
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/vcs/user-repos.github@1.0.0', {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: MEDIA_TYPE_JSON,
        },
      });
    });

    it('should throw error', async () => {
      const payload = {
        status: 404,
        instance: '/vcs/user-repos.github@1.0.0',
        title: 'Not Found',
        detail: 'Map not found',
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(
        client.getMap('vcs', '1.0.0', 'user-repos', 'github')
      ).rejects.toEqual(new ServiceApiError(payload));
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/vcs/user-repos.github@1.0.0', {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: MEDIA_TYPE_JSON,
        },
      });
    });
  });
  describe('getMapSource', () => {
    it('should get map source', async () => {
      const mockResponse = {
        ok: true,
        text: async () => 'mapSource',
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(
        client.getMapSource('vcs', '1.0.0', 'user-repos', 'github')
      ).resolves.toEqual('mapSource');
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/vcs/user-repos.github@1.0.0', {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: MEDIA_TYPE_MAP,
        },
      });
    });

    it('should throw error', async () => {
      const payload = {
        status: 404,
        instance: '/vcs/user-repos.github@1.0.0',
        title: 'Not Found',
        detail: 'Map not found',
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(
        client.getMapSource('vcs', '1.0.0', 'user-repos', 'github')
      ).rejects.toEqual(new ServiceApiError(payload));
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/vcs/user-repos.github@1.0.0', {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: MEDIA_TYPE_MAP,
        },
      });
    });
  });

  describe('getMapAST', () => {
    it('should get map AST', async () => {
      const mockResponse = {
        ok: true,
        text: async () => 'mapAST',
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(
        client.getMapAST('vcs', '1.0.0', 'user-repos', 'github')
      ).resolves.toEqual('mapAST');
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/vcs/user-repos.github@1.0.0', {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: MEDIA_TYPE_MAP_AST,
        },
      });
    });

    it('should throw error', async () => {
      const payload = {
        status: 404,
        instance: '/vcs/user-repos.github@1.0.0',
        title: 'Not Found',
        detail: 'Map not found',
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(
        client.getMapAST('vcs', '1.0.0', 'user-repos', 'github')
      ).rejects.toEqual(new ServiceApiError(payload));
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/vcs/user-repos.github@1.0.0', {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: MEDIA_TYPE_MAP_AST,
        },
      });
    });
  });
  describe('signout', () => {
    it('signing out from all devices • should set `all` option in API call', async () => {
      const client = new ServiceClient({ baseUrl: BASE_URL });
      const mock = fetchMock.mockResponse('', { status: 204 });
      await client.signOut({ fromAllDevices: true });

      expect(mock).toHaveBeenCalledWith(`${BASE_URL}/auth/signout`, {
        body: '{"all":true}',
        method: 'DELETE',
      });
    });

    it('signing out from current session • should unset `all` option in API call', async () => {
      const client = new ServiceClient({ baseUrl: BASE_URL });
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
        await expect(() => client.signOut()).rejects.toEqual(
          new ServiceClientError("No session found, couldn't log out")
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
      await expect(() => client.signOut()).rejects.toEqual(
        new ServiceClientError("Couldn't log out due to unknown reasons")
      );
    });
  });
});
