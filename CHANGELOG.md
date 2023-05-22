# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [5.2.1] - 2023-05-22
### Fixed
- missing Accept header in GET requests

## [5.2.0] - 2023-03-09
### Added
- `fetch` options can now take `baseUrl` for defining custom base URL for the single request only

## [5.1.0] - 2023-03-08
### Added
- `getAccessToken` method for fetching the access token that's up-to-date

## [5.0.0] - 2022-10-05
### Changed
- **BREAKING CHANGE** `MapResponse` and `MapRevisionResponse` may contain `null` values in `map_provider` and `map_provider_url` fields

## [4.0.0] - 2022-09-09
### Changed
- **BREAKING CHANGE** `SDKConfigResponse` introduces nullability to some fields

## [3.0.0] - 2022-05-16
### Added
- option `profile` added to `getMapsList`

### Changed
- **BREAKING CHANGE** `getMapsList` result with more information

## [2.1.0] - 2022-04-29
### Added
- `createProvider`, `createProfile`, `createMap` dry run option

### Changed
- `createProvider` throws `CreateProviderApiError`
- `createProfile` throws `CreateProfileApiError`

## [2.0.0] - 2022-04-12
### Changed
- **BREAKING CHANGE** `getProfilesList` result with more information

## [1.1.0] - 2021-11-24
### Added
- `authenticate` option to `getProfile`, `getProfileAST`, `getProfileSource` functions

## [1.0.1] - 2021-11-23
### Fixed
- Use of URL and URLSearchParams in browser

## [1.0.0] - 2021-11-22
### Added
- new argument to `passwordless` and `getGithubLoginUrl` to be able to pass any query parameters

### Changed
- **BREAKING CHANGE** `getProfile`, `getProfileAST`, `getProfileSource` arguments changed
- parameters `scope` and `version` are  optional in `getProfile`, `getProfileAST`, `getProfileSource` functions
- **BREAKING CHANGE** `getMap`, `getMapAST`, `getMapSource` arguments changed
- parameter `scope` and `version` are optional in `getMap`, `getMapAST`, `getMapSource` functions

## [0.0.26] - 2021-10-22
### Fixed
- `getProvider` and `getProvidersList` correctly map older flat provider API response by removing the `url` param from the definition

## [0.0.25] - 2021-10-21
### Changed
- **BREAKING CHANGE** removed `Provider` interface
- **BREAKING CHANGE** nested provider definition in `ProviderResponse`
- **BREAKING CHANGE** nested provider definition in `ProviderListResponse`

## [0.0.24] - 2021-09-09
### Added
- `createProject` method for initializing new projects

## [0.0.23] - 2021-08-31
### Fixed
- include `user-session` cookie in `signOut` request

## [0.0.22] - 2021-08-27
### Added
- `shareProfile` method shares profile

## [0.0.21] - 2021-08-26
### Added
- `getUserInfo` method fetches information about logged in user

## [0.0.20] - 2021-08-25
### Fixed
- `confirmCliLogin` uses correct HTTP method

## [0.0.19] - 2021-08-25
### Added
- `getProfilesList` method fetches list of published profiles (incl. filter by profile owner & results count limit)
- `getMapsList` method fetches list of published map variants (incl. filter by map owner & results count limit)
- `cliLogin` method fetches verify and browser urls with expiration date
- `verifyCliLogin` method fetches status of CLI login
- `confirmCliLogin` method confirms CLI login

### Changed
- **BREAKING CHANGE** `findOneProvider` renamed to `getProvider`
- **BREAKING CHANGE** `findAllProviders` renamed to `getProvidersList`, now has ability to filter providers by profile and owner (incl. results count limit)
- **BREAKING CHANGE** `PasswordlessVerifyOptions` renamed to `VerifyOptions`
- **BREAKING CHANGE** `PasswordlessVerifyResponse` renamed to `VerifyResponse`
- **BREAKING CHANGE** `PasswordlessVerifyErrorResponse` renamed to `VerifyErrorResponse`
- **BREAKING CHANGE** `PasswordlessConfirmErrorResponse` renamed to `LoginConfirmErrorResponse`
- **BREAKING CHANGE** `passwordlessLogin` do not throw on json deserialization errors and returns `UnsuccessfulLogin` as result

## [0.0.18] - 2021-08-18

## [0.0.17] - 2021-06-29
### Added
- `getSDKConfiguration` method fetches SDK configuration for a given project
- `getSDKPerformStatistics` method fetches perform statistics for a given project/profile/provider
- `getSDKProviderChangesList` method lists provider changes for a given project/profile/provider

## [0.0.16] - 2021-06-17
### Added
- `getProjectsList` method lists all projects owned by the authenticated user
- `getProject` method fetches a single project
- `updateProject` method updates a project

## [0.0.15] - 2021-06-03
### Added
- `confirmPasswordlessLogin` method with logic for confirming passwordless login flow

