/**
 * GitHub OAuth Device Flow Authentication Service
 * Implements GitHub's device flow for web applications without server-side components
 */

import { CONFIG } from '../config/github.js';

class GitHubAuthService {
  constructor() {
    this.accessToken = localStorage.getItem('github_access_token');
    this.userInfo = JSON.parse(localStorage.getItem('github_user_info') || 'null');
  }

  /**
   * Check if user is currently authenticated
   * @returns {boolean} Authentication status
   */
  isAuthenticated() {
    return !!this.accessToken;
  }

  /**
   * Get current user information
   * @returns {Object|null} User info object or null
   */
  getUserInfo() {
    return this.userInfo;
  }

  /**
   * Initiate GitHub device flow authentication
   * @returns {Promise<Object>} Device code response with user_code and verification_uri
   */
  async initiateDeviceFlow() {
    try {
      const response = await fetch(CONFIG.DEVICE_CODE_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: CONFIG.GITHUB_CLIENT_ID,
          scope: CONFIG.OAUTH_SCOPES,
        }),
      });

      if (!response.ok) {
        throw new Error(`Device flow initiation failed: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to initiate device flow:', error);
      throw new Error('Failed to start authentication process');
    }
  }

  /**
   * Poll for access token using device code
   * @param {string} deviceCode - Device code from initiation
   * @param {number} interval - Polling interval in seconds
   * @returns {Promise<string>} Access token
   */
  async pollForAccessToken(deviceCode, interval = 5) {
    const pollInterval = interval * 1000;
    const maxAttempts = CONFIG.POLL_TIMEOUT / pollInterval;
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        if (attempts >= maxAttempts) {
          reject(new Error('Authentication timeout - please try again'));
          return;
        }

        try {
          const response = await fetch(CONFIG.ACCESS_TOKEN_URL, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: CONFIG.GITHUB_CLIENT_ID,
              device_code: deviceCode,
              grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            }),
          });

          const data = await response.json();

          if (data.access_token) {
            // Success - store token and get user info
            this.accessToken = data.access_token;
            localStorage.setItem('github_access_token', this.accessToken);
            
            await this.fetchUserInfo();
            resolve(this.accessToken);
          } else if (data.error === 'authorization_pending') {
            // User hasn't completed authorization yet - continue polling
            attempts++;
            setTimeout(poll, pollInterval);
          } else if (data.error === 'slow_down') {
            // Increase polling interval
            attempts++;
            setTimeout(poll, pollInterval + 5000);
          } else if (data.error === 'expired_token') {
            reject(new Error('Authorization code expired - please try again'));
          } else if (data.error === 'access_denied') {
            reject(new Error('Authorization was denied'));
          } else {
            reject(new Error(`Authentication failed: ${data.error_description || data.error}`));
          }
        } catch (error) {
          console.error('Polling error:', error);
          attempts++;
          if (attempts >= maxAttempts) {
            reject(new Error('Authentication failed due to network error'));
          } else {
            setTimeout(poll, pollInterval);
          }
        }
      };

      // Start polling
      poll();
    });
  }

  /**
   * Fetch and store user information
   * @private
   */
  async fetchUserInfo() {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    try {
      const response = await fetch(`${CONFIG.GITHUB_API_BASE}/user`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.status}`);
      }

      this.userInfo = await response.json();
      localStorage.setItem('github_user_info', JSON.stringify(this.userInfo));
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      // Don't throw - user info is not critical for authentication
    }
  }

  /**
   * Complete authentication flow with user interaction
   * @returns {Promise<Object>} Authentication result with user info
   */
  async authenticate() {
    try {
      // Step 1: Initiate device flow
      const deviceFlow = await this.initiateDeviceFlow();
      
      // Step 2: Show user the verification URL and code
      const authModal = this.createAuthModal(deviceFlow);
      document.body.appendChild(authModal);

      // Step 3: Open verification URL in new tab
      window.open(deviceFlow.verification_uri, '_blank');

      // Step 4: Poll for access token
      const accessToken = await this.pollForAccessToken(
        deviceFlow.device_code,
        deviceFlow.interval
      );

      // Step 5: Clean up modal
      document.body.removeChild(authModal);

      return {
        success: true,
        user: this.userInfo,
        token: accessToken,
      };
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Create authentication modal UI
   * @private
   * @param {Object} deviceFlow - Device flow response
   * @returns {HTMLElement} Modal element
   */
  createAuthModal(deviceFlow) {
    const modal = document.createElement('div');
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">GitHub Authentication</h5>
          </div>
          <div class="modal-body text-center">
            <p>To create recipes, please authenticate with GitHub:</p>
            <h3 class="text-primary mb-3">${deviceFlow.user_code}</h3>
            <p>
              1. A new tab will open to GitHub<br>
              2. Enter the code above<br>
              3. Authorize the application<br>
              4. Return to this page
            </p>
            <div class="spinner-border text-primary mt-3" role="status">
              <span class="visually-hidden">Waiting for authorization...</span>
            </div>
            <p class="text-muted mt-2">Waiting for authorization...</p>
          </div>
        </div>
      </div>
    `;

    return modal;
  }

  /**
   * Sign out user
   */
  signOut() {
    this.accessToken = null;
    this.userInfo = null;
    localStorage.removeItem('github_access_token');
    localStorage.removeItem('github_user_info');
  }

  /**
   * Make authenticated GitHub API request
   * @param {string} endpoint - API endpoint (relative to base URL)
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} Fetch response
   */
  async makeAuthenticatedRequest(endpoint, options = {}) {
    if (!this.accessToken) {
      throw new Error('User not authenticated');
    }

    const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.GITHUB_API_BASE}/${endpoint}`;
    
    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }
}

// Export singleton instance
export const githubAuth = new GitHubAuthService();
export default githubAuth;
