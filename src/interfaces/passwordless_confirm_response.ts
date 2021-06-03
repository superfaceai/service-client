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

export type PasswordlessConfirmResponse =
  | SuccessfulConfirm
  | UnsuccessfulConfirm;
