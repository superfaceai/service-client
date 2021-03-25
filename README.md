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
