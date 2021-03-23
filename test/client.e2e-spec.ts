import express from 'express';
import * as http from 'http';

import { BrainClient } from '../src';

describe('client', () => {
  let identityServer: http.Server;
  describe('fetch', () => {
    const IDENTITY_PROVIDER_PORT = 3031;
    const IDENTITY_PROVIDER_BASE_URL = `http://localhost:${IDENTITY_PROVIDER_PORT}`;
    let brainClient: BrainClient;
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
});
