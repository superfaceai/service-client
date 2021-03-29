import * as crossfetch from 'cross-fetch';
import { RequestInit, Response } from 'cross-fetch/lib.fetch';

import { AuthToken, ClientOptions, RefreshAccessTokenOptions } from '.';
import {
  PasswordlessVerifyErrorResponse,
  PasswordlessVerifyResponse,
  TokenVerificationStatus,
} from './interfaces/passwordless_verify_response';

interface ClientStorage {
  baseUrl?: string;
  authToken?: AuthToken;
  authTokenExpiresAt?: number;
  refreshToken?: string;
}

export class BrainClient {
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
      throw Error('Client is not initialized, baseUrl not configured');
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

  public async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    if (this.isAccessTokenExpired()) {
      // Try to get access token
      await this.refreshAccessToken();
    }

    const _fetch = () => {
      init.headers = Object.assign({}, init.headers, {
        Authorization: `Bearer ${this._STORAGE.authToken?.access_token}`,
      });
      init.credentials = 'include';

      return crossfetch.fetch(`${this._STORAGE.baseUrl}${url}`, init);
    };

    let res = await _fetch();

    if ([401, 403].includes(res.status)) {
      await this.refreshAccessToken();
      res = await _fetch();
    }

    return res;
  }

  public async passwordlessLogin(email: string): Promise<string> {
    const result: Response = await crossfetch.fetch(
      `${this._STORAGE.baseUrl}/auth/passwordless`,
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
      const verifyUrl: string | undefined = ((await result.json()) as {
        verify_url: string;
      }).verify_url;
      if (verifyUrl) {
        return verifyUrl;
      } else {
        throw Error('Verify url not found in response');
      }
    } else {
      throw Error(`Unexpected status code ${result.status} received`);
    }
  }

  public async verifyPasswordlessLogin(
    verifyUrl: string
  ): Promise<PasswordlessVerifyResponse> {
    const result: Response = await crossfetch.fetch(verifyUrl, {
      method: 'GET',
    });
    if (result.status === 200) {
      const authToken = (await result.json()) as AuthToken;
      this.login(authToken);

      return {
        verificationStatus: TokenVerificationStatus.CONFIRMED,
        authToken: authToken,
      };
    } else {
      if (result.status === 422) {
        const error = (await result.json()) as PasswordlessVerifyErrorResponse;
        switch (error.title) {
          case 'Token is pending confirmation':
            return {
              verificationStatus: TokenVerificationStatus.PENDING,
            };
          case 'Token is expired':
            return {
              verificationStatus: TokenVerificationStatus.EXPIRED,
            };
          case 'Token was already used':
            return {
              verificationStatus: TokenVerificationStatus.USED,
            };
          default:
            throw Error(`Token verification failed with error: ${error.title}`);
        }
      } else {
        throw Error(`Unexpected status code ${result.status} received`);
      }
    }
  }

  private getCurrentTime(): number {
    return Math.floor(Date.now() / 1000);
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
