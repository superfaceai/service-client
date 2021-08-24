export interface UserResponse {
  name: string;
  email: string;
  accounts: UserAccountResponse[];
}

export interface UserAccountResponse {
  handle: string;
  type: UserAccountType;
}

export enum UserAccountType {
  PERSONAL = 'PERSONAL',
}
