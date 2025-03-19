/**
 * OpenHands Resolver MCP - Tracking Model Visualizer
 * 
 * This module provides visualization utilities for tracking models.
 */

import { getContextLogger } from '../../utils/logger.js';

const logger = getContextLogger('TrackingVisualizer');

/**
 * Generate an SVG visualization of hand tracking results
 * @param {Object} trackingResult - Result from a tracking model
 * @param {Object} options - Visualization options
 * @returns {string} - SVG markup as a string
 */
export function generateHandVisualization(trackingResult, options = {}) {
  try {
    const { 
      width = 400, 
      height = 400, 
      showConfidence = true,
      showJointNames = false,
      backgroundColor = '#f8f8f8',
      jointColor = '#2a6cbb',
      boneColor = '#4a8fe2',
      confidenceIndicatorColor = '#44cc44'
    } = options;
    
    logger.debug('Generating hand visualization');
    
    if (!trackingResult || !trackingResult.success || !trackingResult.pose) {
      logger.warn('Cannot generate visualization: invalid tracking result');
      return generateErrorSvg(width, height, 'Invalid tracking data');
    }
    
    const { pose, confidence, method } = trackingResult;
    const { joints } = pose;
    
    if (!joints || !Array.isArray(joints) || joints.length < 21) {
      logger.warn('Cannot generate visualization: invalid joint data');
      return generateErrorSvg(width, height, 'Invalid joint data');
    }
    
    // Start SVG
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="${backgroundColor}" />
  <text x="10" y="20" font-family="Arial" font-size="14" fill="#333333">Hand Tracking (${method})</text>`;
    
    // Add confidence indicator if requested
    if (showConfidence && typeof confidence === 'number') {
      const indicatorWidth = width * 0.3;
      const confidenceWidth = indicatorWidth * confidence;
      
      svg += `
  <rect x="10" y="${height - 30}" width="${indicatorWidth}" height="10" fill="#dddddd" rx="2" ry="2" />
  <rect x="10" y="${height - 30}" width="${confidenceWidth}" height="10" fill="${confidenceIndicatorColor}" rx="2" ry="2" />
  <text x="${indicatorWidth + 20}" y="${height - 22}" font-family="Arial" font-size="12" fill="#333333">Confidence: ${(confidence * 100).toFixed(1)}%</text>`;
    }
    
    // Map the joints to screen coordinates (simplified)
    const mappedJoints = mapJointsToScreen(joints, width, height);
    
    // Draw the bones (connections between joints)
    svg += drawHandBones(mappedJoints, boneColor);
    
    // Draw the joints
    svg += drawHandJoints(mappedJoints, jointColor, showJointNames);
    
    // Close SVG
    svg += `
</svg>`;
    
    logger.debug('Hand visualization generated successfully');
    return svg;
  } catch (error) {
    logger.error(`Error generating hand visualization: ${error.message}`);
    return generateErrorSvg(options.width || 400, options.height || 400, 'Error generating visualization');
  }
}

/**
 * Generate an error SVG
 * @private
 * @param {number} width - SVG width
 * @param {number} height - SVG height
 * @param {string} message - Error message to display
 * @returns {string} - SVG markup
 */
function generateErrorSvg(width, height, message) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#f8f8f8" />
  <text x="50%" y="50%" font-family="Arial" font-size="14" fill="#cc0000" text-anchor="middle">${message}</text>
</svg>`;
}

/**
 * Map 3D joint coordinates to 2D screen coordinates
 * @private
 * @param {Array} joints - Joint positions in 3D
 * @param {number} width - SVG width
 * @param {number} height - SVG height
 * @returns {Array} - Mapped joint positions
 */
function mapJointsToScreen(joints, width, height) {
  // Find min/max for normalization
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const joint of joints) {
    minX = Math.min(minX, joint.x);
    minY = Math.min(minY, joint.y);
    maxX = Math.max(maxX, joint.x);
    maxY = Math.max(maxY, joint.y);
  }
  
  // Padding
  const padding = 0.15;
  const rangeX = (maxX - minX) || 1;
  const rangeY = (maxY - minY) || 1;
  
  // Map joints to screen coordinates with padding
  return joints.map(joint => {
    const x = padding * width + ((joint.x - minX) / rangeX) * (width - 2 * padding * width);
    const y = padding * height + ((joint.y - minY) / rangeY) * (height - 2 * padding * height);
    return { ...joint, screenX: x, screenY: y };
  });
}

/**
 * Draw hand bones (connections between joints)
 * @private
 * @param {Array} joints - Mapped joint positions
 * @param {string} color - Bone color
 * @returns {string} - SVG markup for bones
 */
function drawHandBones(joints, color) {
  // Hand bone connections (simplified hand model)
  const boneConnections = [
    // Thumb
    [0, 1], [1, 2], [2, 3], [3, 4],
    // Index finger
    [0, 5], [5, 6], [6, 7], [7, 8],
    // Middle finger
    [0, 9], [9, 10], [10, 11], [11, 12],
    // Ring finger
    [0, 13], [13, 14], [14, 15], [15, 16],
    // Pinky
    [0, 17], [17, 18], [18, 19], [19, 20]
  ];
  
  let lines = '';
  for (const [start, end] of boneConnections) {
    if (joints[start] && joints[end]) {
      lines += `
  <line x1="${joints[start].screenX}" y1="${joints[start].screenY}" x2="${joints[end].screenX}" y2="${joints[end].screenY}" stroke="${color}" stroke-width="2" />`;
    }
  }
  
  return lines;
}

/**
 * Draw hand joints
 * @private
 * @param {Array} joints - Mapped joint positions
 * @param {string} color - Joint color
 * @param {boolean} showNames - Whether to show joint names
 * @returns {string} - SVG markup for joints
 */
function drawHandJoints(joints, color, showNames) {
  const jointNames = [
    'Wrist', 
    'Thumb1', 'Thumb2', 'Thumb3', 'ThumbTip',
    'Index1', 'Index2', 'Index3', 'IndexTip',
    'Middle1', 'Middle2', 'Middle3', 'MiddleTip',
    'Ring1', 'Ring2', 'Ring3', 'RingTip',
    'Pinky1', 'Pinky2', 'Pinky3', 'PinkyTip'
  ];
  
  let circles = '';
  for (let i = 0; i < joints.length; i++) {
    const joint = joints[i];
    const radius = i === 0 ? 4 : 3; // Wrist is larger
    
    circles += `
  <circle cx="${joint.screenX}" cy="${joint.screenY}" r="${radius}" fill="${color}" />`;
    
    if (showNames && jointNames[i]) {
      circles += `
  <text x="${joint.screenX + 5}" y="${joint.screenY - 5}" font-family="Arial" font-size="8" fill="#333333">${jointNames[i]}</text>`;
    }
  }
  
  return circles;
}

/**
 * Generate a 3D model visualization of hand tracking
 * This is a placeholder for a future 3D visualization implementation
 * @param {Object} trackingResult - Result from a tracking model
 * @param {Object} options - Visualization options
 * @returns {Object} - Information for 3D model generation
 */
export function generate3DHandModel(trackingResult, options = {}) {
  logger.debug('3D hand model visualization requested (not implemented)');
  
  return {
    implemented: false,
    message: '3D visualization not yet implemented',
    trackingMethod: trackingResult?.method || 'unknown'
  };
}

export default {
  generateHandVisualization,
  generate3DHandModel
};