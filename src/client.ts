/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as crossfetch from 'cross-fetch';

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
  ClientOptions,
  DEFAULT_POLLING_INTERVAL_SECONDS,
  DEFAULT_POLLING_TIMEOUT_SECONDS,
  isMapMinimalReponse,
  isProfileMinimalReponse,
  MapCreateOptions,
  MapResponse,
  MapRevisionResponse,
  MapsListOptions,
  MapsListResponse,
  ProfileCreateOptions,
  ProfileId,
  ProfileOptions,
  ProfileResponse,
  ProfilesListOptions,
  ProfilesListResponse,
  ProviderCreateOptions,
  ProviderListResponse,
  ProviderResponse,
  ProvidersListOptions,
  RefreshAccessTokenOptions,
  RefreshTokenUpdatedHandler,
  SDKConfigResponse,
  SDKPerformStatisticsResponse,
  SDKProviderChangesListResponse,
  SDKProviderChangeType,
  ServiceApiErrorResponse,
  VerificationStatus,
  VerifyErrorResponse,
  VerifyOptions,
  VerifyResponse,
} from './interfaces';
import { CreateProfileApiErrorResponse } from './interfaces/create_profile_api_error_response';
import { CreateProviderApiErrorResponse } from './interfaces/create_provider_api_error_response';
import { UserResponse } from './interfaces/identity_api_response';
import {
  CLILoginResponse,
  LoginConfirmationErrorCode,
  LoginConfirmResponse,
  PasswordlessLoginResponse,
  UnsuccessfulLogin,
} from './interfaces/login_api_response';
import { MapId } from './interfaces/map_id';
import { ProjectUpdateBody } from './interfaces/projects_api_options';
import {
  ProjectResponse,
  ProjectsListResponse,
} from './interfaces/projects_api_response';
import { buildMapUrl } from './utils/buildMapUrl';
import { buildProfileUrl } from './utils/buildProfileUrl';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface ClientStorage {
  baseUrl?: string;
  authToken?: AuthToken;
  authTokenExpiresAt?: number;
  refreshToken?: string;
  commonHeaders?: Record<string, string>;
  refreshTokenUpdatedHandler?: RefreshTokenUpdatedHandler;
}

type FetchOptions = { authenticate?: boolean };
type RequestOptions = RequestInit & FetchOptions;

export class ServiceClient {
  private _STORAGE: ClientStorage = {
    baseUrl: 'https://superface.ai',
  };

  constructor({
    baseUrl,
    refreshToken,
    commonHeaders,
    refreshTokenUpdatedHandler,
  }: ClientOptions = {}) {
    this.setOptions({
      baseUrl,
      refreshToken,
      commonHeaders,
      refreshTokenUpdatedHandler,
    });
  }

  public setOptions({
    baseUrl,
    refreshToken,
    commonHeaders,
    refreshTokenUpdatedHandler,
  }: ClientOptions): void {
    if (baseUrl) {
      this._STORAGE.baseUrl = baseUrl;
    }

    if (refreshToken) {
      this._STORAGE.refreshToken = refreshToken;
    }

    if (commonHeaders) {
      this._STORAGE.commonHeaders = commonHeaders;
    }

    this._STORAGE.refreshTokenUpdatedHandler = refreshTokenUpdatedHandler;
  }

  public async login(authToken: AuthToken): Promise<void> {
    const currentTime = this.getCurrentTime();

    const refreshToken =
      this._STORAGE.authToken?.refresh_token || this._STORAGE.refreshToken;
    const newRefreshToken = authToken.refresh_token;

    this._STORAGE.authTokenExpiresAt = currentTime + authToken.expires_in;
    this._STORAGE.authToken = authToken;

    if (
      this._STORAGE.refreshTokenUpdatedHandler &&
      this._STORAGE.baseUrl &&
      newRefreshToken &&
      refreshToken !== newRefreshToken
    ) {
      await this._STORAGE.refreshTokenUpdatedHandler(
        this._STORAGE.baseUrl,
        newRefreshToken
      );
    }
  }

