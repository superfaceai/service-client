export interface ProfilesListOptions extends ProfileOptions {
  limit?: number;
  accountHandle?: string;
}

export interface ProfileOptions {
  authenticate?: boolean;
}
