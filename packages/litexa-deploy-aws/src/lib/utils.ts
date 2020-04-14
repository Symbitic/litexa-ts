import minimatch from 'minimatch';

export function hasKeys(obj: object, keys: string[]): boolean {
  if (!obj || !keys) {
    return false;
  }

  for (let key of Object.keys(obj)) {
    if (keys.includes(key)) {
      return true;
    }
  }
  return false;
};

export function matchesGlobPatterns(fileName: string, globPatterns: string[]): boolean {
  if (!fileName || !globPatterns) {
    return false;
  }

  for (let pattern of globPatterns) {
    // matchBase includes files at the end of paths
    // e.g. so html/bundle.js matches *.js
    if (minimatch(fileName, pattern, { matchBase: true })) {
      return true;
    }
  }
  return false;
};

export default {
  hasKeys,
  matchesGlobPatterns
};
