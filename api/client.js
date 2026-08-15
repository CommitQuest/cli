import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

const PRODUCTION_API_URL = 'https://commit-quest-app-3914e1ae3b5a.herokuapp.com/api';
const LOCAL_API_URL = 'http://localhost:3001/api';

export function parsePositiveId(value, label) {
  if (value == null || value === '') {
    throw new Error(`${label} is required`);
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsed;
}

/** Parse Retry-After / RateLimit-Reset response headers into a millisecond wait. */
export function parseRetryAfterMs(headers = {}) {
  const retryAfter = headers['retry-after'] ?? headers['Retry-After'];
  if (retryAfter != null && retryAfter !== '') {
    const asSeconds = Number(retryAfter);
    if (Number.isFinite(asSeconds) && asSeconds >= 0) {
      return asSeconds * 1000;
    }
    const asDate = Date.parse(String(retryAfter));
    if (!Number.isNaN(asDate)) {
      return Math.max(0, asDate - Date.now());
    }
  }

  const reset = headers['ratelimit-reset'] ?? headers['RateLimit-Reset'];
  if (reset != null && reset !== '') {
    const value = Number(reset);
    if (!Number.isFinite(value) || value < 0) return null;
    // draft-7 / unix timestamp vs draft-6 delta seconds
    if (value > 1e9) return Math.max(0, value * 1000 - Date.now());
    return value * 1000;
  }

  return null;
}

function normalizeEntity(entity) {
  const rawId = entity.id ?? entity.class_id ?? entity.species_id;
  return {
    ...entity,
    id: parsePositiveId(rawId, `id for "${entity.name}"`),
  };
}

class ApiClient {
  constructor() {
    // Only COMMITQUEST_DEV (not generic NODE_ENV) opts into the local API.
    const useLocal = process.env.COMMITQUEST_DEV === '1';
    this.baseURL = process.env.COMMITQUEST_API_URL ||
      (useLocal ? LOCAL_API_URL : PRODUCTION_API_URL);
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Add request interceptor to include auth token
    this.client.interceptors.request.use((config) => {
      const token = this.getStoredToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  getConfigPath() {
    const configDir = path.join(os.homedir(), '.commitquest');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    return path.join(configDir, 'config.json');
  }

  getStoredToken() {
    try {
      const configPath = this.getConfigPath();
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return config.apiToken;
      }
    } catch (error) {
      console.error('Error reading stored token:', error.message);
    }
    return null;
  }

  storeToken(token) {
    const configPath = this.getConfigPath();
    let config = {};
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (_) { /* use empty config */ }
    }
    config.apiToken = token;
    config.apiBaseUrl = this.baseURL.replace(/\/+$/, '');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
    fs.chmodSync(configPath, 0o600);
  }

  clearStoredToken() {
    try {
      const configPath = this.getConfigPath();
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
    } catch (error) {
      console.error('Error clearing stored token:', error.message);
    }
  }

  // Device flow methods
  async startDeviceFlow() {
    try {
      const response = await this.client.post('/auth/device/start');
      return response.data;
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || error.message || 'Failed to start device flow' 
      };
    }
  }

  async pollForToken(deviceCode, interval) {
    try {
      // Auth completion does GitHub + DB work; allow longer than the default 10s.
      const response = await this.client.post(
        '/auth/device/poll',
        {
          device_code: deviceCode,
          interval: interval,
        },
        { timeout: 30000 }
      );

      return response.data;
    } catch (error) {
      // Backend authPollRateLimiter returns 429 once the window is exhausted.
      if (error.response?.status === 429) {
        return {
          success: false,
          error: 'server_poll_rate_limit',
          details: error.response?.data?.error,
          retryAfterMs: parseRetryAfterMs(error.response?.headers || {}),
        };
      }

      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Token polling failed',
        details: error.response?.data?.details,
      };
    }
  }

  async verifyToken() {
    try {
      const response = await this.client.get('/auth/verify');
      return response.data.user;
    } catch (error) {
      if (error.response?.status === 401) {
        this.clearStoredToken();
      }
      throw error;
    }
  }

  async logout() {
    try {
      await this.client.post('/auth/logout');
    } finally {
      this.clearStoredToken();
    }
  }

  // Installation status (for backward compatibility)
  async getInstallationStatus() {
    try {
      const response = await this.client.get('/auth/installation/status');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // User methods
  async getUserProfile() {
    const response = await this.client.get('/user/profile');
    return response.data.user;
  }

  async getUserStats() {
    const response = await this.client.get('/user/stats');
    return response.data.stats;
  }

  async updateUserProfile(email) {
    const response = await this.client.put('/user/profile', { email });
    return response.data.user;
  }

  // Character methods
  async getCharacterClasses() {
    const response = await this.client.get('/character/classes');
    return (response.data.classes || []).map(normalizeEntity);
  }

  async getSpecies() {
    const response = await this.client.get('/character/species');
    return (response.data.species || []).map(normalizeEntity);
  }

  async getCharacter() {
    const response = await this.client.get('/character');
    return response.data.character;
  }

  /** Returns null when the user has no character (null body or 404). Re-throws other errors. */
  async getCharacterOrNull() {
    try {
      return await this.getCharacter();
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async createCharacter(name, classId, speciesId) {
    const response = await this.client.post('/character', {
      name: String(name).trim(),
      class_id: parsePositiveId(classId, 'class_id'),
      species_id: parsePositiveId(speciesId, 'species_id'),
    });
    return response.data.character;
  }

  async updateCharacter(name, classId = null, speciesId = null) {
    const payload = { name: String(name).trim() };
    if (classId != null) payload.class_id = parsePositiveId(classId, 'class_id');
    if (speciesId != null) payload.species_id = parsePositiveId(speciesId, 'species_id');

    const response = await this.client.put('/character', payload);
    return response.data.character;
  }

  // Achievement methods
  async getAchievements() {
    const response = await this.client.get('/achievement');
    return response.data.achievements;
  }

  async getUserAchievements() {
    const response = await this.client.get('/achievement/user');
    return response.data.achievements;
  }

  async getAchievementProgress() {
    const response = await this.client.get('/achievement/progress');
    return response.data;
  }

  async unlockAchievement(achievementId) {
    const response = await this.client.post('/achievement/unlock', { achievement_id: achievementId });
    return response.data.achievement;
  }

  // async checkAndUnlockAchievements(stats) {
  //   const response = await this.client.post('/achievement/check', { stats });
  //   return response.data;
  // }

  // Health check
  async healthCheck() {
    const timeout = 5000;
    const baseUrl = this.baseURL.replace(/\/api\/?$/, '');
    try {
      const response = await axios.get(`${baseUrl}/health`, { timeout });
      return response.data.status === 'ok';
    } catch (error) {
      try {
        const response = await axios.get(baseUrl, { timeout });
        return response.status === 200;
      } catch (secondError) {
        return false;
      }
    }
  }
}

export default ApiClient; 