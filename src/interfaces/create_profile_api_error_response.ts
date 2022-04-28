import { ServiceApiErrorResponse } from './service_api_error_response';

export interface CreateProfileApiErrorResponse extends ServiceApiErrorResponse {
  content_is_equal?: boolean;
  suggested_version?: string;
}
