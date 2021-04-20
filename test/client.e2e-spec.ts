import express, { json } from 'express';
import * as http from 'http';

import {
  BrainClient,
  CancellationToken,
  MapRevisionResponse,
  MEDIA_TYPE_JSON,
  MEDIA_TYPE_MAP,
  MEDIA_TYPE_MAP_AST,
  MEDIA_TYPE_PROFILE,
  MEDIA_TYPE_PROFILE_AST,
  ProfileVersionResponse,
  ProviderResponse,
} from '../src';

describe('client', () => {
  const IDENTITY_PROVIDER_PORT = 3031;
  const IDENTITY_PROVIDER_BASE_URL = `http://localhost:${IDENTITY_PROVIDER_PORT}`;

  let identityServer: http.Server;
  let brainClient: BrainClient;

  describe('fetch', () => {
    beforeAll(() => {
      const identity = createExpressMock();
      identity.get('/test', (req: express.Request, res: express.Response) => {
        if (req.headers?.authorization === 'Bearer AT') {
          res.sendStatus(200);
        } else {
          res.sendStatus(401);
        }
      });
      identityServer = identity.listen(IDENTITY_PROVIDER_PORT);
      brainClient = new BrainClient();
      brainClient.setOptions({
        baseUrl: IDENTITY_PROVIDER_BASE_URL,
        refreshToken: 'RT',
      });
    });

    afterAll(() => {
      identityServer.close();
    });

    it('refreshAccessToken returns access token', async () => {
      expect(await brainClient.refreshAccessToken()).toEqual({
        access_token: 'AT',
      });
    });

    it('fetch passes access token in authorization header', async () => {
      expect((await brainClient.fetch('/test')).status).toBe(200);
    });
  });

  describe('passwordless flow', () => {
    const identityServerState = {
      mockedTokenVerificationStatus: 'PENDING',
      verificationTokenExpiresAt: new Date('2021-04-13T12:08:27.103Z'),
    };

    beforeAll(() => {
      brainClient = new BrainClient();
      brainClient.setOptions({
        baseUrl: IDENTITY_PROVIDER_BASE_URL,
      });
      identityServer = runMockedPasswordlessIdentityServer(
        IDENTITY_PROVIDER_BASE_URL,
        IDENTITY_PROVIDER_PORT,
        identityServerState
      );
    });

    afterAll(() => {
      identityServer.close();
    });

    test('call verifyPasswordlessLogin with confirmed token', async () => {
      identityServerState.mockedTokenVerificationStatus = 'CONFIRMED';
      const { verifyUrl } = await brainClient.passwordlessLogin(
        'mail@johndoe.com'
      );
      const result = await brainClient.verifyPasswordlessLogin(verifyUrl);
      expect(result.verificationStatus).toBe('CONFIRMED');
      expect(result.authToken).toEqual({
        access_token: 'AT',
        token_type: 'Bearer',
        expires_in: 1,
      });
    });

    test('call verifyPasswordlessLogin with unconfirmed token', async () => {
      identityServerState.mockedTokenVerificationStatus = 'PENDING';
      const { verifyUrl } = await brainClient.passwordlessLogin(
        'mail@johndoe.com'
      );
      const result = await brainClient.verifyPasswordlessLogin(verifyUrl, {
        pollingTimeoutSeconds: 1,
      });
      expect(result.verificationStatus).toBe('POLLING_TIMEOUT');
    });

    test('call verifyPasswordlessLogin with expired token', async () => {
      identityServerState.mockedTokenVerificationStatus = 'EXPIRED';
      const { verifyUrl } = await brainClient.passwordlessLogin(
        'mail@johndoe.com'
      );
      const result = await brainClient.verifyPasswordlessLogin(verifyUrl);
      expect(result.verificationStatus).toBe('EXPIRED');
    });

    test('call verifyPasswordlessLogin with used token', async () => {
      identityServerState.mockedTokenVerificationStatus = 'USED';
      const { verifyUrl } = await brainClient.passwordlessLogin(
        'mail@johndoe.com'
      );
      const result = await brainClient.verifyPasswordlessLogin(verifyUrl);
      expect(result.verificationStatus).toBe('USED');
    });

    test('cancel verifyPasswordlessLogin polling', async () => {
      identityServerState.mockedTokenVerificationStatus = 'PENDING';
      const { verifyUrl } = await brainClient.passwordlessLogin(
        'mail@johndoe.com'
      );
      const cancellationToken = new CancellationToken();
      const verifyPromise = brainClient.verifyPasswordlessLogin(verifyUrl, {
        pollingTimeoutSeconds: 10,
        cancellationToken,
      });
      cancellationToken.isCancellationRequested = true;
      const verifyResult = await verifyPromise;
      expect(verifyResult.verificationStatus).toBe('POLLING_CANCELLED');
    });
  });

  describe('providers', () => {
    const mockResult: ProviderResponse = {
      url: 'testUrl',
      name: 'testName',
      deployments: [],
      security: [],
    };
    beforeAll(() => {
      const identity = createExpressMock();
      identity.post(
        '/providers',
        (req: express.Request, res: express.Response) => {
          if (req.headers?.authorization === 'Bearer AT') {
            res.sendStatus(200);
          } else {
            res.sendStatus(401);
          }
        }
      );
      identity.get(
        '/providers',
        (req: express.Request, res: express.Response) => {
          if (req.headers?.authorization === 'Bearer AT') {
            res.json([mockResult]);
          } else {
            res.sendStatus(401);
          }
        }
      );
      identity.get(
        '/providers/test',
        (req: express.Request, res: express.Response) => {
          if (req.headers?.authorization === 'Bearer AT') {
            res.json(mockResult);
          } else {
            res.sendStatus(401);
          }
        }
      );
      identityServer = identity.listen(IDENTITY_PROVIDER_PORT);
      brainClient = new BrainClient();
      brainClient.setOptions({
        baseUrl: IDENTITY_PROVIDER_BASE_URL,
        refreshToken: 'RT',
      });
    });

    afterAll(() => {
      identityServer.close();
    });

    test('create provider', async () => {
      await expect(
        brainClient.createProvider('testPayload')
      ).resolves.toBeUndefined();
    });

    test('find all providers', async () => {
      await expect(brainClient.findAllProviders()).resolves.toEqual([
        mockResult,
      ]);
    });

    test('find one provider', async () => {
      await expect(brainClient.findOneProvider('test')).resolves.toEqual(
        mockResult
      );
    });
  });

  describe('profiles', () => {
    const mockProfileSource = 'profileSource';
    const mockProfileAST = {
      kind: 'ProfileDocument',
    };

    const mockResult: ProfileVersionResponse = {
      profile_id: 'testId',
      profile_name: 'testName',
      profile_version: '1.0.0',
      url: 'testUrl',
      published_at: new Date(),
      published_by: 'test',
      owner: 'testOwner',
      owner_url: 'testOwnerUrl',
    };

    beforeAll(() => {
      const identity = createExpressMock();
      identity.post(
        '/profiles',
        (req: express.Request, res: express.Response) => {
          if (req.headers?.authorization === 'Bearer AT') {
            res.sendStatus(200);
          } else {
            res.sendStatus(401);
          }
        }
      );
      identity.post('/parse', (req: express.Request, res: express.Response) => {
        if (req.headers?.authorization === 'Bearer AT') {
          if (req.headers?.['content-type'] === MEDIA_TYPE_PROFILE) {
            res
              .status(200)
              .contentType(MEDIA_TYPE_PROFILE_AST)
              .json(mockProfileAST);
          }
        } else {
          res.sendStatus(401);
        }
      });
      identity.get(
        '/vcs/user-repos@1.0.0',
        (req: express.Request, res: express.Response) => {
          if (req.headers?.authorization === 'Bearer AT') {
            switch (req.headers?.accept) {
              case MEDIA_TYPE_JSON:
                res.json(mockResult);
                break;
              case MEDIA_TYPE_PROFILE:
                res.send(mockProfileSource);
                break;
              case MEDIA_TYPE_PROFILE_AST:
                res.send(mockProfileAST);
                break;
              default:
                res.sendStatus(400);
                break;
            }
            res.json(mockResult);
          } else {
            res.sendStatus(401);
          }
        }
      );
      identityServer = identity.listen(IDENTITY_PROVIDER_PORT);
      brainClient = new BrainClient();
      brainClient.setOptions({
        baseUrl: IDENTITY_PROVIDER_BASE_URL,
        refreshToken: 'RT',
      });
    });

    afterAll(() => {
      identityServer.close();
    });

    test('create profile', async () => {
      await expect(
        brainClient.createProfile('testPayload')
      ).resolves.toBeUndefined();
    });

    test('parse profile', async () => {
      await expect(brainClient.parseProfile('testPayload')).resolves.toEqual(
        JSON.stringify(mockProfileAST)
      );
    });

    test('get profile', async () => {
      await expect(
        brainClient.getProfile('vcs', '1.0.0', 'user-repos')
      ).resolves.toEqual({
        ...mockResult,
        published_at: mockResult.published_at.toJSON(),
      });
    });

    test('get profile source', async () => {
      await expect(
        brainClient.getProfileSource('vcs', '1.0.0', 'user-repos')
      ).resolves.toEqual(mockProfileSource);
    });
    test('get profile AST', async () => {
      await expect(
        brainClient.getProfileAST('vcs', '1.0.0', 'user-repos')
      ).resolves.toEqual(JSON.stringify(mockProfileAST));
    });
  });

  describe('maps', () => {
    const mockMapSource = 'mapSource';
    const mockMapAST = {
      kind: 'MappDocument',
    };

    const mockResult: MapRevisionResponse = {
      map_id: 'testId',
      profile_name: 'testName',
      profile_version: '1.0.0',
      url: 'testUrl',
      published_at: new Date(),
      published_by: 'test',
      owner: 'testOwner',
      owner_url: 'testOwnerUrl',
      profile_url: 'testprofileUrl',
      map_revision: 'testRevision',
      map_provider: 'testProvider',
      map_provider_url: 'testProviderUrl',
      map_variant: 'testMapVariant',
    };

    beforeAll(() => {
      const identity = createExpressMock();
      identity.post('/maps', (req: express.Request, res: express.Response) => {
        if (req.headers?.authorization === 'Bearer AT') {
          res.sendStatus(200);
        } else {
          res.sendStatus(401);
        }
      });
      identity.post('/parse', (req: express.Request, res: express.Response) => {
        if (req.headers?.authorization === 'Bearer AT') {
          if (req.headers?.['content-type'] === MEDIA_TYPE_MAP) {
            res.status(200).contentType(MEDIA_TYPE_MAP_AST).json(mockMapAST);
          }
        } else {
          res.sendStatus(401);
        }
      });
      identity.get(
        '/vcs/user-repos.github@1.0.0',
        (req: express.Request, res: express.Response) => {
          if (req.headers?.authorization === 'Bearer AT') {
            switch (req.headers?.accept) {
              case MEDIA_TYPE_JSON:
                res.json(mockResult);
                break;
              case MEDIA_TYPE_MAP:
                res.send(mockMapSource);
                break;
              case MEDIA_TYPE_MAP_AST:
                res.send(mockMapAST);
                break;
              default:
                res.sendStatus(400);
                break;
            }
            res.json(mockResult);
          } else {
            res.sendStatus(401);
          }
        }
      );
      identityServer = identity.listen(IDENTITY_PROVIDER_PORT);
      brainClient = new BrainClient();
      brainClient.setOptions({
        baseUrl: IDENTITY_PROVIDER_BASE_URL,
        refreshToken: 'RT',
      });
    });

    afterAll(() => {
      identityServer.close();
    });

    test('create map', async () => {
      await expect(
        brainClient.createMap('testPayload')
      ).resolves.toBeUndefined();
    });

    test('parse map', async () => {
      await expect(brainClient.parseMap('testPayload')).resolves.toEqual(
        JSON.stringify(mockMapAST)
      );
    });

    test('get map', async () => {
      await expect(
        brainClient.getMap('vcs', '1.0.0', 'user-repos', 'github')
      ).resolves.toEqual({
        ...mockResult,
        published_at: mockResult.published_at.toJSON(),
      });
    });

    test('get map source', async () => {
      await expect(
        brainClient.getMapSource('vcs', '1.0.0', 'user-repos', 'github')
      ).resolves.toEqual(mockMapSource);
    });
    test('get map AST', async () => {
      await expect(
        brainClient.getMapAST('vcs', '1.0.0', 'user-repos', 'github')
      ).resolves.toEqual(JSON.stringify(mockMapAST));
    });
  });
});

