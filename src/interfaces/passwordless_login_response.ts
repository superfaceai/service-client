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
