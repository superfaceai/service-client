import express, { json } from 'express';
import * as http from 'http';

import { BrainClient, CancellationToken } from '../src';

describe('client', () => {
  const IDENTITY_PROVIDER_PORT = 3031;
  const IDENTITY_PROVIDER_BASE_URL = `http://localhost:${IDENTITY_PROVIDER_PORT}`;

  let identityServer: http.Server;
  let brainClient: BrainClient;

  describe('fetch', () => {
    beforeAll(() => {
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
      const verificationUrl = await brainClient.passwordlessLogin(
        'mail@johndoe.com'
      );
      const result = await brainClient.verifyPasswordlessLogin(verificationUrl);
      expect(result.verificationStatus).toBe('CONFIRMED');
      expect(result.authToken).toEqual({
        access_token: 'AT',
        token_type: 'Bearer',
        expires_in: 1,
      });
    });

    test('call verifyPasswordlessLogin with unconfirmed token', async () => {
      identityServerState.mockedTokenVerificationStatus = 'PENDING';
      const verificationUrl = await brainClient.passwordlessLogin(
        'mail@johndoe.com'
      );
      const result = await brainClient.verifyPasswordlessLogin(
        verificationUrl,
        {
          pollingTimeoutSeconds: 1,
        }
      );
      expect(result.verificationStatus).toBe('POLLING_TIMEOUT');
    });

    test('call verifyPasswordlessLogin with expired token', async () => {
      identityServerState.mockedTokenVerificationStatus = 'EXPIRED';
      const verificationUrl = await brainClient.passwordlessLogin(
        'mail@johndoe.com'
      );
      const result = await brainClient.verifyPasswordlessLogin(verificationUrl);
      expect(result.verificationStatus).toBe('EXPIRED');
    });

    test('call verifyPasswordlessLogin with used token', async () => {
      identityServerState.mockedTokenVerificationStatus = 'USED';
      const verificationUrl = await brainClient.passwordlessLogin(
        'mail@johndoe.com'
      );
      const result = await brainClient.verifyPasswordlessLogin(verificationUrl);
      expect(result.verificationStatus).toBe('USED');
    });

    test('cancel verifyPasswordlessLogin polling', async () => {
      identityServerState.mockedTokenVerificationStatus = 'PENDING';
      const verificationUrl = await brainClient.passwordlessLogin(
        'mail@johndoe.com'
      );
      const cancellationToken = new CancellationToken();
      const verifyPromise = brainClient.verifyPasswordlessLogin(
        verificationUrl,
        {
          pollingTimeoutSeconds: 10,
          cancellationToken,
        }
      );
      cancellationToken.isCancellationRequested = true;
      const verifyResult = await verifyPromise;
      expect(verifyResult.verificationStatus).toBe('POLLING_CANCELLED');
    });
  });
});

function runMockedPasswordlessIdentityServer(
  baseUrl: string,
  port: number,
  identityServerState: {
    mockedTokenVerificationStatus: string;
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
