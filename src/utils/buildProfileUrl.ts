import { ProfileId } from '../interfaces';

export function buildProfileUrl(profileId: ProfileId) {
  if (profileId?.scope) {
    return profileId.version
      ? `/${profileId.scope}/${profileId.name}@${profileId.version}`
      : `/${profileId.scope}/${profileId.name}`;
  } else {
    return profileId?.version
      ? `/${profileId.name}@${profileId.version}`
      : `/${profileId.name}`;
  }
}
