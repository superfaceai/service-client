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
import {
  CreateProfileApiError,
  CreateProviderApiError,
  ServiceApiError,
  ServiceClientError,
} from './errors';
import {
  AuthToken,
  CancellationToken,
  LoginConfirmationErrorCode,
  MapMinimalResponse,
  MapRevisionResponse,
  MapsListResponse,
  ProfileResponse,
  ProfilesListResponse,
  SDKConfigResponse,
  SDKPerformStatisticsResponse,
  SDKProviderChangesListResponse,
  SDKProviderChangeType,
} from './interfaces';
import {
  UserAccountType,
  UserResponse,
} from './interfaces/identity_api_response';
import { VerificationStatus } from './interfaces/login_api_response';
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

    it('should use internal base URL as default', async () => {
      client.setOptions({
        baseUrl: BASE_URL,
      });

      await client.fetch('/test', { authenticate: false });

      expect(fetchMock).toBeCalledWith(`${BASE_URL}/test`, {
        credentials: 'include',
        headers: {},
      });
    });

    it('should use custom base URL when one is provided', async () => {
      const customBaseUrl = 'https://custom.base.url.com';

      client.setOptions({
        baseUrl: BASE_URL, // this will not be used!
      });

      await client.fetch('/test', {
        authenticate: false,
        baseUrl: customBaseUrl,
      });

      expect(fetchMock).toBeCalledWith(`${customBaseUrl}/test`, {
        credentials: 'include',
        headers: {},
      });
    });

    it('should not require common headers', async () => {
      client.setOptions({
        baseUrl: BASE_URL,
        commonHeaders: undefined,
      });

      await client.fetch('/test', { authenticate: false });

      expect(fetchMock).toBeCalledWith(`${BASE_URL}/test`, {
        credentials: 'include',
        headers: {},
      });
    });

    it('should add common headers into request', async () => {
      client.setOptions({
        baseUrl: BASE_URL,
        commonHeaders: {
          'User-Agent': 'SuperfaceCLI/1.0',
        },
      });

      await client.fetch('/test', { authenticate: false });

      expect(fetchMock).toBeCalledWith(`${BASE_URL}/test`, {
        credentials: 'include',
        headers: {
          'User-Agent': 'SuperfaceCLI/1.0',
        },
      });
    });

    it('should add common headers into token request', async () => {
      client.setOptions({
        baseUrl: BASE_URL,
        commonHeaders: {
          'User-Agent': 'SuperfaceCLI/1.0',
        },
      });

      await client.fetch('/test', { authenticate: true });

      expect(fetchMock).toBeCalledWith(`${BASE_URL}/auth/token`, {
        credentials: 'include',
        headers: {
          'User-Agent': 'SuperfaceCLI/1.0',
          cookie: 'user_session=',
        },
        method: 'POST',
      });
    });

    it('should override common header with request specific header', async () => {
      client.setOptions({
        baseUrl: BASE_URL,
        commonHeaders: {
          Accept: 'application/json',
        },
      });

      await client.fetch('/test', {
        authenticate: false,
        headers: {
          Accept: 'application/json, application/problem+json',
        },
      });

      expect(fetchMock).toBeCalledWith(`${BASE_URL}/test`, {
        credentials: 'include',
        headers: {
          Accept: 'application/json, application/problem+json',
        },
      });
    });

    it('should override common authorization header with bearer authorization', async () => {
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
      client.setOptions({
        baseUrl: BASE_URL,
        commonHeaders: {
          Authorization: 'Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==',
        },
      });
      await client.fetch('/test');

      expect(fetchMock).toBeCalledWith(`${BASE_URL}/test`, {
        credentials: 'include',
        headers: {
          Authorization: 'Bearer AT',
        },
      });
    });
  });

  describe('login', () => {
    it('should login', async () => {
      await client.login({
        access_token: 'AT',
        token_type: 'Bearer',
        expires_in: 3600,
      });
      expect(client.isAccessTokenExpired()).toBe(false);
    });

    it('should call refresh token changed handler', async () => {
      const refreshTokenUpdatedHandlerMock = jest.fn();
      client = new ServiceClient({
        baseUrl: BASE_URL,
        refreshTokenUpdatedHandler: refreshTokenUpdatedHandlerMock,
      });

      await client.login({
        access_token: 'AT',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'RT',
      });
      expect(refreshTokenUpdatedHandlerMock).toBeCalledWith(BASE_URL, 'RT');
    });
  });

  describe('getAccessToken', () => {
    const stubToken: AuthToken = {
      access_token: 'AT',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'RT',
    };
    let result: AuthToken | null;
    const refreshAccessTokenMock = jest.fn().mockResolvedValue(stubToken);

    describe('when client is logged out (there is no token)', () => {
      beforeEach(async () => {
        result = await client.getAccessToken();
      });

      it('returns null', async () => {
        expect(result).toBe(null);
      });
    });

    describe('when client is logged in and token is valid', () => {
      beforeEach(async () => {
        await client.login(stubToken);
        client.refreshAccessToken = refreshAccessTokenMock;
        result = await client.getAccessToken();
      });

      it('returns token', async () => {
        expect(result).toStrictEqual(stubToken);
      });

      it("doesn't call refreshAccessToken", async () => {
        expect(refreshAccessTokenMock).toBeCalledTimes(0);
      });
    });

    describe('when client is logged in but token is expired', () => {
      beforeEach(async () => {
        await client.login({ ...stubToken, expires_in: -1 });
        client.refreshAccessToken = refreshAccessTokenMock;
        result = await client.getAccessToken();
      });

      it('calls refreshAccessToken', async () => {
        expect(refreshAccessTokenMock).toBeCalledTimes(1);
      });

      it('returns new token', async () => {
        expect(result).toStrictEqual(stubToken);
      });
    });
  });

  describe('logout', () => {
    it('should logout', async () => {
      await client.login({
        access_token: 'AT',
        token_type: 'Bearer',
        expires_in: 3600,
      });
      await client.logout();
      expect(client.isAccessTokenExpired()).toBe(true);
    });

    it('should call refresh token changed handler', async () => {
      const refreshTokenUpdatedHandlerMock = jest.fn();
      client = new ServiceClient({
        baseUrl: BASE_URL,
        refreshTokenUpdatedHandler: refreshTokenUpdatedHandlerMock,
      });

      await client.logout();
      expect(refreshTokenUpdatedHandlerMock).toBeCalledWith(BASE_URL, null);
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

      it('should return unsuccessful result when API responds with unfamiliar response (200 status code)', async () => {
        fetchMock.mockResponse('Text body instead of JSON', { status: 200 });

        const result = await client.passwordlessLogin('mail@mydomain.com');

        expect(result).toStrictEqual({
          success: false,
          title:
            'Cannot deserialize login API response: FetchError: invalid json response body at  reason: Unexpected token T in JSON at position 0',
        });
      });

      it('should return unsuccessful result when API responds with unfamiliar response (400 status code)', async () => {
        fetchMock.mockResponse('400 Bad Request', { status: 400 });

        const result = await client.passwordlessLogin('mail@mydomain.com');

        expect(result).toStrictEqual({
          success: false,
          title:
            'Cannot deserialize login API response: FetchError: invalid json response body at  reason: Unexpected token B in JSON at position 4',
        });
      });

      it('should send custom query parameters', async () => {
        await client.passwordlessLogin('mail@mydomain.com', 'register', {
          utm_content: 'test',
        });
        expect(fetchMock.mock.calls[0][0]).toBe(
          'https://superface.ai/auth/passwordless?mode=register&utm_content=test'
        );
      });
    });

    describe('verifyPasswordlessLogin', () => {
      let verifyLoginSpy: jest.SpyInstance;

      beforeEach(() => {
        //eslint-disable-next-line  @typescript-eslint/no-explicit-any
        verifyLoginSpy = jest.spyOn(client as any, 'verifyLogin');
        verifyLoginSpy.mockResolvedValue({
          verificationStatus: VerificationStatus.CONFIRMED,
        });
      });

      it('should call verifyLogin with verify url and options parameters', async () => {
        await client.verifyPasswordlessLogin(VERIFY_URL, {
          pollingIntervalSeconds: 10,
        });

        expect(verifyLoginSpy).toBeCalledWith(VERIFY_URL, {
          pollingIntervalSeconds: 10,
        });
      });

      it('should return verifyLogin result', async () => {
        await expect(
          client.verifyPasswordlessLogin(VERIFY_URL)
        ).resolves.toEqual({
          verificationStatus: VerificationStatus.CONFIRMED,
        });
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

  describe('cli login', () => {
    const VERIFY_URL = 'https://superface.test/cli/verify';
    const BROWSER_URL = 'https://superface.test/cli/confirm';
    const EXPIRES_AT = new Date('2021-04-13T12:08:27.103Z');

    describe('cliLogin', () => {
      it('should return verify and browser url with code expiration date', async () => {
        fetchMock.mockResponse(
          JSON.stringify({
            verify_url: VERIFY_URL,
            browser_url: BROWSER_URL,
            expires_at: EXPIRES_AT,
          }),
          { status: 201 }
        );
        const result = await client.cliLogin();
        expect(result).toStrictEqual({
          success: true,
          verifyUrl: VERIFY_URL,
          browserUrl: BROWSER_URL,
          expiresAt: EXPIRES_AT,
        });
      });

      it('should return unsuccess with response title', async () => {
        fetchMock.mockResponse(
          JSON.stringify({
            status: 500,
            instance: '/auth/cli',
            title: 'Internal server error',
          }),
          { status: 500 }
        );
        const result = await client.cliLogin();
        expect(result).toStrictEqual({
          success: false,
          title: 'Internal server error',
          detail: undefined,
        });
      });

      it('should return unsuccessful result when API responds with unfamiliar response (200 status code)', async () => {
        fetchMock.mockResponse('Text body instead of JSON', { status: 200 });

        const result = await client.cliLogin();

        expect(result).toStrictEqual({
          success: false,
          title:
            'Cannot deserialize login API response: FetchError: invalid json response body at  reason: Unexpected token T in JSON at position 0',
        });
      });

      it('should return unsuccessful result when API responds with unfamiliar response (400 status code)', async () => {
        fetchMock.mockResponse('400 Bad Request', { status: 400 });

        const result = await client.cliLogin();

        expect(result).toStrictEqual({
          success: false,
          title:
            'Cannot deserialize login API response: FetchError: invalid json response body at  reason: Unexpected token B in JSON at position 4',
        });
      });
    });

    describe('verifyCliLogin', () => {
      let verifyLoginSpy: jest.SpyInstance;

      beforeEach(() => {
        //eslint-disable-next-line  @typescript-eslint/no-explicit-any
        verifyLoginSpy = jest.spyOn(client as any, 'verifyLogin');
        verifyLoginSpy.mockResolvedValue({
          verificationStatus: VerificationStatus.CONFIRMED,
        });
      });

      it('should call verifyLogin with verify url and options parameters', async () => {
        await client.verifyPasswordlessLogin(VERIFY_URL, {
          pollingIntervalSeconds: 10,
        });

        expect(verifyLoginSpy).toBeCalledWith(VERIFY_URL, {
          pollingIntervalSeconds: 10,
        });
      });

      it('should return verifyLogin result', async () => {
        await expect(
          client.verifyPasswordlessLogin(VERIFY_URL)
        ).resolves.toEqual({
          verificationStatus: VerificationStatus.CONFIRMED,
        });
      });
    });

    describe('confirmCLILogin', () => {
      const code =
        '3d5665e8ff18a5c306c6df53bcc617d8b5923d7ea02b992b96f1773ec36ee152';

      const confirmedRes = { status: 'CONFIRMED' };

      const usedRes = {
        status: 400,
        instance: '/auth/cli/confirm',
        title: 'Token already confirmed',
        detail: `Code ${code} was already used to confirm login`,
      };

      const expiredRes = {
        status: 400,
        instance: '/auth/cli/confirm',
        title: 'Code is expired',
        detail: `Code ${code} is expired`,
      };

      it('should call /auth/cli/confirm using POST method', async () => {
        const fetchMock = jest.spyOn(client, 'fetch').mockResolvedValue({
          ok: true,
          json: async () => confirmedRes,
        } as Response);

        await client.confirmCliLogin(code);

        expect(fetchMock).toHaveBeenCalledWith(
          `/auth/cli/confirm?code=${code}`,
          {
            authenticate: true,
            method: 'POST',
            headers: { accept: 'application/json' },
          }
        );
      });

      it(`should return success when API responds with status ${confirmedRes.status}`, async () => {
        fetchMock.mockResponse(JSON.stringify(confirmedRes), { status: 200 });

        const result = await client.confirmCliLogin(code);

        expect(result).toStrictEqual({ success: true });
      });

      it(`should return failure with code 'USED' when API responds with status 400 and title '${usedRes.title}'`, async () => {
        fetchMock.mockResponse(JSON.stringify(usedRes), { status: 400 });

        const result = await client.confirmCliLogin(code);

        expect(result).toStrictEqual({
          success: false,
          code: LoginConfirmationErrorCode.USED,
        });
      });

      it(`should return failure with code 'EXPIRED' when API responds with status 400 and title '${expiredRes.title}'`, async () => {
        fetchMock.mockResponse(JSON.stringify(expiredRes), { status: 400 });

        const result = await client.confirmCliLogin(code);

        expect(result).toStrictEqual({
          success: false,
          code: LoginConfirmationErrorCode.EXPIRED,
        });
      });

      it('should throw when API responds with unfamiliar response', async () => {
        fetchMock.mockResponse('500 Internal Server Error', { status: 500 });

        await expect(() => client.confirmCliLogin(code)).rejects.toEqual(
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

    it('should return github login url with utm_source query prameter', () => {
      const returnTo = 'https://superface.dev/login/callback';
      expect(
        client.getGithubLoginUrl(returnTo, 'register', { utm_source: 'test' })
      ).toBe(
        `${BASE_URL}/auth/github?return_to=${encodeURIComponent(
          returnTo
        )}&mode=register&utm_source=test`
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

    it('should pass dry run query parameter', async () => {
      const mockResponse = {
        ok: true,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(
        client.createProvider('test', { dryRun: true })
      ).resolves.toBeUndefined();
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/providers?dry_run=true', {
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
        provider_json_equals: true,
        valid_provider_names: ['valid-provider-name'],
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.createProvider('test')).rejects.toEqual(
        new CreateProviderApiError(payload)
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

  describe('getProvidersList', () => {
    it('should find all providers', async () => {
      const mockResult = {
        url: '/providers',
        data: [
          {
            url: 'testUrl',
            name: 'testName',
            services: [{ id: 'default', baseUrl: 'http://superface.test/api' }],
            defaultService: 'default',
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
      await expect(client.getProvidersList()).resolves.toEqual({
        url: '/providers',
        data: [
          {
            provider_id: 'testName',
            url: 'testUrl',
            definition: {
              name: 'testName',
              services: [
                { id: 'default', baseUrl: 'http://superface.test/api' },
              ],
              defaultService: 'default',
            },
          },
        ],
      });
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/providers', {
        authenticate: false,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
    });

    it('should use query params to filter providers (if provided)', async () => {
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockReset()
        .mockResolvedValue({
          ok: true,
          json: async () => {
            return { url: '/providers', data: [] };
          },
        } as Response);

      await client.getProvidersList({
        profile: 'scope/profile-name',
        accountHandle: 'username',
        limit: 100,
      });

      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith(
        '/providers?profile=scope/profile-name&account_handle=username&limit=100',
        {
          authenticate: false,
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );
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
      await expect(client.getProvidersList()).rejects.toEqual(
        new ServiceApiError(payload)
      );
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/providers', {
        authenticate: false,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
    });
  });

  describe('getProvider', () => {
    it('should get provider in flat format', async () => {
      const mockResult = {
        url: 'testUrl',
        name: 'testName',
        services: [{ id: 'default', baseUrl: 'http://superface.test/api' }],
        defaultService: 'default',
      };

      const mockResponse = {
        ok: true,
        json: async () => mockResult,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.getProvider('test')).resolves.toStrictEqual({
        provider_id: 'testName',
        url: 'testUrl',
        definition: {
          name: 'testName',
          services: [{ id: 'default', baseUrl: 'http://superface.test/api' }],
          defaultService: 'default',
        },
      });
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/providers/test', {
        authenticate: false,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
    });

    it('should get provider in nested format', async () => {
      const mockResult = {
        provider_id: 'testName',
        url: 'testUrl',
        owner: 'superface',
        owner_url: 'ownerUrl',
        published_at: new Date(),
        published_by: 'John Doe <john.doe@email.com>',
        definition: {
          name: 'testName',
          services: [{ id: 'default', baseUrl: 'http://superface.test/api' }],
          defaultService: 'default',
        },
      };

      const mockResponse = {
        ok: true,
        json: async () => mockResult,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.getProvider('test')).resolves.toStrictEqual(
        mockResult
      );
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/providers/test', {
        authenticate: false,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
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
      await expect(client.getProvider('test')).rejects.toEqual(
        new ServiceApiError(payload)
      );
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/providers/test', {
        authenticate: false,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
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

    it('should pass dry run query parameter', async () => {
      const mockResponse = {
        ok: true,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(
        client.createProfile('test', { dryRun: true })
      ).resolves.toBeUndefined();
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/profiles?dry_run=true', {
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
        content_is_equal: true,
        suggested_version: '2.0.0',
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.createProfile('test')).rejects.toEqual(
        new CreateProfileApiError(payload)
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
    const mockResult: ProfileResponse = {
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

    it('should get one profile', async () => {
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(
        client.getProfile({
          name: 'user-repos',
          version: '1.0.0',
          scope: 'vcs',
        })
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

    it('should authenticate user', async () => {
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await client.getProfile(
        {
          name: 'user-repos',
          version: '1.0.0',
          scope: 'vcs',
        },
        {
          authenticate: true,
        }
      );
      expect(fetchMock).toBeCalledWith('/vcs/user-repos@1.0.0', {
        authenticate: true,
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
        client.getProfile({
          name: 'user-repos',
          version: '1.0.0',
          scope: 'vcs',
        })
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

  describe('getProfilesList', () => {
    const mockResult: ProfilesListResponse = {
      url: '/profiles',
      data: [
        {
          profile_id: 'scope/profile-name',
          profile_name: 'Profile Name',
          profile_description: 'This is profile for unit test',
          profile_version: '1.0.1',
          url: 'https://superface.test/scope/profile-name',
          published_at: new Date('2022-04-05T06:36:01.854Z'),
          published_by: 'Test User <test@superface.ai>',
          owner: 'testaccount',
          owner_url: '',
        },
      ],
    };
    const mockResponse = {
      ok: true,
      json: async () => mockResult,
    };

    it('should get list of profiles', async () => {
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.getProfilesList()).resolves.toEqual(mockResult);
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/profiles', {
        authenticate: false,
        method: 'GET',
        headers: { Accept: MEDIA_TYPE_JSON },
      });
    });

    it('should use query params to filter profiles (if provided)', async () => {
      const fetchMock = jest.spyOn(client, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      } as Response);

      await client.getProfilesList({
        accountHandle: 'username',
        scope: 'test',
        limit: 100,
        page: 2,
      });

      expect(fetchMock).toBeCalledWith(
        '/profiles?account_handle=username&scope=test&page=2&limit=100',
        {
          authenticate: false,
          method: 'GET',
          headers: { Accept: MEDIA_TYPE_JSON },
        }
      );
    });

    it('should authenticate user', async () => {
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await client.getProfilesList({ authenticate: true });
      expect(fetchMock).toBeCalledWith('/profiles', {
        authenticate: true,
        method: 'GET',
        headers: { Accept: MEDIA_TYPE_JSON },
      });
    });

    it('should throw error', async () => {
      const payload = {
        status: 400,
        instance: '/profiles',
        title: 'Bad Request',
        detail: 'limit must not be greater than 100',
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.getProfilesList({ limit: 101 })).rejects.toEqual(
        new ServiceApiError(payload)
      );
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/profiles?limit=101', {
        authenticate: false,
        method: 'GET',
        headers: { Accept: MEDIA_TYPE_JSON },
      });
    });
  });

  describe('getProfileSource', () => {
    const mockResponse = {
      ok: true,
      text: async () => 'profileSource',
    };

    it('should get profile source', async () => {
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(
        client.getProfileSource({
          name: 'user-repos',
          version: '1.0.0',
          scope: 'vcs',
        })
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

    it('should authenticate user', async () => {
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await client.getProfileSource(
        {
          name: 'user-repos',
          version: '1.0.0',
          scope: 'vcs',
        },
        { authenticate: true }
      );
      expect(fetchMock).toBeCalledWith('/vcs/user-repos@1.0.0', {
        authenticate: true,
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
        client.getProfileSource({
          name: 'user-repos',
          version: '1.0.0',
          scope: 'vcs',
        })
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
    const mockResponse = {
      ok: true,
      text: async () => 'profileAST',
    };

    it('should get profile AST', async () => {
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(
        client.getProfileAST({
          name: 'user-repos',
          version: '1.0.0',
          scope: 'vcs',
        })
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

    it('should authenticate user', async () => {
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await client.getProfileAST(
        {
          name: 'user-repos',
          version: '1.0.0',
          scope: 'vcs',
        },
        { authenticate: true }
      );
      expect(fetchMock).toBeCalledWith('/vcs/user-repos@1.0.0', {
        authenticate: true,
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
        client.getProfileAST({
          name: 'user-repos',
          version: '1.0.0',
          scope: 'vcs',
        })
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

    it('should pass dry run query parameter', async () => {
      const mockResponse = {
        ok: true,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(
        client.createMap('test', { dryRun: true })
      ).resolves.toBeUndefined();
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/maps?dry_run=true', {
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
        client.getMap({
          name: 'user-repos',
          provider: 'github',
          scope: 'vcs',
          version: '1.0.0',
        })
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
        client.getMap({
          name: 'user-repos',
          provider: 'github',
          scope: 'vcs',
          version: '1.0.0',
        })
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

  describe('getMapsList', () => {
    it('should get list of maps', async () => {
      const mockResult: MapsListResponse = {
        url: '/maps',
        data: [
          {
            map_id: 'scope/profile-name.provider.generated@1.0',
            map_provider: 'provider',
            map_provider_url: 'https://superface.test/providers/provider',
            map_revision: '0',
            map_variant: 'generated',
            owner: 'testuser',
            owner_url: '',
            profile_name: 'scope/profile-name',
            profile_url: 'https://superface.test/scope/profile-name@1.0.0',
            profile_version: '1.0.0',
            url: 'https://superface.test/scope/profile-name.provider.generated@1.0',
            published_at: new Date(),
            published_by: 'Test User <test@superface.ai>',
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

      await expect(client.getMapsList()).resolves.toEqual(mockResult);

      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/maps', {
        authenticate: false,
        method: 'GET',
        headers: { Accept: MEDIA_TYPE_JSON },
      });
    });

    it('should support minimal map list response', async () => {
      const mockResult: { url: string; data: MapMinimalResponse[] } = {
        url: '/maps',
        data: [
          {
            id: 'scope/profile-name.provider.generated@1.0',
            url: 'https://superface.test/scope/profile-name.provider.generated@1.0',
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

      await expect(client.getMapsList()).resolves.toEqual({
        url: '/maps',
        data: [
          {
            map_id: 'scope/profile-name.provider.generated@1.0',
            map_provider: '',
            map_provider_url: '',
            map_revision: '',
            map_variant: null,
            profile_name: '',
            profile_url: '',
            profile_version: '',
            url: 'https://superface.test/scope/profile-name.provider.generated@1.0',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            published_at: expect.any(Date),
            published_by: '',
            owner: '',
            owner_url: '',
          },
        ],
      });

      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/maps', {
        authenticate: false,
        method: 'GET',
        headers: { Accept: MEDIA_TYPE_JSON },
      });
    });

    it('should use query params to filter maps (if provided)', async () => {
      const fetchMock = jest.spyOn(client, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => {
          return { url: '/maps', data: [] };
        },
      } as Response);

      await client.getMapsList({
        accountHandle: 'username',
        limit: 100,
        profile: 'profile-name',
      });

      expect(fetchMock).toBeCalledWith(
        '/maps?account_handle=username&limit=100&profile=profile-name',
        {
          authenticate: false,
          method: 'GET',
          headers: { Accept: MEDIA_TYPE_JSON },
        }
      );
    });

    it('should throw error', async () => {
      const payload = {
        status: 400,
        instance: '/maps',
        title: 'Bad Request',
        detail: 'limit must not be greater than 100',
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);
      await expect(client.getMapsList({ limit: 101 })).rejects.toEqual(
        new ServiceApiError(payload)
      );
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith('/maps?limit=101', {
        authenticate: false,
        method: 'GET',
        headers: { Accept: MEDIA_TYPE_JSON },
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
        client.getMapSource({
          name: 'user-repos',
          provider: 'github',
          version: '1.0.0',
          scope: 'vcs',
        })
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
        client.getMapSource({
          name: 'user-repos',
          provider: 'github',
          version: '1.0.0',
          scope: 'vcs',
        })
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
        client.getMapAST({
          name: 'user-repos',
          provider: 'github',
          version: '1.0.0',
          scope: 'vcs',
        })
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
        client.getMapAST({
          name: 'user-repos',
          provider: 'github',
          scope: 'vcs',
          version: '1.0.0',
        })
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
        headers: { 'Accept': 'application/json' },
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
        headers: { 'Accept': 'application/json' },
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
          'Accept': 'application/json',
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

  describe('createProject', () => {
    const name = 'project-name';

    const expectedPayload = {
      name,
    };

    it('should create project', async () => {
      const mockResult: ProjectResponse = {
        url: `https://superface.test/projects/test-user/${name}`,
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

      await expect(client.createProject(name)).resolves.toEqual(mockResult);

      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith(`/projects`, {
        authenticate: true,
        method: 'POST',
        body: JSON.stringify(expectedPayload),
        headers: { 'Content-Type': MEDIA_TYPE_JSON },
      });
    });

    it('should throw error', async () => {
      const payload = {
        status: 422,
        instance: `/projects`,
        title: 'Project already exists',
        detail: `Project with name '${name}' already exists.`,
      };
      const mockResponse = {
        ok: false,
        json: async () => payload,
      };
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);

      await expect(client.createProject(name)).rejects.toEqual(
        new ServiceApiError(payload)
      );

      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith(`/projects`, {
        authenticate: true,
        method: 'POST',
        headers: { 'Content-Type': MEDIA_TYPE_JSON },
        body: JSON.stringify(expectedPayload),
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
      expect(fetchMock).toBeCalledWith(
        `/insights/sdk_config?account_handle=${accountHandle}&project_name=${projectName}`,
        { method: 'GET', headers: { 'Accept': 'application/json' } }
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

      expect(fetchMock).toBeCalledWith(
        `/insights/sdk_config?account_handle=${accountHandle}&project_name=${projectName}`,
        { method: 'GET', headers: { 'Accept': 'application/json' } }
      );
    });
  });

  describe('getSDKPerformStatistics', () => {
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
      const mockResult: SDKPerformStatisticsResponse = {
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
        client.getSDKPerformStatistics(
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
          headers: { 'Accept': 'application/json' },
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
        client.getSDKPerformStatistics(
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
          headers: { 'Accept': 'application/json' },
        }
      );
    });
  });

  describe('getSDKProviderChangesList', () => {
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
              reason: 'HTTP_ERROR_500',
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
        client.getSDKProviderChangesList(accountHandle, projectName)
      ).resolves.toEqual(mockResult);

      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock).toBeCalledWith(
        `/insights/provider_changes?${expectedUrlQuery}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        }
      );
    });

    it('should get list of provider changes', async () => {
      const fetchMock = jest
        .spyOn(client, 'fetch')
        .mockResolvedValue(mockResponse as Response);

      await expect(
        client.getSDKProviderChangesList(
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
          headers: { 'Accept': 'application/json' },
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
        client.getSDKProviderChangesList(
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
          headers: { 'Accept': 'application/json' },
        }
      );
    });
  });

  describe('signOut', () => {
    beforeEach(async () => {
      client = new ServiceClient({ baseUrl: BASE_URL });

      await client.login({
        access_token: 'AT',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'RT',
      });
    });

    it('should set `all` option in API call when signing out from all devices', async () => {
      const mock = fetchMock.mockResponse('', { status: 204 });

      await client.signOut({ fromAllDevices: true });

      expect(mock).toHaveBeenCalledWith(`${BASE_URL}/auth/signout`, {
        body: '{"all":true}',
        method: 'DELETE',
        credentials: 'include',
        headers: {
          cookie: 'user_session=RT',
        },
      });
    });

    it('should not set `all` option in API call when signing out from current session', async () => {
      const mock = fetchMock.mockResponse('', { status: 204 });
      await client.signOut();

      expect(mock).toHaveBeenCalledWith(`${BASE_URL}/auth/signout`, {
        body: '{"all":false}',
        method: 'DELETE',
        credentials: 'include',
        headers: {
          cookie: 'user_session=RT',
        },
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

  describe('#verifyLogin', () => {
    const VERIFY_URL = 'https://superface.test/passwordless/verify';
    describe('for confirmed token', () => {
      const authToken = {
        access_token: 'AT',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'RT',
      };
      beforeEach(() => {
        fetchMock.mockResponse(JSON.stringify(authToken), {
          status: 200,
        });
      });

      it('should return authToken', async () => {
        const result = await client['verifyLogin'](VERIFY_URL);
        expect(result.authToken).toEqual(authToken);
      });

      it('should return verificationStatus = CONFIRMED', async () => {
        const result = await client['verifyLogin'](VERIFY_URL);
        expect(result.verificationStatus).toBe(VerificationStatus.CONFIRMED);
      });

      it('should call login mock', async () => {
        const loginMock = jest.spyOn(client, 'login');
        await client['verifyLogin'](VERIFY_URL);
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
      const result = await client['verifyLogin'](VERIFY_URL, {
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
      const result = await client['verifyLogin'](VERIFY_URL);
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
      const result = await client['verifyLogin'](VERIFY_URL);
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
      await expect(client['verifyLogin'](VERIFY_URL)).rejects.toThrow();
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
      await client['verifyLogin'](VERIFY_URL, {
        pollingTimeoutSeconds: pollingTimeoutSeconds,
      });
      expect(new Date().getTime() - testStart.getTime()).toBeGreaterThanOrEqual(
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
      const resultPromise = client['verifyLogin'](VERIFY_URL, {
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

      await client['verifyLogin'](VERIFY_URL, {
        pollingTimeoutSeconds: 2,
        cancellationToken,
      });

      expect(cancelCallback).toBeCalled();
    });
  });

  describe('getUserInfo', () => {
    const mockResult: UserResponse = {
      name: 'john.doe',
      email: 'john.doe@example.com',
      accounts: [
        {
          handle: 'johndoe',
          type: UserAccountType.PERSONAL,
        },
      ],
    };

    const mockResponse = {
      ok: true,
      json: async () => mockResult,
    };

    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
      fetchSpy = jest.spyOn(client, 'fetch');
    });

    it('should call fetch with correct parameters', async () => {
      fetchSpy.mockResolvedValue(mockResponse as Response);

      await client.getUserInfo();

      expect(fetchSpy).toBeCalledWith('/id/user', {
        headers: { 'Accept': 'application/json' },
        method: 'GET',
      });
    });

    it('should return user', async () => {
      fetchSpy.mockResolvedValue(mockResponse as Response);

      await expect(client.getUserInfo()).resolves.toEqual(mockResult);
    });

    it('should throw error', async () => {
      const mockErrorResponse = {
        ok: false,
        json: async () => 'Internal server error',
      };

      fetchSpy.mockResolvedValue(mockErrorResponse as Response);

      await expect(client.getUserInfo()).rejects.toThrowError(ServiceApiError);
    });
  });

  describe('shareProfile', () => {
    const mockResponse = {
      ok: true,
    };

    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
      fetchSpy = jest.spyOn(client, 'fetch');
    });

    it('should call fetch with correct parameters', async () => {
      fetchSpy.mockResolvedValue(mockResponse as Response);

      await client.shareProfile(
        'starwars/character-information',
        'test@example.com'
      );

      expect(fetchSpy).toBeCalledWith('/share/profile', {
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        body: JSON.stringify({
          profile_id: 'starwars/character-information',
          email: 'test@example.com',
        }),
      });
    });

    it('should throw error', async () => {
      const mockErrorResponse = {
        ok: false,
        json: async () => 'Internal server error',
      };

      fetchSpy.mockResolvedValue(mockErrorResponse as Response);

      await expect(client.getUserInfo()).rejects.toThrowError(ServiceApiError);
    });
  });
});
