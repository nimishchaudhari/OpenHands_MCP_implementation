/**
 * Unit tests for Tracking Models Module
 */

import { jest } from '@jest/globals';
import * as trackingModels from '../../src/modules/tracking_models/index.js';
import * as signedPnp from '../../src/modules/tracking_models/signed_pnp.js';

// Mock the signed_pnp module
jest.mock('../../src/modules/tracking_models/signed_pnp.js', () => {
  const mockTracker = {
    track: jest.fn(),
    getConfig: jest.fn(),
    updateConfig: jest.fn()
  };
  
  return {
    createSignedPnpTracker: jest.fn(() => mockTracker),
    DEFAULT_CONFIG: {
      useRobustInitialization: true,
      maxIterations: 100,
      convergenceThreshold: 1e-5,
      useAdaptiveWeights: true,
      modelVariant: 'standard'
    }
  };
});

// Mock the logger
jest.mock('../../src/utils/logger.js', () => ({
  getContextLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })
}));

describe('Tracking Models Module', () => {
  describe('createTracker', () => {
    test('should create SignedPnp tracker when specified', () => {
      const config = { maxIterations: 200 };
      trackingModels.createTracker(trackingModels.MODEL_TYPES.SIGNED_PNP, config);
      
      expect(signedPnp.createSignedPnpTracker).toHaveBeenCalledWith(config);
    });
    
    test('should create default tracker when type is not specified', () => {
      trackingModels.createTracker();
      
      expect(signedPnp.createSignedPnpTracker).toHaveBeenCalled();
    });
    
    test('should create default tracker when unknown type is specified', () => {
      trackingModels.createTracker('unknown-type');
      
      expect(signedPnp.createSignedPnpTracker).toHaveBeenCalled();
    });
  });
  
  describe('getDefaultConfig', () => {
    test('should return SignedPnp default config when specified', () => {
      const config = trackingModels.getDefaultConfig(trackingModels.MODEL_TYPES.SIGNED_PNP);
      
      expect(config).toEqual(signedPnp.DEFAULT_CONFIG);
    });
    
    test('should return default config when type is not specified', () => {
      const config = trackingModels.getDefaultConfig();
      
      expect(config).toEqual(signedPnp.DEFAULT_CONFIG);
    });
  });
  
  describe('getAvailableModels', () => {
    test('should return information about available models', () => {
      const models = trackingModels.getAvailableModels();
      
      expect(models).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: trackingModels.MODEL_TYPES.SIGNED_PNP,
          name: expect.any(String),
          description: expect.any(String)
        })
      ]));
    });
  });
  
  describe('MODEL_TYPES', () => {
    test('should define SIGNED_PNP model type', () => {
      expect(trackingModels.MODEL_TYPES.SIGNED_PNP).toBe('signed-pnp');
    });
    
    test('should define DEFAULT model type', () => {
      expect(trackingModels.MODEL_TYPES.DEFAULT).toBe('signed-pnp');
    });
  });
});