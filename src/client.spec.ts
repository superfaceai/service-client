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
import { ServiceApiError, ServiceClientError } from './errors';
import {
  LoginConfirmationErrorCode,
  MapRevisionResponse,
  PerformStatisticsResponse,
  ProfileVersionResponse,
  ProviderResponse,
  SDKConfigResponse,
  SDKProviderChangesListResponse,
  SDKProviderChangeType,
} from './interfaces';
import { CancellationToken } from './interfaces/passwordless_verify_options';
import { VerificationStatus } from './interfaces/passwordless_verify_response';
import { ProjectUpdateBody } from './interfaces/projects_api_options';
import {
  ProjectResponse,
  ProjectsListResponse,
} from './interfaces/projects_api_response';

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
  });

  describe('logout', () => {
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

    describe('passwordlessLogin', () => {
      it('should send login email and return verify url with code expiration date when successful', async () => {
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

      it("should return unsuccess with response title & optionally detail when email doesn't exist", async () => {
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

    describe('verifyPasswordlessLogin', () => {
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

    describe('confirmPasswordlessLogin', () => {
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

      it(`should return success when API responds with status ${confirmedRes.status}`, async () => {
        fetchMock.mockResponse(JSON.stringify(confirmedRes), { status: 200 });

        const result = await client.confirmPasswordlessLogin(email, code);

        expect(result).toStrictEqual({ success: true });
      });

      it(`should return failure with code 'USED' when API responds with status 400 and title '${usedRes.title}'`, async () => {
        fetchMock.mockResponse(JSON.stringify(usedRes), { status: 400 });

        const result = await client.confirmPasswordlessLogin(email, code);

        expect(result).toStrictEqual({
          success: false,
          code: LoginConfirmationErrorCode.USED,
        });
      });

      it(`should return failure with code 'EXPIRED' when API responds with status 400 and title '${expiredRes.title}'`, async () => {
        fetchMock.mockResponse(JSON.stringify(expiredRes), { status: 400 });

        const result = await client.confirmPasswordlessLogin(email, code);

        expect(result).toStrictEqual({
          success: false,
          code: LoginConfirmationErrorCode.EXPIRED,
        });
      });

      it(`should return failure with code 'INVALID' when API responds with status 400 and title '${invalidRes.title}'`, async () => {
        fetchMock.mockResponse(JSON.stringify(invalidRes), { status: 400 });

        const result = await client.confirmPasswordlessLogin(email, code);

        expect(result).toStrictEqual({
          success: false,
          code: LoginConfirmationErrorCode.INVALID,
        });
      });

      it('should throw when API responds with unfamiliar response', async () => {
        fetchMock.mockResponse('500 Internal Server Error', { status: 500 });

        await expect(() =>
          client.confirmPasswordlessLogin(email, code)
        ).rejects.toEqual(
          new Error(
            'Cannot deserialize confirmation API response: FetchError: invalid json response body at  reason: Unexpected token I in JSON at position 4'
          )
        );
      });
    });
  });

  describe('getGithubLoginUrl', () => {
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

  describe('getProjectsList', () => {
    it('should find all projects', async () => {
      const mockResult: ProjectsListResponse = {
        url: '/projects',
        data: [
          {
            url: 'https://superface.test/projects/username/new-project',
            name: 'new-project',
            created_at: '2021-06-04T07:11:34.114Z',
          },
          {
            url: 'https://superface.test/projects/username/new-project-2',
            name: 'new-project-2',
            created_at: '2021-06-04T10:37:27.277Z',
          },
          {
            url: 'https://superface.test/projects/username/new-project-3',
            name: 'new-project-3',
            created_at: '2021-06-04T10:37:30.535Z',
          },
        ],
      };
      const mockResponse = {
        ok: true,
        json: async () => mockResult,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.getProjectsList()).resolves.toEqual(mockResult);
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/projects', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('getProject', () => {
    const owner = 'username';
    const name = 'project-name';

    it('should get a single project', async () => {
      const mockResult: ProjectResponse = {
        url: `https://superface.test/projects/${owner}/${name}`,
        name,
        sdk_auth_tokens: [
          {
            token: 't0k3n',
            created_at: '2021-06-04T07:11:34.114Z',
          },
        ],
        settings: {
          email_notifications: true,
        },
        created_at: '2021-06-04T07:11:34.114Z',
      };

      const mockResponse = {
        ok: true,
        json: async () => mockResult,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);

      await expect(client.getProject(owner, name)).resolves.toEqual(mockResult);

      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith(`/projects/${owner}/${name}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('should throw error', async () => {
      const payload = {
        status: 404,
        instance: `/projects/${owner}/${name}`,
        title: 'Not Found',
        detail: 'Project not found',
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);

      await expect(client.getProject(owner, name)).rejects.toEqual(
        new ServiceApiError(payload)
      );
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith(`/projects/${owner}/${name}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('updateProject', () => {
    const owner = 'username';
    const name = 'project-name';

    const projectUpdate: ProjectUpdateBody = {
      settings: { email_notifications: true },
    };

    it('should update project', async () => {
      const mockResult: ProjectResponse = {
        url: `https://superface.test/projects/${owner}/${name}`,
        name,
        sdk_auth_tokens: [
          {
            token: 't0k3n',
            created_at: '2021-06-04T07:11:34.114Z',
          },
        ],
        settings: {
          email_notifications: true,
        },
        created_at: '2021-06-04T07:11:34.114Z',
      };

      const mockResponse = {
        ok: true,
        json: async () => mockResult,
      };

      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);

      await expect(
        client.updateProject(owner, name, projectUpdate)
      ).resolves.toEqual(mockResult);

      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith(`/projects/${owner}/${name}`, {
        method: 'PATCH',
        body: JSON.stringify(projectUpdate),
        headers: { 'Content-Type': MEDIA_TYPE_JSON },
      });
    });

    it('should throw error', async () => {
      const payload = {
        status: 404,
        instance: `/projects/${owner}/${name}`,
        title: 'Not Found',
        detail: 'Project not found',
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);

      await expect(
        client.updateProject(owner, name, projectUpdate)
      ).rejects.toEqual(new ServiceApiError(payload));

      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith(`/projects/${owner}/${name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectUpdate),
      });
    });
  });

  describe('getSDKConfiguration', () => {
    const accountHandle = 'username';
    const projectName = 'project-name';
    const profile = 'communication/send-email';
    const providers = ['sendgrid', 'mailchimp'];

    it('should get SDK config', async () => {
      const mockResult: SDKConfigResponse = {
        updated_at: new Date().toISOString(),
        configuration_hash: 'h45h',
        configuration: {
          profiles: {
            [profile]: {
              version: '0.0.0',
              providers: providers.map((provider, i) => ({
                provider,
                version: '0.0.0',
                priority: i,
              })),
            },
          },
        },
      };

      const mockResponse = {
        ok: true,
        json: async () => mockResult,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);

      await expect(
        client.getSDKConfiguration(accountHandle, projectName)
      ).resolves.toEqual(mockResult);

      expect(fetchMock).toBeCalledTimes(1);
      expect(
        fetchMock
      ).toBeCalledWith(
        `/insights/sdk_config?account_handle=${accountHandle}&project_name=${projectName}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should throw error', async () => {
      const payload = {
        status: 400,
        instance: '/insights/sdk_config',
        title: 'Project not found',
        detail: `Project ${accountHandle}/${projectName} doesn't exist`,
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);

      await expect(
        client.getSDKConfiguration(accountHandle, projectName)
      ).rejects.toEqual(new ServiceApiError(payload));

      expect(fetchMock).toBeCalledTimes(1);

      expect(
        fetchMock
      ).toBeCalledWith(
        `/insights/sdk_config?account_handle=${accountHandle}&project_name=${projectName}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });
  });

  describe('getPerformStatistics', () => {
    const accountHandle = 'username';
    const projectName = 'project-name';
    const profile = 'communication/send-email';
    const providers = ['sendgrid', 'mailchimp'];
    const from = new Date('2021-05-23T00:00:00Z');
    const to = new Date('2021-05-25T00:00:00Z');
    const intervalMinutes = 1440;

    const expectedQueryParams = {
      from: from.toISOString(),
      to: to.toISOString(),
      interval_minutes: intervalMinutes,
      account_handle: accountHandle,
      project_name: projectName,
      profile,
      providers: providers.join(','),
    };

    const expectedUrlQuery = Object.entries(expectedQueryParams)
      .map(kv => kv.join('='))
      .join('&');

    it('should get capability perform statistics', async () => {
      const mockResult: PerformStatisticsResponse = {
        from: from.toISOString(),
        to: to.toISOString(),
        interval_minutes: intervalMinutes,
        account_handle: accountHandle,
        project_name: projectName,
        profile,
        statistics: providers.map(provider => ({
          provider,
          series: [
            {
              successful_performs: 0,
              failed_performs: 0,
              from: '2021-05-23T00:00:00.000Z',
              to: '2021-05-24T00:00:00.000Z',
            },
            {
              successful_performs: 0,
              failed_performs: 0,
              from: '2021-05-24T00:00:00.000Z',
              to: '2021-05-25T00:00:00.000Z',
            },
          ],
        })),
      };

      const mockResponse = {
        ok: true,
        json: async () => mockResult,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);

      await expect(
        client.getPerformStatistics(
          accountHandle,
          projectName,
          profile,
          providers,
          from,
          to,
          intervalMinutes
        )
      ).resolves.toEqual(mockResult);

      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith(
        `/insights/perform_statistics?${expectedUrlQuery}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    it('should throw error', async () => {
      const payload = {
        status: 400,
        instance: '/insights/perform_statistics',
        title: 'Project not found',
        detail: `Project ${accountHandle}/${projectName} doesn't exist`,
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);

      await expect(
        client.getPerformStatistics(
          accountHandle,
          projectName,
          profile,
          providers,
          from,
          to,
          intervalMinutes
        )
      ).rejects.toEqual(new ServiceApiError(payload));
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith(
        `/insights/perform_statistics?${expectedUrlQuery}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });
  });

  describe('getProviderChangesList', () => {
    const accountHandle = 'username';
    const projectName = 'project-name';
    const profile = 'communication/send-email';
    const providers = ['sendgrid', 'mailchimp'];
    const providerChangeTypes = [
      SDKProviderChangeType.Failover,
      SDKProviderChangeType.Recovery,
    ];
    const limit = 50;

    const expectedUrlQuery = Object.entries({
      account_handle: accountHandle,
      project_name: projectName,
      profile,
      from_providers: providers.join(','),
      provider_change_types: providerChangeTypes.join(','),
      limit,
    })
      .map(kv => kv.join('='))
      .join('&');

    const mockResult: SDKProviderChangesListResponse = {
      data: [
        {
          changed_at: new Date().toISOString(),
          change_type: SDKProviderChangeType.Failover,
          profile,
          from_provider: providers[0],
          to_provider: providers[1],
          failover_reasons: [
            {
              reason: '', // TODO
              occurred_at: new Date().toISOString(),
            },
          ],
        },
      ],
    };

    const mockResponse = {
      ok: true,
      json: async () => mockResult,
    };

    it('should not set optional query params if not provided', async () => {
      const expectedUrlQuery = Object.entries({
        account_handle: accountHandle,
        project_name: projectName,
        limit: 10, // default
      })
        .map(kv => kv.join('='))
        .join('&');

      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);

      await expect(
        client.getProviderChangesList(accountHandle, projectName)
      ).resolves.toEqual(mockResult);

      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith(
        `/insights/provider_changes?${expectedUrlQuery}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    it('should get list of provider changes', async () => {
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);

      await expect(
        client.getProviderChangesList(
          accountHandle,
          projectName,
          profile,
          providers,
          providerChangeTypes,
          limit
        )
      ).resolves.toEqual(mockResult);

      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith(
        `/insights/provider_changes?${expectedUrlQuery}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    it('should throw error', async () => {
      const payload = {
        status: 400,
        instance: '/insights/provider_changes',
        title: 'Project not found',
        detail: `Project ${accountHandle}/${projectName} doesn't exist`,
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);

      await expect(
        client.getProviderChangesList(
          accountHandle,
          projectName,
          profile,
          providers,
          providerChangeTypes,
          limit
        )
      ).rejects.toEqual(new ServiceApiError(payload));
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith(
        `/insights/provider_changes?${expectedUrlQuery}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });
  });

  describe('signOut', () => {
    it('should set `all` option in API call when signing out from all devices', async () => {
      const client = new ServiceClient({ baseUrl: BASE_URL });
      const mock = fetchMock.mockResponse('', { status: 204 });
      await client.signOut({ fromAllDevices: true });

      expect(mock).toHaveBeenCalledWith(`${BASE_URL}/auth/signout`, {
        body: '{"all":true}',
        method: 'DELETE',
      });
    });

    it('should not set `all` option in API call when signing out from current session', async () => {
      const client = new ServiceClient({ baseUrl: BASE_URL });
      const mock = fetchMock.mockResponse('', { status: 204 });
      await client.signOut();

      expect(mock).toHaveBeenCalledWith(`${BASE_URL}/auth/signout`, {
        body: '{"all":false}',
        method: 'DELETE',
      });
    });

    it('should return null & call internal `logout` method when server responds with 204', async () => {
      fetchMock.mockResponse('', { status: 204 });
      const logoutSpy = jest.spyOn(client, 'logout');
      const result = await client.signOut();

      expect(logoutSpy).toHaveBeenCalledTimes(1);
      expect(result).toBe(null);
    });

    const errorCodes = [401, 403];
    for (const errorCode of errorCodes) {
      it(`should throw when server responds with ${errorCode}`, async () => {
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

    it(`should throw unknown error when server responds with 500`, async () => {
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
