/**
 * Configuration for GitHub OAuth and API integration
 * Update the values below with your actual GitHub OAuth App credentials
 */

export const CONFIG = {
  GITHUB_CLIENT_ID: 'Ov23li41CM0PJmVFVJBX', 
  
  // GitHub API settings
  GITHUB_API_BASE: 'https://api.github.com',
  GITHUB_OAUTH_BASE: 'https://github.com/login/oauth',
  
  // Repository settings - Update if your repo details are different
  REPO_OWNER: 'etancik',
  REPO_NAME: 'Kuchtik',
  
  // OAuth scopes needed for recipe creation
  OAUTH_SCOPES: 'repo user',
  
  // Device flow endpoints
  DEVICE_CODE_URL: 'https://github.com/login/device/code',
  ACCESS_TOKEN_URL: 'https://github.com/login/oauth/access_token',
  
  // Polling settings for device flow
  POLL_INTERVAL: 5000, // 5 seconds
  POLL_TIMEOUT: 300000, // 5 minutes
};
