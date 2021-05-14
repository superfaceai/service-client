import { ServiceApiErrorResponse } from './interfaces';

export class ServiceClientError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ServiceClientError.prototype);
  }
}

export class ServiceApiError extends ServiceClientError {
  public status: number;
  public instance: string;
  public title: string;
  public detail: string;

  constructor(errorResponse: ServiceApiErrorResponse) {
    super(
      `Store responded with status: ${errorResponse.status} on: ${errorResponse.instance} ${errorResponse.title}: ${errorResponse.detail}`
    );

    Object.setPrototypeOf(this, ServiceApiError.prototype);

    this.status = errorResponse.status;
    this.instance = errorResponse.instance;
    this.title = errorResponse.title;
    this.detail = errorResponse.detail;
  }
}
