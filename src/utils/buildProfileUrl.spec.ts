import { buildProfileUrl } from './buildProfileUrl';

describe('buildProfileUrl', () => {
  it('should build profile url', () => {
    const url = buildProfileUrl({ name: 'profile' });

    expect(url).toBe('/profile');
  });

  it('should build profile url with scope', () => {
    const url = buildProfileUrl({
      name: 'profile',
      scope: 'scope',
    });

    expect(url).toBe('/scope/profile');
  });

  it('should build profile url with version', () => {
    const url = buildProfileUrl({
      name: 'profile',
      version: '1.0.0',
    });

    expect(url).toBe('/profile@1.0.0');
  });

  it('should build profile url with scope and version', () => {
    const url = buildProfileUrl({
      name: 'profile',
      scope: 'scope',
      version: '1.0.0',
    });

    expect(url).toBe('/scope/profile@1.0.0');
  });
});
