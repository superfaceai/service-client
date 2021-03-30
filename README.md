# Brain client

Brain client provides HTTP client for communication with Superface backend services. It encapsulates user authentication.

# Usage

## Installation

`@superfaceai/brain-client` library is published on private Superface npm registry. To install private packages from `@superfaceai` GitHub organization follow the [official documentation](https://docs.github.com/en/free-pro-team@latest/packages/guides/configuring-npm-for-use-with-github-packages#authenticating-to-github-packages) to configure the authentication.

Then install library into your project directory:

```bash
yarn add @superfaceai/brain-client
```

## Basic fetch example

```ts
import { BrainClient } from '@superfaceai/brain-client';

const client = new BrainClient({
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

`BrainClient` provides `passwordlessLogin` and `verifyPasswordlessLogin` methods. Application should use them to implement passwordless login.

`passwordlessLogin` method sends e-mail with magic link to user
`verifyPasswordlessLogin` method returns refresh and access token once login has been confirmed

### Passwordless authentication sequence

1. Application (CLI, Air frontend) requests e-mail address input from user
2. Application initializes `BrainClient` via `setOptions` with Superface backend base address
3. Application calls Superface passwordless API via `BrainClient` method `passwordlessLogin(email)`
4. Superface passwordless API sends e-mail with magic link and returns verify url
5. Application checks preriodically authentication state via `BrainClient` method `verifyPasswordlessLogin(verifyUrl)`
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
