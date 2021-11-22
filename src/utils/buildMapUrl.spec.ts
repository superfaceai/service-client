import { buildMapUrl } from './buildMapUrl';

describe('buildMapUrl', () => {
  it('should build url', () => {
    const url = buildMapUrl({
      name: 'profile',
      provider: 'provider',
      version: '1.0',
    });

    expect(url).toBe('/profile.provider@1.0');
  });

  it('should build url with scope', () => {
    const url = buildMapUrl({
      name: 'profile',
      provider: 'provider',
      version: '1.0',
      scope: 'scope',
    });

    expect(url).toBe('/scope/profile.provider@1.0');
  });

  it('should build url with variant', () => {
    const url = buildMapUrl({
      name: 'profile',
      provider: 'provider',
      version: '1.0',
      variant: 'variant',
    });

    expect(url).toBe('/profile.provider.variant@1.0');
  });

  it('should build url with version, scope, variant', () => {
    const url = buildMapUrl({
      name: 'profile',
      provider: 'provider',
      version: '1.0',
      scope: 'scope',
      variant: 'variant',
    });

    expect(url).toBe('/scope/profile.provider.variant@1.0');
  });
});
