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

## Supported login grants

### Passwordless authentication using "Magic link" grant

User receives e-mail with a link. This link allow users to login directly.

#### Authentication sequence

1. Client (CLI, Air frontend) requests e-mail address from the user
2. Client initializes `BrainClient` via `setOptions` with Superface backend base address
3. Client calls passwordless Superface identity API via `BrainClient` method `passwordlessLogin(email)`
4. Superface identity provider sends e-mail with magic link
5. Client checks preriodically authentication state via `BrainClient` function `verifyPasswordlessLoginToken(token)`
6. Once user confirms login request by clicking on received link `verifyPasswordlessLoginToken(token` returns refresh token (one time action)
7. Client persists refresh token and calls `setOptions` method to hand over refresh token to `BrainClient`
8. Client can start authenticated communication to Superface backend APIs via `fetch` function provided by `BrainClient`

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
