# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **BREAKING CHANGE:** `passwordlessLogin` returns error object instead of throwing

## [0.0.7] - 2021-04-20

### Added

- `createProvider` method creates provider in store
- `findAllProviders` method returns all providers in store
- `findOneProvider` method returns one provider from store
- `createProfile` method creates profile in store
- `parseProfile` method parses profile using store api
- `getProfile` method return profile from store in json
- `getProfileSource` method return profile from store in suma format
- `getProfileAST` method return profile from store in ast format
- `createMap` method creates map in store
- `parseMap` method parses map using store api
- `getMap` method return map from store in json
- `getMapSource` method return map from store in suma format
- `getMapAST` method return map from store in ast format
- `signOut` method for facilitating session sign out with Brain

## [0.0.6] - 2021-04-19

### Added

- `passwordlessLogin` method takes optional login mode (`login` or `register`)

### Fixed

- removed `RequestInit` and `Response` import from `cross-fetch`

## [0.0.5] - 2021-04-14

### Changed

- **BREAKING CHANGE:** `passwordlessLogin` returns object with `verifyUrl` & `expiresAt`

## [0.0.4] - 2021-04-09

### Fixed

- Fixed polling in `verifyPasswordlessLogin` when running in the browser

## [0.0.3] - 2021-04-08

### Added

- `verifyPasswordlessLogin` method takes new optional argument `options` and polls verify endpoint if token verification status is `PENDING`

### Changed

- **BREAKING CHANGE:** renamed `TokenVerificationStatus` to `VerificationStatus`

## [0.0.2] - 2021-04-08

### Added

- `passwordlessLogin` method to `BrainClient` which starts passworldess login flow by sending confirmation e-mail
- `verifyPasswordlessLogin` method to `BrainClient` which checks status of passwordless login
- `getGithubLoginUrl` method to `BrainClient`

[unreleased]: https://github.com/superfaceai/brain-client/compare/v0.0.7...HEAD
[0.0.7]: https://github.com/superfaceai/brain-client/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/superfaceai/brain-client/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/superfaceai/brain-client/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/superfaceai/brain-client/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/superfaceai/brain-client/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/superfaceai/brain-client/compare/v0.0.1...v0.0.2
