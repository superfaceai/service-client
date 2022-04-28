import { ServiceApiErrorResponse } from './interfaces';
import { CreateProfileApiErrorResponse } from './interfaces/create_profile_api_error_response';
import { CreateProviderApiErrorResponse } from './interfaces/create_provider_api_error_response';

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

export class CreateProviderApiError extends ServiceApiError {
  public providerJsonEquals?: boolean;
  public validProviderNames?: string[];

  constructor(errorResponse: CreateProviderApiErrorResponse) {
    super(errorResponse);

    Object.setPrototypeOf(this, CreateProviderApiError.prototype);

    this.providerJsonEquals = errorResponse.provider_json_equals;
    this.validProviderNames = errorResponse.valid_provider_names;
  }
}

export class CreateProfileApiError extends ServiceApiError {
  public contentIsEqual?: boolean;
  public suggestedVersion?: string;

  constructor(errorResponse: CreateProfileApiErrorResponse) {
    super(errorResponse);

    Object.setPrototypeOf(this, CreateProfileApiError.prototype);

    this.contentIsEqual = errorResponse.content_is_equal;
    this.suggestedVersion = errorResponse.suggested_version;
  }
}
