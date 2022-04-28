import { ServiceApiErrorResponse } from "./service_api_error_response";

export interface CreateProviderApiErrorResponse extends ServiceApiErrorResponse {
  provider_json_equals?: boolean,
  valid_provider_names?: string[],
}
