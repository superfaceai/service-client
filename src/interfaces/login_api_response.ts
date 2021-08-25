import { AuthToken } from './auth_token';

export enum LoginConfirmationErrorCode {
  EXPIRED = 'EXPIRED',
  USED = 'USED',
  INVALID = 'INVALID',
}

export type SuccessfulConfirm = {
  success: true;
};

export type UnsuccessfulConfirm = {
  success: false;
  code: LoginConfirmationErrorCode;
};

export type LoginConfirmResponse = SuccessfulConfirm | UnsuccessfulConfirm;

export type SuccessfulLogin = {
  success: true;
  verifyUrl: string;
  expiresAt: Date;
};

export type UnsuccessfulLogin = {
  success: false;
  title: string;
  detail?: string;
};

export type PasswordlessLoginResponse = SuccessfulLogin | UnsuccessfulLogin;

export type CLISuccessfulLogin = {
  success: true;
  verifyUrl: string;
  browserUrl: string;
  expiresAt: Date;
};

export type CLIUnsuccessfulLogin = {
  success: false;
  title: string;
  detail?: string;
};

export type CLILoginResponse = CLISuccessfulLogin | CLIUnsuccessfulLogin;

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
