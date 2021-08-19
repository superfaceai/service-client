export interface MapRevisionResponse {
  map_id: string;
  profile_name: string;
  profile_version: string;
  profile_url: string;
  map_revision: string;
  map_provider: string;
  map_provider_url: string;
  map_variant: string;
  url: string;
  published_at: Date;
  published_by: string;
  owner: string;
  owner_url: string;
}

export interface ServiceApiErrorResponse {
  status: number;
  instance: string;
  title: string;
  detail: string;
}
