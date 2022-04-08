export interface ProfilesListOptions extends ProfileOptions {
  limit?: number;
  page?: number;
  accountHandle?: string;
  scope?: string;
}

export interface ProfileOptions {
  authenticate?: boolean;
}
