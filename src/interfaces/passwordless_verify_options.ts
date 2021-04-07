export interface PasswordlessVerifyOptions {
  pollingTimeoutSeconds?: number;
  pollingIntervalSeconds?: number;
  cancellationToken?: CancellationToken;
}

export const DEFAULT_POLLING_TIMEOUT_SECONDS = 60;
export const DEFAULT_POLLING_INTERVAL_SECONDS = 1;

export class CancellationToken {
  public isCancellationRequested = false;

  private onCancelledCallback?: () => void;

  constructor(onCancelledCallback?: () => void) {
    this.onCancelledCallback = onCancelledCallback;
  }

  public cancellationFinished(): void {
    if (this.onCancelledCallback) {
      this.onCancelledCallback();
    }
  }
}
