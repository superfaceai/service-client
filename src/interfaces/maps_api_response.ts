export interface MapResponse {
  url: string;
  id: string;
}

export interface MapsListResponse {
  url: string;
  data: MapResponse[];
}

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
