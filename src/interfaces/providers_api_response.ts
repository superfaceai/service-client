export interface ProviderResponse {
  provider_id: string;
  url: string;
  owner?: string;
  owner_url?: string;
  published_at?: Date;
  published_by?: string;
  definition: unknown;
}

export interface ProviderListResponse {
  url: string;
  data: ProviderResponse[];
}
