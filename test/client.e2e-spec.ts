import express, { json } from 'express';
import * as http from 'http';

import {
  CancellationToken,
  LoginConfirmationErrorCode,
  MapRevisionResponse,
  MEDIA_TYPE_JSON,
  MEDIA_TYPE_MAP,
  MEDIA_TYPE_MAP_AST,
  MEDIA_TYPE_PROFILE,
  MEDIA_TYPE_PROFILE_AST,
  ProfileVersionResponse,
  ProjectResponse,
  ProjectsListResponse,
  ProviderResponse,
  ServiceClient,
  SuccessfulConfirm,
  SuccessfulLogin,
  UnsuccessfulConfirm,
} from '../src';
import { ProjectUpdateBody } from '../src/interfaces/projects_api_options';

describe('client', () => {
  const IDENTITY_PROVIDER_PORT = 3031;
  const IDENTITY_PROVIDER_BASE_URL = `http://localhost:${IDENTITY_PROVIDER_PORT}`;

  let identityServer: http.Server;
  let serviceClient: ServiceClient;

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
      serviceClient = new ServiceClient();
      serviceClient.setOptions({
        baseUrl: IDENTITY_PROVIDER_BASE_URL,
        refreshToken: 'RT',
      });
    });

    afterAll(() => {
      identityServer.close();
    });

    it('refreshAccessToken returns access token', async () => {
      expect(await serviceClient.refreshAccessToken()).toEqual({
        access_token: 'AT',
      });
    });

    it('fetch by default passes access token in authorization header', async () => {
      expect((await serviceClient.fetch('/test')).status).toBe(200);
    });

    it("fetch without authentication doesn't use authorization header", async () => {
      expect(
        (await serviceClient.fetch('/test', { authenticate: false })).status
      ).toBe(401);
    });
  });

  describe('passwordless flow', () => {
    const confirmEmail = 'some.user+shared@superface.test';
    const confirmCode = 'CODE1234';

    const identityServerState = {
      mockedTokenVerificationStatus: 'PENDING',
      verificationTokenExpiresAt: new Date('2021-04-13T12:08:27.103Z'),
      expectedConfirmEmail: confirmEmail,
      expectedConfirmCode: confirmCode,
    };

    beforeAll(() => {
      serviceClient = new ServiceClient();
      serviceClient.setOptions({
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
      const { verifyUrl } = (await serviceClient.passwordlessLogin(
        'mail@johndoe.com'
      )) as SuccessfulLogin;
      const result = await serviceClient.verifyPasswordlessLogin(verifyUrl);
      expect(result.verificationStatus).toBe('CONFIRMED');
      expect(result.authToken).toEqual({
        access_token: 'AT',
        token_type: 'Bearer',
        expires_in: 1,
      });
    });

    test('call verifyPasswordlessLogin with unconfirmed token', async () => {
      identityServerState.mockedTokenVerificationStatus = 'PENDING';
      const { verifyUrl } = (await serviceClient.passwordlessLogin(
        'mail@johndoe.com'
      )) as SuccessfulLogin;
      const result = await serviceClient.verifyPasswordlessLogin(verifyUrl, {
        pollingTimeoutSeconds: 1,
      });
      expect(result.verificationStatus).toBe('POLLING_TIMEOUT');
    });

    test('call verifyPasswordlessLogin with expired token', async () => {
      identityServerState.mockedTokenVerificationStatus = 'EXPIRED';
      const { verifyUrl } = (await serviceClient.passwordlessLogin(
        'mail@johndoe.com'
      )) as SuccessfulLogin;
      const result = await serviceClient.verifyPasswordlessLogin(verifyUrl);
      expect(result.verificationStatus).toBe('EXPIRED');
    });

    test('call verifyPasswordlessLogin with used token', async () => {
      identityServerState.mockedTokenVerificationStatus = 'USED';
      const { verifyUrl } = (await serviceClient.passwordlessLogin(
        'mail@johndoe.com'
      )) as SuccessfulLogin;
      const result = await serviceClient.verifyPasswordlessLogin(verifyUrl);
      expect(result.verificationStatus).toBe('USED');
    });

    test('cancel verifyPasswordlessLogin polling', async () => {
      identityServerState.mockedTokenVerificationStatus = 'PENDING';
      const { verifyUrl } = (await serviceClient.passwordlessLogin(
        'mail@johndoe.com'
      )) as SuccessfulLogin;
      const cancellationToken = new CancellationToken();
      const verifyPromise = serviceClient.verifyPasswordlessLogin(verifyUrl, {
        pollingTimeoutSeconds: 10,
        cancellationToken,
      });
      cancellationToken.isCancellationRequested = true;
      const verifyResult = await verifyPromise;
      expect(verifyResult.verificationStatus).toBe('POLLING_CANCELLED');
    });

    test('call confirmPasswordlessLogin with expected email & code', async () => {
      const { success } = (await serviceClient.confirmPasswordlessLogin(
        confirmEmail,
        confirmCode
      )) as SuccessfulConfirm;

      expect(success).toBe(true);
    });

    test('call confirmPasswordlessLogin with unknown email & code', async () => {
      const { success, code } = (await serviceClient.confirmPasswordlessLogin(
        'random@email.test',
        'random-code'
      )) as UnsuccessfulConfirm;

      expect(success).toBe(false);
      expect(code).toBe(LoginConfirmationErrorCode.INVALID);
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
        (_req: express.Request, res: express.Response) => {
          res.json([mockResult]);
        }
      );
      identity.get(
        '/providers/test',
        (_req: express.Request, res: express.Response) => {
          res.json(mockResult);
        }
      );
      identityServer = identity.listen(IDENTITY_PROVIDER_PORT);
      serviceClient = new ServiceClient();
      serviceClient.setOptions({
        baseUrl: IDENTITY_PROVIDER_BASE_URL,
        refreshToken: 'RT',
      });
    });

    afterAll(() => {
      identityServer.close();
    });

    test('create provider', async () => {
      await expect(
        serviceClient.createProvider('testPayload')
      ).resolves.toBeUndefined();
    });

    test('find all providers', async () => {
      await expect(serviceClient.findAllProviders()).resolves.toEqual([
        mockResult,
      ]);
    });

    test('find one provider', async () => {
      await expect(serviceClient.findOneProvider('test')).resolves.toEqual(
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
        if (req.headers?.['content-type'] === MEDIA_TYPE_PROFILE) {
          res
            .status(200)
            .contentType(MEDIA_TYPE_PROFILE_AST)
            .json(mockProfileAST);
        } else {
          res.sendStatus(400);
        }
      });
      identity.get(
        '/vcs/user-repos@1.0.0',
        (req: express.Request, res: express.Response) => {
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
        }
      );
      identityServer = identity.listen(IDENTITY_PROVIDER_PORT);
      serviceClient = new ServiceClient();
      serviceClient.setOptions({
        baseUrl: IDENTITY_PROVIDER_BASE_URL,
        refreshToken: 'RT',
      });
    });

    afterAll(() => {
      identityServer.close();
    });

    test('create profile', async () => {
      await expect(
        serviceClient.createProfile('testPayload')
      ).resolves.toBeUndefined();
    });

    test('parse profile', async () => {
      await expect(serviceClient.parseProfile('testPayload')).resolves.toEqual(
        JSON.stringify(mockProfileAST)
      );
    });

    test('get profile', async () => {
      await expect(
        serviceClient.getProfile('vcs', '1.0.0', 'user-repos')
      ).resolves.toEqual({
        ...mockResult,
        published_at: mockResult.published_at.toJSON(),
      });
    });

    test('get profile source', async () => {
      await expect(
        serviceClient.getProfileSource('vcs', '1.0.0', 'user-repos')
      ).resolves.toEqual(mockProfileSource);
    });
    test('get profile AST', async () => {
      await expect(
        serviceClient.getProfileAST('vcs', '1.0.0', 'user-repos')
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
        if (req.headers?.['content-type'] === MEDIA_TYPE_MAP) {
          res.status(200).contentType(MEDIA_TYPE_MAP_AST).json(mockMapAST);
        } else {
          res.sendStatus(400);
        }
      });
      identity.get(
        '/vcs/user-repos.github@1.0.0',
        (req: express.Request, res: express.Response) => {
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
        }
      );
      identityServer = identity.listen(IDENTITY_PROVIDER_PORT);
      serviceClient = new ServiceClient();
      serviceClient.setOptions({
        baseUrl: IDENTITY_PROVIDER_BASE_URL,
        refreshToken: 'RT',
      });
    });

    afterAll(() => {
      identityServer.close();
    });

    test('create map', async () => {
      await expect(
        serviceClient.createMap('testPayload')
      ).resolves.toBeUndefined();
    });

    test('parse map', async () => {
      await expect(serviceClient.parseMap('testPayload')).resolves.toEqual(
        JSON.stringify(mockMapAST)
      );
    });

    test('get map', async () => {
      await expect(
        serviceClient.getMap('vcs', '1.0.0', 'user-repos', 'github')
      ).resolves.toEqual({
        ...mockResult,
        published_at: mockResult.published_at.toJSON(),
      });
    });

    test('get map source', async () => {
      await expect(
        serviceClient.getMapSource('vcs', '1.0.0', 'user-repos', 'github')
      ).resolves.toEqual(mockMapSource);
    });
    test('get map AST', async () => {
      await expect(
        serviceClient.getMapAST('vcs', '1.0.0', 'user-repos', 'github')
      ).resolves.toEqual(JSON.stringify(mockMapAST));
    });
  });

  describe('projects', () => {
    const owner = 'username';
    const name = 'project-name';

    const mockProjectUpdate: ProjectUpdateBody = {
      settings: { email_notifications: false },
    };

    const mockExistingProject: ProjectResponse = {
      url: `https://superface.test/projects/${owner}/${name}`,
      name,
      sdk_auth_tokens: [
        { token: 't0k3n', created_at: '2021-06-04T07:11:34.114Z' },
      ],
      settings: { email_notifications: true },
      created_at: '2021-06-04T07:11:34.114Z',
    };

    const mockUpdatedProject: ProjectResponse = {
      ...mockExistingProject,
      settings: {
        ...mockExistingProject.settings,
        email_notifications: false,
      },
    };

    const mockProjectsList: ProjectsListResponse = {
      url: '/projects',
      data: [mockExistingProject],
    };

    beforeAll(() => {
      const projects = createExpressMock();
      projects.use(json());
      projects.get(
        '/projects',
        (_req: express.Request, res: express.Response) => {
          res.json(mockProjectsList);
        }
      );
      projects.get(
        `/projects/${owner}/${name}`,
        (_req: express.Request, res: express.Response) => {
          res.json(mockExistingProject);
        }
      );
      projects.patch(
        `/projects/${owner}/${name}`,
        (req: express.Request, res: express.Response) => {
          if (
            (req.body as ProjectUpdateBody)?.settings?.email_notifications ===
            undefined
          ) {
            res.sendStatus(400);
          } else {
            res.json(mockUpdatedProject);
          }
        }
      );
      identityServer = projects.listen(IDENTITY_PROVIDER_PORT);
      serviceClient = new ServiceClient();
      serviceClient.setOptions({
        baseUrl: IDENTITY_PROVIDER_BASE_URL,
        refreshToken: 'RT',
      });
    });

    afterAll(() => {
      identityServer.close();
    });

    test('get all projects', async () => {
      await expect(serviceClient.getProjectsList()).resolves.toEqual(
        mockProjectsList
      );
    });

    test('get a single project', async () => {
      await expect(serviceClient.getProject(owner, name)).resolves.toEqual(
        mockExistingProject
      );
    });

    test('update a project', async () => {
      await expect(
        serviceClient.updateProject(owner, name, mockProjectUpdate)
      ).resolves.toEqual(mockUpdatedProject);
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

  return identity;
}

function runMockedPasswordlessIdentityServer(
  baseUrl: string,
  port: number,
  identityServerState: {
    mockedTokenVerificationStatus: string;
    verificationTokenExpiresAt: Date;
    expectedConfirmEmail: string;
    expectedConfirmCode: string;
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
  identity.get(
    '/auth/passwordless/confirm',
    (req: express.Request, res: express.Response) => {
      const { email, code } = req.query || {};

      if (
        decodeURIComponent(email as string) ===
          identityServerState.expectedConfirmEmail &&
        code === identityServerState.expectedConfirmCode
      ) {
        res.status(200).send({ status: 'CONFIRMED' });
      } else {
        res.status(400).send({
          status: 400,
          instance: '/auth/passwordless/confirm',
          title: "Email doesn't match",
          detail: `Email ${email} doesn't match with email for confirmation`,
        });
      }
    }
  );

  return identity.listen(port);
}
