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
  AuthToken,
  ClientOptions,
  MapRevisionResponse,
  ProfileVersionResponse,
  ProviderResponse,
  RefreshAccessTokenOptions,
  StoreApiErrorResponse,
} from './interfaces';
import {
  DEFAULT_POLLING_INTERVAL_SECONDS,
  DEFAULT_POLLING_TIMEOUT_SECONDS,
  PasswordlessVerifyOptions,
} from './interfaces/passwordless_verify_options';
import {
  PasswordlessVerifyErrorResponse,
  PasswordlessVerifyResponse,
  VerificationStatus,
} from './interfaces/passwordless_verify_response';
import { PasswordlessLoginResponse } from './interfaces/passwordless_login_response';
import { ServiceClientError, StoreApiError } from './errors';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface ClientStorage {
  baseUrl?: string;
  authToken?: AuthToken;
  authTokenExpiresAt?: number;
  refreshToken?: string;
}

type FetchOptions = { authenticate?: boolean };
type RequestOptions = RequestInit & FetchOptions;

export class ServiceClient {
  private _STORAGE: ClientStorage = {
    baseUrl: 'https://superface.ai',
  };

  constructor({ baseUrl, refreshToken }: ClientOptions = {}) {
    this.setOptions({ baseUrl, refreshToken });
  }

  public setOptions({ baseUrl, refreshToken }: ClientOptions): void {
    if (baseUrl) {
      this._STORAGE.baseUrl = baseUrl;
    }

    if (refreshToken) {
      this._STORAGE.refreshToken = refreshToken;
    }
  }

  public login(authToken: AuthToken): void {
    const currentTime = this.getCurrentTime();
    this._STORAGE.authTokenExpiresAt = currentTime + authToken.expires_in;
    this._STORAGE.authToken = authToken;
  }

