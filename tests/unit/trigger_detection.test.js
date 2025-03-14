/**
 * Unit tests for Trigger Detection Module
 */

const { detectTrigger, validateTrigger } = require('../../src/modules/trigger_detection');

describe('Trigger Detection Module', () => {
  describe('detectTrigger', () => {
    test('should detect a single GitHub issue URL', () => {
      const input = 'Can you resolve this issue: https://github.com/openhandsteam/repo/issues/123';
      const result = detectTrigger(input);
      
      expect(result).toEqual({
        issueUrl: 'https://github.com/openhandsteam/repo/issues/123',
        owner: 'openhandsteam',
        repo: 'repo',
        issueNumber: 123,
        isBatch: false
      });
    });
    
    test('should detect a batch resolution request', () => {
      const input = 'Resolve issues from https://github.com/openhandsteam/repo/issues/123 and https://github.com/openhandsteam/repo/issues/456';
      const result = detectTrigger(input);
      
      expect(result).toEqual({
        isBatch: true,
        issueList: [
          {
            issueUrl: 'https://github.com/openhandsteam/repo/issues/123',
            owner: 'openhandsteam',
            repo: 'repo',
            issueNumber: 123
          },
          {
            issueUrl: 'https://github.com/openhandsteam/repo/issues/456',
            owner: 'openhandsteam',
            repo: 'repo',
            issueNumber: 456
          }
        ]
      });
    });
    
    test('should detect a repository-wide request', () => {
      const input = 'Resolve issues in openhandsteam/repo';
      const result = detectTrigger(input);
      
      expect(result).toEqual({
        isRepoWide: true,
        owner: 'openhandsteam',
        repo: 'repo',
        isBatch: false
      });
    });
    
    test('should return null for input with no GitHub issue URL', () => {
      const input = 'How does the OpenHands Resolver work?';
      const result = detectTrigger(input);
      
      expect(result).toBeNull();
    });
    
    test('should handle object input with text property', () => {
      const input = { text: 'Fix this issue: https://github.com/openhandsteam/repo/issues/789' };
      const result = detectTrigger(input);
      
      expect(result).toEqual({
        issueUrl: 'https://github.com/openhandsteam/repo/issues/789',
        owner: 'openhandsteam',
        repo: 'repo',
        issueNumber: 789,
        isBatch: false
      });
    });
    
    test('should handle empty input', () => {
      expect(detectTrigger('')).toBeNull();
      expect(detectTrigger(null)).toBeNull();
      expect(detectTrigger(undefined)).toBeNull();
      expect(detectTrigger({})).toBeNull();
    });
  });
  
  describe('validateTrigger', () => {
    test('should validate a single issue trigger', () => {
      const trigger = {
        issueUrl: 'https://github.com/openhandsteam/repo/issues/123',
        owner: 'openhandsteam',
        repo: 'repo',
        issueNumber: 123,
        isBatch: false
      };
      
      expect(validateTrigger(trigger)).toBe(true);
    });
    
    test('should validate a batch trigger', () => {
      const trigger = {
        isBatch: true,
        issueList: [
          {
            issueUrl: 'https://github.com/openhandsteam/repo/issues/123',
            owner: 'openhandsteam',
            repo: 'repo',
            issueNumber: 123
          }
        ]
      };
      
      expect(validateTrigger(trigger)).toBe(true);
    });
    
    test('should validate a repository-wide trigger', () => {
      const trigger = {
        isRepoWide: true,
        owner: 'openhandsteam',
        repo: 'repo',
        isBatch: false
      };
      
      expect(validateTrigger(trigger)).toBe(true);
    });
    
    test('should reject invalid single issue trigger', () => {
      // Missing owner
      expect(validateTrigger({
        issueUrl: 'https://github.com/openhandsteam/repo/issues/123',
        repo: 'repo',
        issueNumber: 123,
        isBatch: false
      })).toBe(false);
      
      // Missing repo
      expect(validateTrigger({
        issueUrl: 'https://github.com/openhandsteam/repo/issues/123',
        owner: 'openhandsteam',
        issueNumber: 123,
        isBatch: false
      })).toBe(false);
      
      // Missing issueNumber
      expect(validateTrigger({
        issueUrl: 'https://github.com/openhandsteam/repo/issues/123',
        owner: 'openhandsteam',
        repo: 'repo',
        isBatch: false
      })).toBe(false);
    });
    
    test('should reject invalid batch trigger', () => {
      // Empty issue list
      expect(validateTrigger({
        isBatch: true,
        issueList: []
      })).toBe(false);
      
      // Invalid issue in list
      expect(validateTrigger({
        isBatch: true,
        issueList: [
          {
            issueUrl: 'https://github.com/openhandsteam/repo/issues/123',
            owner: 'openhandsteam',
            // Missing repo
            issueNumber: 123
          }
        ]
      })).toBe(false);
    });
    
    test('should reject null or undefined trigger', () => {
      expect(validateTrigger(null)).toBe(false);
      expect(validateTrigger(undefined)).toBe(false);
    });
  });
});