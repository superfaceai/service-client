import { createQueryParams } from './createQueryParams';

describe('createQueryParams', () => {
  it('returns empty string if no params passed', () => {
    expect(createQueryParams({})).toBe('');
  });

  it('returns two query paramters', () => {
    expect(createQueryParams({ one: '1', two: 2 })).toBe('one=1&two=2');
  });

  it('encodes values', () => {
    expect(createQueryParams({ url: 'https://sfc.is' })).toBe(
      'url=https%3A%2F%2Fsfc.is'
    );
  });
});