## [0.0.14] - 2021-05-14
### Fixed
- Custom errors have properly set prototype as described in TypeScript [Documentation](https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work).

## [0.0.13] - 2021-05-14
### Changed
- Service Client throws custom errors. `ServiceClientError` as generic error from Service Client and `ServiceApiError` as error when non 2xx response is received from service apis.

## [0.0.13-beta.0] - 2021-05-13

## [0.0.12] - 2021-05-04
### Added
- `fetch` options take `authenticate` boolean parameter to optionally disable authentication (which is enabled by default)

### Changed
- the following methods now do _not_ authenticate against Brain:
  - `findAllProviders`
  - `findOneProvider`
  - `parseProfile`
  - `getProfile`
  - `getProfileSource`
  - `getProfileAST`
  - `parseMap`
  - `getMap`
  - `getMapSource`
  - `getMapAST`

## [0.0.11] - 2021-04-29
### Fixed
- Release script

## [0.0.10] - 2021-04-27
### Added
- `getGithubLoginUrl` method parameter `mode` added

## [0.0.9] - 2021-04-23
### Changed
- **BREAKING CHANGE:** `BrainClient` renamed to `ServiceClient`
- **BREAKING CHANGE:** package renamed to `@superfaceai/service-client`

## [0.0.8] - 2021-04-23
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

## 0.0.2 - 2021-04-08
### Added
- `passwordlessLogin` method to `BrainClient` which starts passworldess login flow by sending confirmation e-mail
- `verifyPasswordlessLogin` method to `BrainClient` which checks status of passwordless login
- `getGithubLoginUrl` method to `BrainClient`

[Unreleased]: https://github.com/superfaceai/service-client/compare/v5.2.1...HEAD
[5.2.1]: https://github.com/superfaceai/service-client/compare/v5.2.0...v5.2.1
[5.2.0]: https://github.com/superfaceai/service-client/compare/v5.1.0...v5.2.0
[5.1.0]: https://github.com/superfaceai/service-client/compare/v5.0.0...v5.1.0
[5.0.0]: https://github.com/superfaceai/service-client/compare/v4.0.0...v5.0.0
[4.0.0]: https://github.com/superfaceai/service-client/compare/v3.0.0...v4.0.0
[3.0.0]: https://github.com/superfaceai/service-client/compare/v2.1.0...v3.0.0
[2.1.0]: https://github.com/superfaceai/service-client/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/superfaceai/service-client/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/superfaceai/service-client/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/superfaceai/service-client/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/superfaceai/service-client/compare/v0.0.26...v1.0.0
[0.0.26]: https://github.com/superfaceai/service-client/compare/v0.0.25...v0.0.26
[0.0.25]: https://github.com/superfaceai/service-client/compare/v0.0.24...v0.0.25
[0.0.24]: https://github.com/superfaceai/service-client/compare/v0.0.23...v0.0.24
[0.0.23]: https://github.com/superfaceai/service-client/compare/v0.0.22...v0.0.23
[0.0.22]: https://github.com/superfaceai/service-client/compare/v0.0.21...v0.0.22
[0.0.21]: https://github.com/superfaceai/service-client/compare/v0.0.20...v0.0.21
[0.0.20]: https://github.com/superfaceai/service-client/compare/v0.0.19...v0.0.20
[0.0.19]: https://github.com/superfaceai/service-client/compare/v0.0.18...v0.0.19
[0.0.18]: https://github.com/superfaceai/service-client/compare/v0.0.17...v0.0.18
[0.0.17]: https://github.com/superfaceai/service-client/compare/v0.0.16...v0.0.17
[0.0.16]: https://github.com/superfaceai/service-client/compare/v0.0.15...v0.0.16
[0.0.15]: https://github.com/superfaceai/service-client/compare/v0.0.14...v0.0.15
[0.0.14]: https://github.com/superfaceai/service-client/compare/v0.0.13...v0.0.14
[0.0.13]: https://github.com/superfaceai/service-client/compare/v0.0.13-beta.0...v0.0.13
[0.0.13-beta.0]: https://github.com/superfaceai/service-client/compare/v0.0.12...v0.0.13-beta.0
[0.0.12]: https://github.com/superfaceai/service-client/compare/v0.0.11...v0.0.12
[0.0.11]: https://github.com/superfaceai/service-client/compare/v0.0.10...v0.0.11
[0.0.10]: https://github.com/superfaceai/service-client/compare/v0.0.9...v0.0.10
[0.0.9]: https://github.com/superfaceai/service-client/compare/v0.0.8...v0.0.9
[0.0.8]: https://github.com/superfaceai/service-client/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/superfaceai/service-client/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/superfaceai/service-client/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/superfaceai/service-client/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/superfaceai/service-client/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/superfaceai/service-client/compare/v0.0.2...v0.0.3