  public async logout(): Promise<void> {
    this._STORAGE.authToken = undefined;
    this._STORAGE.authTokenExpiresAt = undefined;
    this._STORAGE.refreshToken = undefined;

    if (this._STORAGE.refreshTokenUpdatedHandler && this._STORAGE.baseUrl) {
      await this._STORAGE.refreshTokenUpdatedHandler(
        this._STORAGE.baseUrl,
        null
      );
    }
  }

  public isAccessTokenExpired(): boolean {
    const { authToken, authTokenExpiresAt } = this._STORAGE;

    if (!authToken) {
      return true;
    }

    const currentTime = this.getCurrentTime();
    if (!!authTokenExpiresAt && currentTime >= authTokenExpiresAt) {
      return true;
    }

    return false;
  }

  public async refreshAccessToken(
    options?: RefreshAccessTokenOptions
  ): Promise<AuthToken | null> {
    const cookie = this.getRefreshTokenCookie(options);

    if (!this._STORAGE.baseUrl) {
      throw new ServiceClientError(
        'Client is not initialized, baseUrl not configured'
      );
    }

    const init = {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...this._STORAGE.commonHeaders,
        cookie,
      },
    } as RequestInit;

    const res = await crossfetch.fetch(
      `${this._STORAGE.baseUrl}/auth/token`,
      init
    );

    if (res.status !== 201) {
      return null;
    }

    const authToken = (await res.json()) as AuthToken;
    await this.login(authToken);

