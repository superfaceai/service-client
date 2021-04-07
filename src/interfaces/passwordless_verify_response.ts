import { AuthToken } from './auth_token';

export enum TokenVerificationStatus {
  PENDING = 'PENDING',
  EXPIRED = 'EXPIRED',
  USED = 'USED',
  CONFIRMED = 'CONFIRMED',
  POLLING_TIMEOUT = 'POLLING_TIMEOUT',
  POLLING_CANCELLED = 'POLLING_CANCELLED',
}
export interface PasswordlessVerifyResponse {
  verificationStatus: TokenVerificationStatus;
  authToken?: AuthToken;
}

export interface PasswordlessVerifyErrorResponse {
  title: string;
  status: TokenVerificationStatus;
}
