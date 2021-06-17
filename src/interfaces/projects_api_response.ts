interface SDKAuthTokenResponse {
  token: string;
  created_at: string;
}

interface ProjectSettingsResponse {
  email_notifications: boolean;
}

export interface ProjectResponse {
  url: string;
  name: string;
  settings?: ProjectSettingsResponse;
  sdk_auth_tokens?: SDKAuthTokenResponse[];
  created_at: string;
}

export interface ProjectsListResponse {
  url: string;
  data: ProjectResponse[];
}
