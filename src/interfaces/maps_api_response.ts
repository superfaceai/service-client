export function isMapMinimalReponse(map: unknown): map is MapMinimalResponse {
  return typeof map === 'object' && map !== null && 'id' in map;
}

export interface MapMinimalResponse {
  url: string;
  id: string;
}

export interface MapResponse {
  map_id: string;
  map_provider: string;
  map_provider_url: string;
  map_revision: number;
  map_variant: string | null;
  profile_id: string;
  profile_version: string;
  profile_url: string;
  url: string;
  published_at: Date;
  published_by: string;
  owner: string;
  owner_url: string;
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