  public logout(): void {
    this._STORAGE.authToken = undefined;
    this._STORAGE.authTokenExpiresAt = undefined;
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
    this.login(authToken);

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

  async createProvider(payload: string): Promise<void> {
    const response: Response = await this.fetch('/providers', {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    await this.unwrap(response);
  }

  async findAllProviders(): Promise<ProviderResponse[]> {
    const response: Response = await this.fetch('/providers', {
      authenticate: false,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    await this.unwrap(response);

    return (await response.json()) as ProviderResponse[];
  }

  async findOneProvider(name: string): Promise<ProviderResponse> {
    const response: Response = await this.fetch(`/providers/${name}`, {
      authenticate: false,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    await this.unwrap(response);

    return (await response.json()) as ProviderResponse;
  }

  async createProfile(payload: string): Promise<void> {
    const response: Response = await this.fetch('/profiles', {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': MEDIA_TYPE_TEXT,
      },
    });
    await this.unwrap(response);
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
    scope: string,
    version: string,
    name: string
  ): Promise<ProfileVersionResponse> {
    const response: Response = await this.fetch(
      `/${scope}/${name}@${version}`,
      {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: MEDIA_TYPE_JSON,
        },
      }
    );
    await this.unwrap(response);

    return (await response.json()) as ProfileVersionResponse;
  }

  async getProfileSource(
    scope: string,
    version: string,
    name: string
  ): Promise<string> {
    const response: Response = await this.fetch(
      `/${scope}/${name}@${version}`,
      {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: MEDIA_TYPE_PROFILE,
        },
      }
    );

    return (await this.unwrap(response)).text();
  }

  async getProfileAST(
    scope: string,
    version: string,
    name: string
  ): Promise<string> {
    const response: Response = await this.fetch(
      `/${scope}/${name}@${version}`,
      {
        authenticate: false,
        method: 'GET',
        headers: {
          Accept: MEDIA_TYPE_PROFILE_AST,
        },
      }
    );

    return (await this.unwrap(response)).text();
  }

  async createMap(payload: string): Promise<void> {
    const response: Response = await this.fetch('/maps', {
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

  async getMap(
    scope: string,
    version: string,
    name: string,
    provider: string,
    variant?: string
  ): Promise<MapRevisionResponse> {
    const url = variant
      ? `/${scope}/${name}.${provider}.${variant}@${version}`
      : `/${scope}/${name}.${provider}@${version}`;
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

  async getMapSource(
    scope: string,
    version: string,
    name: string,
    provider: string,
    variant?: string
  ): Promise<string> {
    const url = variant
      ? `/${scope}/${name}.${provider}.${variant}@${version}`
      : `/${scope}/${name}.${provider}@${version}`;
    const response: Response = await this.fetch(url, {
      authenticate: false,
      method: 'GET',
      headers: {
        Accept: MEDIA_TYPE_MAP,
      },
    });

    return (await this.unwrap(response)).text();
  }

  async getMapAST(
    scope: string,
    version: string,
    name: string,
    provider: string,
    variant?: string
  ): Promise<string> {
    const url = variant
      ? `/${scope}/${name}.${provider}.${variant}@${version}`
      : `/${scope}/${name}.${provider}@${version}`;
    const response: Response = await this.fetch(url, {
      authenticate: false,
      method: 'GET',
      headers: {
        Accept: MEDIA_TYPE_MAP_AST,
      },
    });

    return (await this.unwrap(response)).text();
  }

  public async passwordlessLogin(
    email: string,
    mode: 'login' | 'register' = 'login'
  ): Promise<PasswordlessLoginResponse> {
    const result: Response = await crossfetch.fetch(
      `${this._STORAGE.baseUrl}/auth/passwordless?mode=${mode}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
        }),
      }
    );
    if (result.status === 200) {
      const apiResponse = (await result.json()) as {
        verify_url: string;
        expires_at: string;
      };
      const { verify_url, expires_at } = apiResponse || {};

      if (verify_url && expires_at) {
        return {
          success: true,
          verifyUrl: verify_url,
          expiresAt: new Date(expires_at),
        };
      } else {
        return { success: false, title: 'Unexpected API response' };
      }
    } else if (result.status === 400) {
      const apiResponse = await result.json();
      const { title, detail } = apiResponse || {};
      if (title) {
        return { success: false, title, detail };
      } else {
        return { success: false, title: 'Unexpected API response' };
      }
    } else {
      return {
        success: false,
        title: `Unexpected status code ${result.status} received`,
      };
    }
  }

  public async verifyPasswordlessLogin(
    verifyUrl: string,
    options?: PasswordlessVerifyOptions
  ): Promise<PasswordlessVerifyResponse> {
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
      const result = await this.fetchVerifyPasswordlessLogin(verifyUrl);

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

  public async signOut(
    {
      fromAllDevices,
    }: {
      fromAllDevices: boolean;
    } = { fromAllDevices: false }
  ): Promise<null> {
    const result: Response = await crossfetch.fetch(
      `${this._STORAGE.baseUrl}/auth/signout`,
      {
        method: 'DELETE',
        body: JSON.stringify({
          all: fromAllDevices,
        }),
      }
    );

    if (result.ok) {
      this.logout();

      return null;
    } else if ([401, 403].includes(result.status)) {
      throw new ServiceClientError("No session found, couldn't log out");
    } else {
      throw new ServiceClientError("Couldn't log out due to unknown reasons");
    }
  }

  public getGithubLoginUrl(returnTo?: string, mode?: 'register'): string {
    const urlWithoutParams = `${this._STORAGE.baseUrl}/auth/github`;
    const queryParams = [];
    if (returnTo) {
      queryParams.push(`return_to=${encodeURIComponent(returnTo)}`);
    }
    if (mode) {
      queryParams.push(`mode=${mode}`);
    }
    if (queryParams.length > 0) {
      return urlWithoutParams + `?${queryParams.join('&')}`;
    }

    return urlWithoutParams;
  }

  private async fetchVerifyPasswordlessLogin(
    verifyUrl: string
  ): Promise<PasswordlessVerifyResponse> {
    const result = await crossfetch.fetch(verifyUrl, {
      method: 'GET',
    });
    if (result.status === 200) {
      const authToken = (await result.json()) as AuthToken;
      this.login(authToken);

      return {
        verificationStatus: VerificationStatus.CONFIRMED,
        authToken: authToken,
      };
    }
    if (result.status === 400) {
      const error = (await result.json()) as PasswordlessVerifyErrorResponse;
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

  private async unwrap(response: Response): Promise<Response> {
    if (!response.ok) {
      const errorResponse = (await response.json()) as StoreApiErrorResponse;
      throw new StoreApiError(errorResponse);
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
}
