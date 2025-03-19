/**
 * Unit tests for SignedPnp Tracking Model
 */

import { jest } from '@jest/globals';
import * as signedPnp from '../../src/modules/tracking_models/signed_pnp.js';

// Mock the logger to avoid console output during tests
jest.mock('../../src/utils/logger.js', () => ({
  getContextLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })
}));

describe('SignedPnp Tracking Model', () => {
  describe('createSignedPnpTracker', () => {
    test('should create a tracker with default config', () => {
      const tracker = signedPnp.createSignedPnpTracker();
      
      expect(tracker).toBeDefined();
      expect(tracker.getConfig()).toEqual(expect.objectContaining({
        useRobustInitialization: true,
        maxIterations: 100,
        convergenceThreshold: 1e-5,
        useAdaptiveWeights: true
      }));
    });
    
    test('should create a tracker with custom config', () => {
      const customConfig = {
        useRobustInitialization: false,
        maxIterations: 200,
        convergenceThreshold: 1e-6
      };
      
      const tracker = signedPnp.createSignedPnpTracker(customConfig);
      
      expect(tracker.getConfig()).toEqual(expect.objectContaining({
        useRobustInitialization: false,
        maxIterations: 200,
        convergenceThreshold: 1e-6,
        useAdaptiveWeights: true
      }));
    });
  });
  
  describe('SignedPnpTracker', () => {
    let tracker;
    
    beforeEach(() => {
      tracker = signedPnp.createSignedPnpTracker();
    });
    
    test('should track points and return success result', () => {
      // Create mock points data
      const pointsData = Array(100).fill().map(() => ({ x: Math.random(), y: Math.random(), z: Math.random() }));
      
      const result = tracker.track(pointsData);
      
      expect(result).toEqual(expect.objectContaining({
        success: true,
        method: 'signed-pnp',
        confidence: expect.any(Number),
        pose: expect.objectContaining({
          position: expect.any(Object),
          rotation: expect.any(Object),
          joints: expect.any(Array),
          timestamp: expect.any(Number)
        })
      }));
    });
    
    test('should return 21 joints for a full hand model', () => {
      // Create mock points data
      const pointsData = Array(100).fill().map(() => ({ x: Math.random(), y: Math.random(), z: Math.random() }));
      
      const result = tracker.track(pointsData);
      
      expect(result.pose.joints.length).toBe(21);
    });
    
    test('should update configuration', () => {
      const newConfig = {
        useRobustInitialization: false,
        maxIterations: 150
      };
      
      tracker.updateConfig(newConfig);
      
      expect(tracker.getConfig()).toEqual(expect.objectContaining({
        useRobustInitialization: false,
        maxIterations: 150,
        convergenceThreshold: 1e-5,
        useAdaptiveWeights: true
      }));
    });
  });
  
  describe('DEFAULT_CONFIG', () => {
    test('should provide default configuration values', () => {
      expect(signedPnp.DEFAULT_CONFIG).toEqual(expect.objectContaining({
        useRobustInitialization: true,
        maxIterations: 100,
        convergenceThreshold: 1e-5,
        useAdaptiveWeights: true
      }));
    });
  });
});