/**
 * GitHub Personal Access Token Authentication Service
 * Handles authentication using GitHub Personal Access Tokens
 */

import { CONFIG } from '../config/github.js';
import { templateLoader } from '../utils/templateLoader.js';

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
   * Complete authentication using Personal Access Token
   * @returns {Promise<Object>} Authentication result with user info
   */
  async authenticate() {
    try {
      // For now, show instructions for manual token creation
      const token = await this.showManualTokenInstructions();
      
      if (token) {
        this.accessToken = token;
        localStorage.setItem('github_access_token', this.accessToken);
        await this.fetchUserInfo();
        
        return {
          success: true,
          user: this.userInfo,
          token: this.accessToken,
        };
      } else {
        throw new Error('Authentication was cancelled');
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Show instructions for creating a personal access token
   * @private
   * @returns {Promise<string|null>} Token or null if cancelled
   */
  async showManualTokenInstructions() {
    const modal = await this.createTokenInstructionsModal();
    document.body.appendChild(modal);
    
    return new Promise((resolve) => {
      const tokenInput = modal.querySelector('#github-token-input');
      const submitBtn = modal.querySelector('#submit-token-btn');
      const cancelBtn = modal.querySelector('#cancel-token-btn');
      
      submitBtn.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        if (token) {
          document.body.removeChild(modal);
          resolve(token);
        } else {
          alert('Please enter a valid token');
        }
      });
      
      cancelBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(null);
      });
      
      // Submit on Enter key
      tokenInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          submitBtn.click();
        }
      });
      
      // Focus the input
      setTimeout(() => tokenInput.focus(), 100);
    });
  }

  /**
   * Create token instructions modal UI
   * @private
   * @returns {Promise<HTMLElement>} Modal element
   */
  async createTokenInstructionsModal() {
    try {
      return await templateLoader.createElement('src/templates/auth-modal.html');
    } catch (error) {
      console.error('Failed to load auth modal template:', error);
      // Fallback to creating modal programmatically
      return this.createFallbackModal();
    }
  }

  /**
   * Create fallback modal if template loading fails
   * @private
   * @returns {HTMLElement} Modal element
   */
  createFallbackModal() {
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
          <div class="modal-body">
            <p>Please enter your GitHub Personal Access Token:</p>
            <input type="password" class="form-control" id="github-token-input" 
                   placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="cancel-token-btn">Cancel</button>
            <button type="button" class="btn btn-primary" id="submit-token-btn">Save Token</button>
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