    return authToken;
  }

  public async fetch(
    url: string,
    opts: RequestOptions = {}
  ): Promise<Response> {
    const useAuthentication = opts.authenticate ?? true;
    if ('authenticate' in opts) delete opts['authenticate'];

    if (useAuthentication && this.isAccessTokenExpired()) {
      // Try to get access token
      await this.refreshAccessToken();
    }

    const _fetch = () => {
      opts.headers = Object.assign(
        {},
        this._STORAGE.commonHeaders,
        opts.headers,
        useAuthentication && {
          Authorization: `Bearer ${this._STORAGE.authToken?.access_token}`,
        }
      );
      opts.credentials = 'include';

      return crossfetch.fetch(`${this._STORAGE.baseUrl}${url}`, opts);
    };

    let res = await _fetch();

    if (useAuthentication && [401, 403].includes(res.status)) {
      await this.refreshAccessToken();
      res = await _fetch();
    }

    return res;
  }

  async createProvider(
    payload: string,
    options?: ProviderCreateOptions
  ): Promise<void> {
    const url = this.makePathWithQueryParams('/providers', {
      dry_run: options?.dryRun,
    });

    const response: Response = await this.fetch(url, {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    await this.unwrap<CreateProviderApiErrorResponse>(
      response,
      errorResponse => {
        throw new CreateProviderApiError(errorResponse);
      }
    );
  }

  async getProvidersList(
    options?: ProvidersListOptions
  ): Promise<ProviderListResponse> {
    const { profile, accountHandle, limit } = options || {};

    const url = this.makePathWithQueryParams('/providers', {
      profile,
      account_handle: accountHandle,
      limit,
    });

    const response: Response = await this.fetch(url, {
      authenticate: false,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    await this.unwrap(response);

    return this.mapProvidersListResponse(await response.json());
  }

  async getProvider(name: string): Promise<ProviderResponse> {
    const response: Response = await this.fetch(`/providers/${name}`, {
      authenticate: false,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    await this.unwrap(response);

    return this.mapProviderResponse(await response.json());
  }

  async createProfile(
    payload: string,
    options?: ProfileCreateOptions
  ): Promise<void> {
    const url = this.makePathWithQueryParams('/profiles', {
      dry_run: options?.dryRun,
    });

    const response: Response = await this.fetch(url, {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': MEDIA_TYPE_TEXT,
      },
    });
    await this.unwrap<CreateProfileApiErrorResponse>(
      response,
      errorResponse => {
        throw new CreateProfileApiError(errorResponse);
      }
    );
  }

  async parseProfile(payload: string): Promise<string> {
    const response: Response = await this.fetch('/parse', {
      authenticate: false,
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': MEDIA_TYPE_PROFILE,
      },
    });

    return (await this.unwrap(response)).text();
  }

  async getProfile(
    profileId: ProfileId,
    options?: ProfileOptions
  ): Promise<ProfileResponse> {
    const response: Response = await this.fetch(buildProfileUrl(profileId), {
      authenticate: options?.authenticate ?? false,
      method: 'GET',
      headers: {
        Accept: MEDIA_TYPE_JSON,
      },
    });
    await this.unwrap(response);

    return (await response.json()) as ProfileResponse;
  }

  async getProfileSource(
    profileId: ProfileId,
    options?: ProfileOptions
  ): Promise<string> {
    const response: Response = await this.fetch(buildProfileUrl(profileId), {
      authenticate: options?.authenticate ?? false,
      method: 'GET',
      headers: {
        Accept: MEDIA_TYPE_PROFILE,
      },
    });

    return (await this.unwrap(response)).text();
  }

  async getProfileAST(
    profileId: ProfileId,
    options?: ProfileOptions
  ): Promise<string> {
    const response: Response = await this.fetch(buildProfileUrl(profileId), {
      authenticate: options?.authenticate ?? false,
      method: 'GET',
      headers: {
        Accept: MEDIA_TYPE_PROFILE_AST,
      },
    });

    return (await this.unwrap(response)).text();
  }

  async getProfilesList(
    options?: ProfilesListOptions
  ): Promise<ProfilesListResponse> {
    const { accountHandle, limit, page, scope } = options || {};

    const url = this.makePathWithQueryParams('/profiles', {
      account_handle: accountHandle,
      scope,
      page,
      limit,
    });

    const response: Response = await this.fetch(url, {
      authenticate: options?.authenticate ?? false,
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    await this.unwrap(response);
    const json = await response.json();

    return {
      ...json,
      data: json.data.map((profile: unknown) => {
        if (isProfileMinimalReponse(profile)) {
          return {
            profile_id: profile.id,
            profile_name: profile.id,
            profile_version: '0.0.0',
            url: profile.url,
            published_at: new Date(),
            published_by: '',
            owner: '',
            owner_url: '',
          } as ProfileResponse;
        } else {
          return profile;
        }
      }),
    } as ProfilesListResponse;
  }

  async createMap(payload: string, options?: MapCreateOptions): Promise<void> {
    const url = this.makePathWithQueryParams('/maps', {
      dry_run: options?.dryRun,
    });

    const response: Response = await this.fetch(url, {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': MEDIA_TYPE_TEXT,
      },
    });

    await this.unwrap(response);
  }

  async parseMap(payload: string): Promise<string> {
    const response: Response = await this.fetch('/parse', {
      authenticate: false,
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': MEDIA_TYPE_MAP,
      },
    });

    return (await this.unwrap(response)).text();
  }

  async getMap(mapId: MapId): Promise<MapRevisionResponse> {
    const url = buildMapUrl(mapId);
    const response: Response = await this.fetch(url, {
      authenticate: false,
      method: 'GET',
      headers: {
        Accept: MEDIA_TYPE_JSON,
      },
    });

    await this.unwrap(response);

    return (await response.json()) as MapRevisionResponse;
  }

  async getMapSource(mapId: MapId): Promise<string> {
    const url = buildMapUrl(mapId);
    const response: Response = await this.fetch(url, {
      authenticate: false,
      method: 'GET',
      headers: {
        Accept: MEDIA_TYPE_MAP,
      },
    });

    return (await this.unwrap(response)).text();
  }

  async getMapAST(mapId: MapId): Promise<string> {
    const url = buildMapUrl(mapId);
    const response: Response = await this.fetch(url, {
      authenticate: false,
      method: 'GET',
      headers: {
        Accept: MEDIA_TYPE_MAP_AST,
      },
    });

    return (await this.unwrap(response)).text();
  }

  async getMapsList(options?: MapsListOptions): Promise<MapsListResponse> {
    const { accountHandle, limit, profile } = options || {};

    const url = this.makePathWithQueryParams('/maps', {
      account_handle: accountHandle,
      limit,
      profile: profile,
    });

    const response: Response = await this.fetch(url, {
      authenticate: false,
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    await this.unwrap(response);
    const json = await response.json();

    return {
      ...json,
      data: json.data.map((map: unknown) => {
        if (isMapMinimalReponse(map)) {
          return {
            map_id: map.id,
            map_provider: '',
            map_provider_url: '',
            map_revision: '',
            map_variant: null,
            profile_name: '',
            profile_url: '',
            profile_version: '',
            url: map.url,
            published_at: new Date(),
            published_by: '',
            owner: '',
            owner_url: '',
          } as MapResponse;
        } else {
          return map;
        }
      }),
    } as MapsListResponse;
  }

  public async passwordlessLogin(
    email: string,
    mode: 'login' | 'register' = 'login',
    customQueryParams: Record<string, any> = {}
  ): Promise<PasswordlessLoginResponse> {
    const url = new URL(`${this._STORAGE.baseUrl}/auth/passwordless`);
    url.search = new URLSearchParams({ mode, ...customQueryParams }).toString();

    const response: Response = await crossfetch.fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
      }),
    });
    if (response.status === 200) {
      const apiResponse = await this.tryParseLoginResponseJson<{
        verify_url: string;
        expires_at: string;
      }>(response);

      if (apiResponse.error) {
        return apiResponse.error;
      }

      const { verify_url, expires_at } = apiResponse.json || {};

      if (verify_url && expires_at) {
        return {
          success: true,
          verifyUrl: verify_url,
          expiresAt: new Date(expires_at),
        };
      } else {
        return { success: false, title: 'Unexpected API response' };
      }
    } else if (response.status === 400) {
      const apiResponse = await this.tryParseLoginResponseJson<{
        title: string;
        detail: string;
      }>(response);

      if (apiResponse.error) {
        return apiResponse.error;
      }

      const { title, detail } = apiResponse.json || {};
      if (title) {
        return { success: false, title, detail };
      } else {
        return { success: false, title: 'Unexpected API response' };
      }
    } else {
      return {
        success: false,
        title: `Unexpected status code ${response.status} received`,
      };
    }
  }

  public async verifyPasswordlessLogin(
    verifyUrl: string,
    options?: VerifyOptions
  ): Promise<VerifyResponse> {
    return this.verifyLogin(verifyUrl, options);
  }

  public async confirmPasswordlessLogin(
    email: string,
    code: string
  ): Promise<LoginConfirmResponse> {
    const encodedEmail = encodeURIComponent(email);
    const apiResponse = await this.fetch(
      `/auth/passwordless/confirm?email=${encodedEmail}&code=${code}`,
      { authenticate: false, headers: { accept: 'application/json' } }
    );

    const { status, title } = await (async function () {
      try {
        return (await apiResponse.json()) as {
          status: string | number;
          title?: string;
        };
      } catch (e) {
        throw new ServiceClientError(
          `Cannot deserialize confirmation API response: ${String(e)}`
        );
      }
    })();

    if (status === 'CONFIRMED') {
      return { success: true };
    } else {
      return {
        success: false,
        code: this.makeErrorCodeFromLoginConfirmationError(title),
      };
    }
  }

  public async cliLogin(): Promise<CLILoginResponse> {
    const response: Response = await crossfetch.fetch(
      `${this._STORAGE.baseUrl}/auth/cli`,
      {
        method: 'POST',
      }
    );
    if (response.status === 201) {
      const apiResponse = await this.tryParseLoginResponseJson<{
        verify_url: string;
        browser_url: string;
        expires_at: string;
      }>(response);

      if (apiResponse.error) {
        return apiResponse.error;
      }

      const { verify_url, browser_url, expires_at } = apiResponse.json || {};

      if (verify_url && browser_url && expires_at) {
        return {
          success: true,
          verifyUrl: verify_url,
          browserUrl: browser_url,
          expiresAt: new Date(expires_at),
        };
      } else {
        return { success: false, title: 'Unexpected API response' };
      }
    } else {
      const apiResponse = await this.tryParseLoginResponseJson<{
        title: string;
        detail: string;
      }>(response);

      if (apiResponse.error) {
        return apiResponse.error;
      }

      const { title, detail } = apiResponse.json || {};
      if (title) {
        return { success: false, title, detail };
      } else {
        return {
          success: false,
          title: `Unexpected status code ${response.status} received`,
        };
      }
    }
  }

  public async verifyCliLogin(
    verifyUrl: string,
    options?: VerifyOptions
  ): Promise<VerifyResponse> {
    return this.verifyLogin(verifyUrl, options);
  }

  public async confirmCliLogin(code: string): Promise<LoginConfirmResponse> {
    const apiResponse = await this.fetch(`/auth/cli/confirm?code=${code}`, {
      authenticate: true,
      method: 'POST',
      headers: { accept: 'application/json' },
    });

    const { status, title } = await (async function () {
      try {
        return (await apiResponse.json()) as {
          status: string | number;
          title?: string;
        };
      } catch (e) {
        throw new ServiceClientError(
          `Cannot deserialize confirmation API response: ${String(e)}`
        );
      }
    })();

    if (status === 'CONFIRMED') {
      return { success: true };
    } else {
      return {
        success: false,
        code: this.makeErrorCodeFromLoginConfirmationError(title),
      };
    }
  }

  public async getProjectsList(): Promise<ProjectsListResponse> {
    const response: Response = await this.fetch('/projects', {
      method: 'GET',
      headers: { 'Content-Type': MEDIA_TYPE_JSON },
    });

    await this.unwrap(response);

    return (await response.json()) as ProjectsListResponse;
  }

  public async getProject(
    handle: string,
    name: string
  ): Promise<ProjectResponse> {
    const projectUrl = `/projects/${handle}/${name}`;

    const response: Response = await this.fetch(projectUrl, {
      method: 'GET',
      headers: { 'Content-Type': MEDIA_TYPE_JSON },
    });

    await this.unwrap(response);

    return (await response.json()) as ProjectResponse;
  }

  public async updateProject(
    handle: string,
    name: string,
    projectUpdate: ProjectUpdateBody
  ): Promise<ProjectResponse> {
    const projectUrl = `/projects/${handle}/${name}`;

    const response: Response = await this.fetch(projectUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': MEDIA_TYPE_JSON },
      body: JSON.stringify(projectUpdate),
    });

    await this.unwrap(response);

    return (await response.json()) as ProjectResponse;
  }

  public async createProject(name: string): Promise<ProjectResponse> {
    const response: Response = await this.fetch('/projects', {
      authenticate: true,
      method: 'POST',
      headers: { 'Content-Type': MEDIA_TYPE_JSON },
      body: JSON.stringify({
        name,
      }),
    });

    await this.unwrap(response);

    return (await response.json()) as ProjectResponse;
  }

  public async getSDKConfiguration(
    handle: string,
    projectName: string
  ): Promise<SDKConfigResponse> {
    const configUrl = `/insights/sdk_config?account_handle=${handle}&project_name=${projectName}`;

    const response: Response = await this.fetch(configUrl, {
      method: 'GET',
      headers: { 'Content-Type': MEDIA_TYPE_JSON },
    });

    await this.unwrap(response);

    return (await response.json()) as SDKConfigResponse;
  }

  public async getSDKPerformStatistics(
    handle: string,
    projectName: string,
    profileName: string,
    providers: string[],
    from: Date,
    to: Date,
    intervalMinutes: number
  ): Promise<SDKPerformStatisticsResponse> {
    const statisticsUrl = this.makePathWithQueryParams(
      '/insights/perform_statistics',
      {
        from: from.toISOString(),
        to: to.toISOString(),
        interval_minutes: intervalMinutes,
        account_handle: handle,
        project_name: projectName,
        profile: profileName,
        providers: providers.join(','),
      }
    );

    const response: Response = await this.fetch(statisticsUrl, {
      method: 'GET',
      headers: { 'Content-Type': MEDIA_TYPE_JSON },
    });

    await this.unwrap(response);

    return (await response.json()) as SDKPerformStatisticsResponse;
  }

  public async getSDKProviderChangesList(
    handle: string,
    projectName: string,
    profileName?: string,
    fromProviders?: string[],
    providerChangeTypes?: SDKProviderChangeType[],
    limit = 10
  ): Promise<SDKProviderChangesListResponse> {
    const providerChangesUrl = this.makePathWithQueryParams(
      '/insights/provider_changes',
      {
        account_handle: handle,
        project_name: projectName,
        profile: profileName,
        from_providers: (fromProviders || []).join(','),
        provider_change_types: (providerChangeTypes || []).join(','),
        limit,
      }
    );

    const response: Response = await this.fetch(providerChangesUrl, {
      method: 'GET',
      headers: { 'Content-Type': MEDIA_TYPE_JSON },
    });

    await this.unwrap(response);

    return (await response.json()) as SDKProviderChangesListResponse;
  }

  public async signOut(
    {
      fromAllDevices,
    }: {
      fromAllDevices: boolean;
    } = { fromAllDevices: false }
  ): Promise<null> {
    const cookie = this.getRefreshTokenCookie();

    const result: Response = await crossfetch.fetch(
      `${this._STORAGE.baseUrl}/auth/signout`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          cookie,
        },
        body: JSON.stringify({
          all: fromAllDevices,
        }),
      }
    );

    if (result.ok) {
      await this.logout();

      return null;
    } else if ([401, 403].includes(result.status)) {
      throw new ServiceClientError("No session found, couldn't log out");
    } else {
      throw new ServiceClientError("Couldn't log out due to unknown reasons");
    }
  }

  public getGithubLoginUrl(
    returnTo?: string,
    mode?: 'register',
    customQueryParams: Record<string, any> = {}
  ): string {
    const url = new URL(`${this._STORAGE.baseUrl}/auth/github`);
    let queryParams: Record<string, any> = {};

    if (returnTo) {
      queryParams.return_to = returnTo;
    }

    if (mode) {
      queryParams.mode = mode;
    }

    if (customQueryParams) {
      queryParams = { ...queryParams, ...customQueryParams };
    }

    url.search = new URLSearchParams(queryParams).toString();

    return url.toString();
  }

  public async getUserInfo(): Promise<UserResponse> {
    const response: Response = await this.fetch(`/id/user`, {
      method: 'GET',
      headers: { 'Content-Type': MEDIA_TYPE_JSON },
    });

    await this.unwrap(response);

    return (await response.json()) as UserResponse;
  }

  public async shareProfile(profileId: string, email: string): Promise<void> {
    const response: Response = await this.fetch(`/share/profile`, {
      method: 'POST',
      headers: { 'Content-Type': MEDIA_TYPE_JSON },
      body: JSON.stringify({
        profile_id: profileId,
        email,
      }),
    });

    await this.unwrap(response);
  }

  private async fetchVerifyLogin(verifyUrl: string): Promise<VerifyResponse> {
    const result = await crossfetch.fetch(verifyUrl, {
      method: 'GET',
    });
    if (result.status === 200) {
      const authToken = (await result.json()) as AuthToken;
      await this.login(authToken);

      return {
        verificationStatus: VerificationStatus.CONFIRMED,
        authToken: authToken,
      };
    }
    if (result.status === 400) {
      const error = (await result.json()) as VerifyErrorResponse;
      if (
        error.status === VerificationStatus.PENDING ||
        error.status === VerificationStatus.USED ||
        error.status === VerificationStatus.EXPIRED
      ) {
        return {
          verificationStatus: error.status,
        };
      } else {
        throw Error(`Token verification failed with error: ${error.title}`);
      }
    } else {
      throw Error(`Unexpected status code ${result.status} received`);
    }
  }

  private getCurrentTime(): number {
    return Math.floor(Date.now() / 1000);
  }

  private async unwrap<ApiErrorResponse extends ServiceApiErrorResponse>(
    response: Response,
    throwCustomError?: (errorResponse: ApiErrorResponse) => void
  ): Promise<Response> {
    if (!response.ok) {
      if (throwCustomError) {
        throwCustomError((await response.json()) as ApiErrorResponse);
      } else {
        const errorResponse =
          (await response.json()) as ServiceApiErrorResponse;
        throw new ServiceApiError(errorResponse);
      }
    }

    return response;
  }

  private getRefreshTokenCookie(options?: RefreshAccessTokenOptions) {
    return (
      options?.cookie ||
      `user_session=${
        this._STORAGE.authToken?.refresh_token ||
        this._STORAGE.refreshToken ||
        ''
      }`
    );
  }

  private makePathWithQueryParams(
    path: string,
    paramsObject: Record<string, unknown>
  ): string {
    const searchParams = Object.entries(paramsObject)
      .filter(([_, v]) => !!v)
      .map(kv => kv.join('='))
      .join('&');

    return [path, searchParams].filter(v => !!v).join('?');
  }

  private async verifyLogin(
    verifyUrl: string,
    options?: VerifyOptions
  ): Promise<VerifyResponse> {
    const startPollingTimeStamp = new Date();
    const timeoutMilliseconds =
      (options?.pollingTimeoutSeconds ?? DEFAULT_POLLING_TIMEOUT_SECONDS) *
      1000;
    const pollingIntervalMilliseconds =
      (options?.pollingIntervalSeconds ?? DEFAULT_POLLING_INTERVAL_SECONDS) *
      1000;
    while (
      new Date().getTime() - startPollingTimeStamp.getTime() <
      timeoutMilliseconds
    ) {
      const result = await this.fetchVerifyLogin(verifyUrl);

      if (result.verificationStatus !== VerificationStatus.PENDING) {
        return result;
      }

      if (options?.cancellationToken?.isCancellationRequested) {
        options.cancellationToken.cancellationFinished();

        return {
          verificationStatus: VerificationStatus.POLLING_CANCELLED,
        };
      }

      await sleep(pollingIntervalMilliseconds);
    }

    return {
      verificationStatus: VerificationStatus.POLLING_TIMEOUT,
    };
  }

  private makeErrorCodeFromLoginConfirmationError(
    title?: string
  ): LoginConfirmationErrorCode {
    if (title?.toLocaleLowerCase().includes('expir'))
      return LoginConfirmationErrorCode.EXPIRED;
    if (
      title?.toLowerCase().includes('already confirm') ||
      title?.toLowerCase().includes('used')
    )
      return LoginConfirmationErrorCode.USED;

    return LoginConfirmationErrorCode.INVALID;
  }

  private async tryParseLoginResponseJson<T>(
    response: Response
  ): Promise<{ json?: T; error?: UnsuccessfulLogin }> {
    let apiResponse;
    try {
      apiResponse = (await response.json()) as T;
    } catch (e) {
      return {
        error: {
          success: false,
          title: `Cannot deserialize login API response: ${String(e)}`,
        },
      };
    }

    return { json: apiResponse };
  }

  private mapProviderResponse(providerData: any): ProviderResponse {
    if ('definition' in providerData) {
      return providerData as ProviderResponse;
    } else {
      const { url, ...providerJson } = providerData;

      return {
        provider_id: providerData.name,
        url,
        definition: providerJson,
      };
    }
  }

  private mapProvidersListResponse(
    providersListData: any
  ): ProviderListResponse {
    return {
      url: providersListData.url,
      data: providersListData.data.map((provider: any) =>
        this.mapProviderResponse(provider)
      ),
    };
  }
}
