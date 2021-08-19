export interface ProfileResponse {
  url: string;
  id: string;
}

export interface ProfilesListResponse {
  url: string;
  data: ProfileResponse[];
}

export interface ProfileVersionResponse {
  profile_id: string;
  profile_name: string;
  profile_version: string;
  url: string;
  published_at: Date;
  published_by: string;
  owner: string;
  owner_url: string;
}