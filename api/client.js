import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

class ApiClient {
  constructor() {
    const useLocal = process.env.COMMITQUEST_DEV === '1' || process.env.NODE_ENV === 'development';
    this.baseURL = process.env.COMMITQUEST_API_URL ||
      (useLocal ? 'http://localhost:3001/api' : 'https://commit-quest-app-3914e1ae3b5a.herokuapp.com/api');
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
    try {
      const configPath = this.getConfigPath();
      let config = {};
      if (fs.existsSync(configPath)) {
        try {
          config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (_) { /* use empty config */ }
      }
      config.apiToken = token;
      config.apiBaseUrl = this.baseURL.replace(/\/+$/, '');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Error storing token:', error.message);
    }
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
      const response = await this.client.post('/auth/device/poll', { 
        device_code: deviceCode,
        interval: interval
      });
      
      return response.data;
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || error.message || 'Token polling failed',
        details: error.response?.data?.details
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
    return response.data.classes;
  }

  async getSpecies() {
    const response = await this.client.get('/character/species');
    return response.data.species;
  }

  async getCharacter() {
    const response = await this.client.get('/character');
    return response.data.character;
  }

  async createCharacter(name, classId, speciesId) {
    const response = await this.client.post('/character', { name, class_id: classId, species_id: speciesId });
    return response.data.character;
  }

  async updateCharacter(name, classId = null, speciesId = null) {
    const payload = { name };
    if (classId) payload.class_id = classId;
    if (speciesId) payload.species_id = speciesId;
    
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
    try {
      const baseUrl = this.baseURL.replace('/api', '');
      const response = await axios.get(`${baseUrl}/health`, { timeout });
      return response.data.status === 'ok';
    } catch (error) {
      try {
        const baseUrl = this.baseURL.replace('/api', '');
        const response = await axios.get(baseUrl, { timeout });
        return response.status === 200;
      } catch (secondError) {
        return false;
      }
    }
  }
}

export default ApiClient; 