# Superface Service Client _(service-client)_

This repository provides HTTP client for communication with Superface services. If you are not from Superface Team, you probably don't need this library.

## Table of Contents

- [Superface Service Client _(service-client)_](#superface-service-client-service-client)
  - [Table of Contents](#table-of-contents)
  - [Background](#background)
  - [Install](#install)
  - [Usage](#usage)
    - [Fetch](#fetch)
    - [Passwordless Authentication Flow](#passwordless-authentication-flow)
      - [Passwordless authentication sequence](#passwordless-authentication-sequence)
  - [Development](#development)
  - [Maintainers](#maintainers)
  - [Contributing](#contributing)
  - [License](#license)

## Background

Superface (super-interface) is a higher-order API, an abstraction on top of the modern APIs like GraphQL and REST. Superface is one interface to discover, connect, and query any capabilities available via conventional APIs.

Through its focus on application-level semantics, Superface decouples the clients from servers, enabling fully autonomous evolution. As such it minimizes the code base as well as errors and downtimes while providing unmatched resiliency and redundancy.

Superface allows for switching capability providers without development at a runtime in milliseconds. Furthermore, Superface decentralizes the composition and aggregation, and thus creates an Autonomous Integration Mesh.

Motivation behind Superface is nicely described in this [video](https://www.youtube.com/watch?v=BCvq3NXFb94) from APIdays conference.

You can get more information at https://superface.ai and https://superface.ai/docs.

## Install

Install dependencies:

```
yarn install
```

Build TS files:

```
yarn build
```

## Usage

- [Fetch](#fetch)
- [Passwordless Authentication Flow](#passwordless-authentication-flow)

### Fetch

Fetches specified URL. Method adds authorization header to the request by default.

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

### Passwordless Authentication Flow

Passwordless flow allows user to login by clicking on magic link in e-mail. As result of passwordless flow application will receive access and refresh tokens.

`ServiceClient` provides `passwordlessLogin` and `verifyPasswordlessLogin` methods. Application should use them to implement passwordless login.

`passwordlessLogin` method sends e-mail with magic link to user
`verifyPasswordlessLogin` method returns refresh and access token once login has been confirmed

#### Passwordless authentication sequence

1. Application requests e-mail address input from user
2. Application initializes `ServiceClient` via `setOptions` with Superface backend base address
3. Application calls Superface passwordless API via `ServiceClient` method `passwordlessLogin(email)`
4. Superface passwordless API sends e-mail with magic link and returns verify url
5. Application checks preriodically authentication state via `ServiceClient` method `verifyPasswordlessLogin(verifyUrl)`
6. Once user confirms login request by clicking on received link `verifyPasswordlessLogin(token)` method returns access and refresh tokens (one time action)
7. Application persists refresh token (Air can rely on auth cookie)
8. Application can start authenticated communication to Superface backend APIs via `fetch` method

## Development

When developing, start with cloning the repository using `git clone https://github.com/superfaceai/service-client.git` (or `git clone git@github.com:superfaceai/service-client.git` if you have repository access).

After cloning, the dependencies must be downloaded using `yarn install` or `npm install`.

Now the repository is ready for code changes.

The `package.json` also contains scripts (runnable by calling `yarn <script-name>` or `npm run <script-name>`):

- `lint` - lint the code (use `lint --fix` to run autofix)
- `test` - run unit tests
- `test-e2e` - run end to end tests

Lastly, to build a local artifact run `yarn build` or `npm run build`.

## Maintainers

- [@Jan Halama](https://github.com/janhalama)

## Contributing

**Please open an issue first if you want to make larger changes**

Feel free to contribute! Please follow the [Contribution Guide](CONTRIBUTION_GUIDE.md).

Licenses of node_modules are checked during CI/CD for every commit. Only the following licenses are allowed:

- 0BDS
- MIT
- Apache-2.0
- ISC
- BSD-3-Clause
- BSD-2-Clause
- CC-BY-4.0
- CC-BY-3.0;BSD
- CC0-1.0
- Unlicense
- UNLICENSED

Note: If editing the README, please conform to the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

The Superface is licensed under the [MIT](LICENSE).
© 2021 Superface
