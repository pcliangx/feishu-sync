/**
 * Feishu SDK Client initialization
 */

import * as lark from '@larksuiteoapi/node-sdk';
import { loadConfig } from '../config/index.js';

let clientInstance: lark.Client | null = null;

export function getClient(): lark.Client {
  if (clientInstance) {
    return clientInstance;
  }

  const config = loadConfig();

  clientInstance = new lark.Client({
    appId: config.appId,
    appSecret: config.appSecret,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  return clientInstance;
}
