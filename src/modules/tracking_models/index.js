/**
 * OpenHands Resolver MCP - Tracking Models Module
 * 
 * This module serves as the entry point for all tracking models supported by
 * the OpenHands Resolver, including the SignedPnp model.
 */

import * as signedPnp from './signed_pnp.js';
import { getContextLogger } from '../../utils/logger.js';

const logger = getContextLogger('TrackingModels');

/**
 * Available tracking model types
 */
export const MODEL_TYPES = {
  SIGNED_PNP: 'signed-pnp',
  // Add other model types here as they are implemented
  DEFAULT: 'signed-pnp' // Set SignedPnp as the default
};

/**
 * Factory function to create a tracker based on the specified type
 * @param {string} type - Type of tracker to create
 * @param {Object} config - Configuration for the tracker
 * @returns {Object} - Tracker instance
 */
export function createTracker(type = MODEL_TYPES.DEFAULT, config = {}) {
  logger.debug(`Creating tracker of type: ${type}`);
  
  switch (type.toLowerCase()) {
    case MODEL_TYPES.SIGNED_PNP:
      return signedPnp.createSignedPnpTracker(config);
      
    default:
      logger.warn(`Unknown tracker type: ${type}, using default (${MODEL_TYPES.DEFAULT})`);
      return signedPnp.createSignedPnpTracker(config);
  }
}

/**
 * Get default configuration for a specific tracker type
 * @param {string} type - Type of tracker
 * @returns {Object} - Default configuration
 */
export function getDefaultConfig(type = MODEL_TYPES.DEFAULT) {
  switch (type.toLowerCase()) {
    case MODEL_TYPES.SIGNED_PNP:
      return { ...signedPnp.DEFAULT_CONFIG };
      
    default:
      return { ...signedPnp.DEFAULT_CONFIG };
  }
}

/**
 * Get information about available tracking models
 * @returns {Array} - Information about available models
 */
export function getAvailableModels() {
  return [
    {
      id: MODEL_TYPES.SIGNED_PNP,
      name: 'SignedPnp Tracker',
      description: 'Hand tracking model using signed point-to-plane measurements for improved accuracy'
    }
    // Add other models here as they are implemented
  ];
}

export default {
  createTracker,
  getDefaultConfig,
  getAvailableModels,
  MODEL_TYPES
};