function createExpressMock(): express.Application {
  const identity = express();
  identity.post(
    '/auth/token',
    (req: express.Request, res: express.Response) => {
      if (req.headers?.cookie === 'user_session=RT') {
        res.status(201).send({
          access_token: 'AT',
        });
      } else {
        res.sendStatus(401);
      }
    }
  );

  return identity
}

function runMockedPasswordlessIdentityServer(
  baseUrl: string,
  port: number,
  identityServerState: {
    mockedTokenVerificationStatus: string;
    verificationTokenExpiresAt: Date;
  }
) {
  const identity = express();
  const TOKEN_VALUE = 'TOKEN_VALUE';
  identity.use(json());
  identity.post(
    '/auth/passwordless',
    (req: express.Request, res: express.Response) => {
      // eslint-disable-next-line
      const email = req.body?.email;
      if (email) {
        res.status(200).send({
          verify_url: `${baseUrl}/auth/passwordless/verify?email=${encodeURIComponent(
            email
          )}&token=${TOKEN_VALUE}`,
          expires_at: identityServerState.verificationTokenExpiresAt.toISOString(),
        });
      } else {
        res.status(400);
      }
    }
  );
  identity.get(
    '/auth/passwordless/verify',
    (req: express.Request, res: express.Response) => {
      if (req.query?.token === TOKEN_VALUE) {
        const verificationStatus =
          identityServerState.mockedTokenVerificationStatus;
        switch (verificationStatus) {
          case 'CONFIRMED':
            res.status(200).send({
              access_token: 'AT',
              token_type: 'Bearer',
              expires_in: 1,
            });
            break;
          default:
            res.status(400).send({
              title: 'Title',
              status: verificationStatus,
            });
            break;
        }
      } else {
        res.sendStatus(401);
      }
    }
  );

  return identity.listen(port);
}
