export interface PasswordlessVerifyOptions {
  pollingTimeoutSeconds?: number;
  pollingIntervalSeconds?: number;
}

export const DEFAULT_POLLING_TIMEOUT_SECONDS = 60;
export const DEFAULT_POLLING_INTERVAL_SECONDS = 1;
