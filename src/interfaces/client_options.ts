export type RefreshTokenUpdatedHandler = (
  serviceUrl: string,
  refreshToken: string | null
) => Promise<void>;

export interface ClientOptions {
  baseUrl?: string;
  refreshToken?: string;
  commonHeaders?: Record<string, string>;
  refreshTokenUpdatedHandler?: RefreshTokenUpdatedHandler;
}
