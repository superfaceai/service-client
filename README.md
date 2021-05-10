# Service client

Service client provides HTTP client for communication with Superface backend services. It encapsulates user authentication.

# Usage

## Installation

Install library into your project directory:

```bash
yarn add @superfaceai/service-client
```

## Basic fetch example

```ts
import { ServiceClient } from '@superfaceai/service-client';

const client = new ServiceClient({
  baseUrl: 'https://superface.dev',
  refreshToken: '<refresh token>',
});

const response = client.fetch('/providers', {
  method: 'POST',
  ...
});
```

## Passwordless flow

Passwordless flow allows user to login by clicking on magic link in e-mail. As result of passwordless flow application will receive access and refresh tokens.

`ServiceClient` provides `passwordlessLogin` and `verifyPasswordlessLogin` methods. Application should use them to implement passwordless login.

`passwordlessLogin` method sends e-mail with magic link to user
`verifyPasswordlessLogin` method returns refresh and access token once login has been confirmed

### Passwordless authentication sequence

1. Application requests e-mail address input from user
2. Application initializes `ServiceClient` via `setOptions` with Superface backend base address
3. Application calls Superface passwordless API via `ServiceClient` method `passwordlessLogin(email)`
4. Superface passwordless API sends e-mail with magic link and returns verify url
5. Application checks preriodically authentication state via `ServiceClient` method `verifyPasswordlessLogin(verifyUrl)`
6. Once user confirms login request by clicking on received link `verifyPasswordlessLogin(token)` method returns access and refresh tokens (one time action)
7. Application persists refresh token (Air can rely on auth cookie)
8. Application can start authenticated communication to Superface backend APIs via `fetch` method

# Development

## Install

```bash
$ yarn install
```

## Testing

### Run unit tests

```bash
$ yarn test
```

## Run end to end tests

```bash
$ yarn test:e2e
```

# Releasing and publishing

Getting your change released and published to NPM repository consist of following steps:

1. Proposing the change by open Pull Request -> [Opening Pull Request](#opening-pull-request)
2. Getting approval from second developer -> [Code Review](#code-review)
3. Merging to `main` branch
4. Starting `Release package` Github Actions workflow -> [Release package](#release-package)

### Opening Pull Request

You shouldn't merge directly to `main` branch, but open [Pull Request](https://github.com/superfaceai/service-client/compare). PR should have changes documented in CHANGELOG.md and passing Tests. Once it is ready review should be requested from someone.

To open not ready PR, you can either use [Draft Pull Request](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/about-pull-requests#draft-pull-requests) or simply prefix PR description with `WIP`.

### Code Review

The intention here is to get another pair of eyes on the code. No real process or rules applies here, just keep in mind that the goal of the review is to

- share knowledge about the code
- allow other to give feedback
- find bugs early

### Release package

To release new version of package trigger manually `Release package` workflow from [Github actions](https://github.com/superfaceai/service-client/actions). Release package workflow takes `Release level` parameter which can be one of: `patch`, `minor`, `major`, `prepatch`, `preminor`, `premajor`, `prerelease` values. See [npm version](https://docs.npmjs.com/cli/v7/commands/npm-version) CLI documentation for more information. To decide which version should be bumped stick with [semver](https://semver.org/) versioning rules.
