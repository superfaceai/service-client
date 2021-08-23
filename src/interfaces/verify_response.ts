import { AuthToken } from './auth_token';

export enum VerificationStatus {
  PENDING = 'PENDING',
  EXPIRED = 'EXPIRED',
  USED = 'USED',
  CONFIRMED = 'CONFIRMED',
  POLLING_TIMEOUT = 'POLLING_TIMEOUT',
  POLLING_CANCELLED = 'POLLING_CANCELLED',
}
export interface VerifyResponse {
  verificationStatus: VerificationStatus;
  authToken?: AuthToken;
}

export interface VerifyErrorResponse {
  title: string;
  status: VerificationStatus;
}
