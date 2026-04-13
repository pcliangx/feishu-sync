/**
 * Configuration loader for Feishu Sync
 */

export interface Config {
  appId: string;
  appSecret: string;
  folderToken?: string;
}

export function loadConfig(): Config {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error(
      'FEISHU_APP_ID and FEISHU_APP_SECRET environment variables are required'
    );
  }

  return {
    appId,
    appSecret,
    folderToken: process.env.FEISHU_FOLDER_TOKEN,
  };
}
