import express, { json } from 'express';
import * as http from 'http';

import {
  CancellationToken,
  LoginConfirmationErrorCode,
  MapResponse,
  MapRevisionResponse,
  MEDIA_TYPE_JSON,
  MEDIA_TYPE_MAP,
  MEDIA_TYPE_MAP_AST,
  MEDIA_TYPE_PROFILE,
  MEDIA_TYPE_PROFILE_AST,
  ProfileResponse,
  ProjectResponse,
  ProjectsListResponse,
  SDKConfigResponse,
  SDKPerformStatisticsResponse,
  SDKProviderChangesListResponse,
  SDKProviderChangeType,
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
    const mockResult = {
      provider_id: 'testName',
      url: 'testUrl',
      owner: 'superface',
      owner_url: 'ownerUrl',
      published_at: new Date().toJSON(),
      published_by: 'John Doe <john.doe@email.com>',
      definition: {
        name: 'testName',
        services: [{ id: 'default', baseUrl: 'http://superface.test/api' }],
        defaultService: 'default',
      },
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
          res.json({
            url: '/providers',
            data: [mockResult],
          });
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
      await expect(serviceClient.getProvidersList()).resolves.toEqual({
        url: '/providers',
        data: [mockResult],
      });
    });

    test('find one provider', async () => {
      await expect(serviceClient.getProvider('test')).resolves.toEqual(
        mockResult
      );
    });
  });

  describe('profiles', () => {
    const mockProfileSource = 'profileSource';
    const mockProfileAST = {
      kind: 'ProfileDocument',
    };

    const mockProfile: ProfileResponse = {
      profile_id: 'vcs/user-repos',
      profile_name: 'Profile Name',
      profile_description: 'This is profile for unit test',
      profile_version: '1.0.1',
      url: 'https://superface.test/vcs/user-repos',
      published_at: new Date('2022-04-05T06:36:01.854Z'),
      published_by: 'Test User <test@superface.ai>',
      owner: 'testaccount',
      owner_url: '',
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
      identity.get(
        '/profiles',
        (_req: express.Request, res: express.Response) => {
          res.json({
            url: '/profiles',
            data: [mockProfile],
          });
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
              res.json(mockProfile);
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
          res.json(mockProfile);
        }
      );
      identity.get(
        '/vcs/user-repos',
        (req: express.Request, res: express.Response) => {
          switch (req.headers?.accept) {
            case MEDIA_TYPE_JSON:
            case MEDIA_TYPE_PROFILE:
            case MEDIA_TYPE_PROFILE_AST:
              res.setHeader('location', '/vcs/user-repos@1.0.0');
              res.sendStatus(302);
              break;
            default:
              res.sendStatus(400);
              break;
          }
          res.json(mockProfile);
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
        serviceClient.getProfile({
          name: 'user-repos',
          version: '1.0.0',
          scope: 'vcs',
        })
      ).resolves.toEqual({
        ...mockProfile,
        published_at: mockProfile.published_at.toJSON(),
      });
    });

    test('get profile without version', async () => {
      await expect(
        serviceClient.getProfile({ name: 'user-repos', scope: 'vcs' })
      ).resolves.toEqual({
        ...mockProfile,
        published_at: mockProfile.published_at.toJSON(),
      });
    });

    test('get profile source', async () => {
      await expect(
        serviceClient.getProfileSource({
          name: 'user-repos',
          version: '1.0.0',
          scope: 'vcs',
        })
      ).resolves.toEqual(mockProfileSource);
    });

    test('get profile AST', async () => {
      await expect(
        serviceClient.getProfileAST({
          name: 'user-repos',
          version: '1.0.0',
          scope: 'vcs',
        })
      ).resolves.toEqual(JSON.stringify(mockProfileAST));
    });

    test('get profiles list', async () => {
      await expect(serviceClient.getProfilesList()).resolves.toEqual({
        url: '/profiles',
        data: [
          {
            ...mockProfile,
            published_at: mockProfile.published_at.toJSON(),
          },
        ],
      });
    });
  });

  describe('maps', () => {
    const mockMapSource = 'mapSource';
    const mockMapAST = {
      kind: 'MappDocument',
    };

    const mockMap: MapResponse = {
      map_id: 'vcs/user-repos.provider@1.0',
      profile_name: 'testName',
      profile_version: '1.0.0',
      published_at: new Date(),
      published_by: 'test',
      owner: 'testOwner',
      owner_url: '',
      profile_url: 'https://superface.test/vcs/user-repos',
      map_provider: 'provider',
      map_provider_url: 'https://superface.test/providers/provider',
      map_variant: 'generated',
      map_revision: '1',
      url: 'https://superface.test/vcs/user-repos.provider@1.0',
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
      identity.get('/maps', (_req: express.Request, res: express.Response) => {
        res.json({
          url: '/maps',
          data: [mockMap],
        });
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
        serviceClient.getMap({
          scope: 'vcs',
          name: 'user-repos',
          provider: 'github',
          version: '1.0.0',
        })
      ).resolves.toEqual({
        ...mockResult,
        published_at: mockResult.published_at.toJSON(),
      });
    });

    test('get map source', async () => {
      await expect(
        serviceClient.getMapSource({
          scope: 'vcs',
          name: 'user-repos',
          provider: 'github',
          version: '1.0.0',
        })
      ).resolves.toEqual(mockMapSource);
    });
    test('get map AST', async () => {
      await expect(
        serviceClient.getMapAST({
          scope: 'vcs',
          name: 'user-repos',
          provider: 'github',
          version: '1.0.0',
        })
      ).resolves.toEqual(JSON.stringify(mockMapAST));
    });

    test('get maps list', async () => {
      await expect(serviceClient.getMapsList()).resolves.toEqual({
        url: '/maps',
        data: [
          {
            ...mockMap,
            published_at: mockMap.published_at.toJSON(),
          },
        ],
      });
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
      projects.post(
        '/projects',
        (_req: express.Request, res: express.Response) => {
          res.json(mockExistingProject);
        }
      );
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

    test('create a project', async () => {
      await expect(serviceClient.createProject(name)).resolves.toEqual(
        mockExistingProject
      );
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

  describe('insights', () => {
    const accountHandle = 'username';
    const projectName = 'project-name';
    const profile = 'communication/send-email';
    const providers = ['sendgrid', 'mailchimp'];
    const from = new Date('2021-05-23T00:00:00Z');
    const to = new Date('2021-05-25T00:00:00Z');
    const intervalMinutes = 1440;

    const mockPerformStatistics: SDKPerformStatisticsResponse = {
      from: from.toISOString(),
      to: to.toISOString(),
      interval_minutes: intervalMinutes,
      account_handle: accountHandle,
      project_name: projectName,
      profile,
      statistics: providers.map(provider => ({
        provider,
        series: [
          {
            successful_performs: 0,
            failed_performs: 0,
            from: '2021-05-23T00:00:00.000Z',
            to: '2021-05-24T00:00:00.000Z',
          },
          {
            successful_performs: 0,
            failed_performs: 0,
            from: '2021-05-24T00:00:00.000Z',
            to: '2021-05-25T00:00:00.000Z',
          },
        ],
      })),
    };

    const mockSDKConfiguration: SDKConfigResponse = {
      updated_at: new Date().toISOString(),
      configuration_hash: 'h45h',
      configuration: {
        profiles: {
          [profile]: {
            version: '0.0.0',
            providers: providers.map((provider, i) => ({
              provider,
              version: '0.0.0',
              priority: i,
            })),
          },
        },
      },
    };

    const mockProviderChangesList: SDKProviderChangesListResponse = {
      data: [
        {
          changed_at: new Date().toISOString(),
          change_type: SDKProviderChangeType.Failover,
          profile,
          from_provider: providers[0],
          to_provider: providers[1],
          failover_reasons: [
            {
              reason: 'HTTP_ERROR_500',
              occurred_at: new Date().toISOString(),
            },
          ],
        },
      ],
    };

    beforeAll(() => {
      const insights = createExpressMock();
      insights.use(json());
      insights.get(
        '/insights/perform_statistics',
        (_req: express.Request, res: express.Response) => {
          res.json(mockPerformStatistics);
        }
      );
      insights.get(
        `/insights/sdk_config`,
        (_req: express.Request, res: express.Response) => {
          res.json(mockSDKConfiguration);
        }
      );
      insights.get(
        `/insights/provider_changes`,
        (_req: express.Request, res: express.Response) => {
          res.json(mockProviderChangesList);
        }
      );
      identityServer = insights.listen(IDENTITY_PROVIDER_PORT);
      serviceClient = new ServiceClient();
      serviceClient.setOptions({
        baseUrl: IDENTITY_PROVIDER_BASE_URL,
        refreshToken: 'RT',
      });
    });

    afterAll(() => {
      identityServer.close();
    });

    test('get SDK perform statistics', async () => {
      await expect(
        serviceClient.getSDKPerformStatistics(
          accountHandle,
          projectName,
          profile,
          providers,
          from,
          to,
          intervalMinutes
        )
      ).resolves.toStrictEqual(mockPerformStatistics);
    });

    test('get SDK configuration', async () => {
      await expect(
        serviceClient.getSDKConfiguration(accountHandle, projectName)
      ).resolves.toStrictEqual(mockSDKConfiguration);
    });

    test('get SDK provider changes list', async () => {
      await expect(
        serviceClient.getSDKProviderChangesList(
          accountHandle,
          projectName,
          profile,
          providers.slice(0, 1)
        )
      ).resolves.toStrictEqual(mockProviderChangesList);
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
            email as unknown as string
          )}&token=${TOKEN_VALUE}`,
          expires_at:
            identityServerState.verificationTokenExpiresAt.toISOString(),
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
