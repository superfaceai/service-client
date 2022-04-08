export function isProfileMinimalReponse(
  profile: unknown
): profile is ProfileMinimalResponse {
  return typeof profile === 'object' && profile !== null && 'id' in profile;
}

export interface ProfileMinimalResponse {
  id: string;
  url: string;
}

export interface ProfileResponse {
  profile_id: string;
  profile_name: string;
  profile_description?: string;
  profile_version: string;
  url: string;
  published_at: Date;
  published_by: string;
  owner: string;
  owner_url: string;
}

export interface ProfilesListResponse {
  url: string;
  data: ProfileResponse[];
}
