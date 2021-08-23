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
