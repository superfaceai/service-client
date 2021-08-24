type ApiKeyHeaderSecurity = {
  id: string;
  type: 'apiKey';
  in: 'header';
  name: string;
};

type ApiKeyQueryParamSecurity = {
  id: string;
  type: 'apiKey';
  in: 'query';
  name: string;
};

type BasicAuthSecurity = {
  id: string;
  type: 'http';
  scheme: 'basic';
};

type BearerTokenSecurity = {
  id: string;
  type: 'http';
  scheme: 'bearer';
  bearerFormat?: string;
};

type ProviderSecurityScheme =
  | ApiKeyHeaderSecurity
  | ApiKeyQueryParamSecurity
  | BasicAuthSecurity
  | BearerTokenSecurity;

export interface ProviderResponse {
  url: string;
  name: string;
  services: Array<{
    id: string;
    baseUrl: string;
  }>;
  defaultService: string;
  securitySchemes?: ProviderSecurityScheme[];
}

export interface ProviderListResponse {
  url: string;
  data: ProviderResponse[];
}
