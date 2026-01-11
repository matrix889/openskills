import { describe, it, expect } from 'vitest';
import { resolve, join, relative, isAbsolute, sep } from 'path';
import { homedir } from 'os';

// We need to test the helper functions, but they're not exported
// So we'll test them indirectly or create a test module
// For now, let's test the logic patterns directly

describe('install.ts helper functions', () => {
  describe('isLocalPath detection', () => {
    // Replicate the logic from isLocalPath() - cross-platform version
    const isLocalPath = (source: string): boolean => {
      return (
        source.startsWith('/') ||
        source.startsWith('./') ||
        source.startsWith('../') ||
        source.startsWith('~/') ||
        source.startsWith('.\\') ||
        source.startsWith('..\\') ||
        isAbsolute(source) // Handles Windows absolute paths like C:\, D:\, etc.
      );
    };

    it('should detect absolute paths starting with /', () => {
      expect(isLocalPath('/absolute/path/to/skill')).toBe(true);
      expect(isLocalPath('/Users/test/skills')).toBe(true);
    });

    it('should detect relative paths starting with ./', () => {
      expect(isLocalPath('./relative/path')).toBe(true);
      expect(isLocalPath('./skill')).toBe(true);
    });

    it('should detect parent relative paths starting with ../', () => {
      expect(isLocalPath('../parent/path')).toBe(true);
      expect(isLocalPath('../../../deep/path')).toBe(true);
    });

    it('should detect home directory paths starting with ~/', () => {
      expect(isLocalPath('~/skills/my-skill')).toBe(true);
      expect(isLocalPath('~/.claude/skills')).toBe(true);
    });

    it('should NOT detect GitHub shorthand as local path', () => {
      expect(isLocalPath('owner/repo')).toBe(false);
      expect(isLocalPath('anthropics/skills')).toBe(false);
      expect(isLocalPath('owner/repo/skill-path')).toBe(false);
    });

    it('should NOT detect git URLs as local path', () => {
      expect(isLocalPath('git@github.com:owner/repo.git')).toBe(false);
      expect(isLocalPath('https://github.com/owner/repo')).toBe(false);
      expect(isLocalPath('http://github.com/owner/repo')).toBe(false);
    });

    it('should NOT detect plain names as local path', () => {
      expect(isLocalPath('skill-name')).toBe(false);
      expect(isLocalPath('my-skill')).toBe(false);
    });
  });

  describe('isGitUrl detection', () => {
    // Replicate the logic from isGitUrl()
    const isGitUrl = (source: string): boolean => {
      return (
        source.startsWith('git@') ||
        source.startsWith('git://') ||
        source.startsWith('http://') ||
        source.startsWith('https://') ||
        source.endsWith('.git')
      );
    };

    it('should detect SSH git URLs', () => {
      expect(isGitUrl('git@github.com:owner/repo.git')).toBe(true);
      expect(isGitUrl('git@gitlab.com:group/project.git')).toBe(true);
      expect(isGitUrl('git@bitbucket.org:team/repo.git')).toBe(true);
    });

    it('should detect git:// protocol URLs', () => {
      expect(isGitUrl('git://github.com/owner/repo.git')).toBe(true);
    });

    it('should detect HTTPS URLs', () => {
      expect(isGitUrl('https://github.com/owner/repo')).toBe(true);
      expect(isGitUrl('https://github.com/owner/repo.git')).toBe(true);
      expect(isGitUrl('https://gitlab.com/group/project')).toBe(true);
    });

    it('should detect HTTP URLs', () => {
      expect(isGitUrl('http://github.com/owner/repo')).toBe(true);
    });

    it('should detect URLs ending in .git', () => {
      expect(isGitUrl('custom-host.com/repo.git')).toBe(true);
      expect(isGitUrl('anything.git')).toBe(true);
    });

    it('should NOT detect GitHub shorthand as git URL', () => {
      expect(isGitUrl('owner/repo')).toBe(false);
      expect(isGitUrl('anthropics/skills')).toBe(false);
    });

    it('should NOT detect local paths as git URL', () => {
      expect(isGitUrl('/absolute/path')).toBe(false);
      expect(isGitUrl('./relative/path')).toBe(false);
      expect(isGitUrl('~/home/path')).toBe(false);
    });
  });

  describe('expandPath tilde expansion', () => {
    // Replicate the logic from expandPath()
    const expandPath = (source: string): string => {
      if (source.startsWith('~/')) {
        return join(homedir(), source.slice(2));
      }
      return resolve(source);
    };

    it('should expand ~ to home directory', () => {
      const expanded = expandPath('~/skills/test');
      expect(expanded).toBe(join(homedir(), 'skills/test'));
    });

    it('should expand ~/.claude/skills correctly', () => {
      const expanded = expandPath('~/.claude/skills');
      expect(expanded).toBe(join(homedir(), '.claude/skills'));
    });

    it('should resolve relative paths', () => {
      const expanded = expandPath('./relative');
      expect(expanded).toBe(resolve('./relative'));
    });

    it('should keep absolute paths as-is (resolved)', () => {
      const expanded = expandPath('/absolute/path');
      // On Windows, /absolute/path resolves to current drive (e.g., G:\absolute\path)
      // On Unix, it stays as /absolute/path
      expect(expanded).toBe(resolve('/absolute/path'));
    });
  });

  describe('path traversal security', () => {
    // Test the security check logic - cross-platform version using path.relative
    const isPathSafe = (targetPath: string, targetDir: string): boolean => {
      const resolvedTarget = resolve(targetPath);
      const resolvedParent = resolve(targetDir);
      // Use path.relative to check if target is within parent
      const relativePath = relative(resolvedParent, resolvedTarget);
      // If relative path starts with '..' or is absolute, it's outside the parent
      return !relativePath.startsWith('..') && !isAbsolute(relativePath);
    };

    // Use join() to create cross-platform test paths
    const testBaseDir = join(sep, 'home', 'user', '.claude', 'skills');
    const testSkillPath = join(testBaseDir, 'my-skill');
    const testNestedPath = join(testBaseDir, 'category', 'my-skill');
    const testTraversalPath = join(testBaseDir, '..', '..', '..', 'etc', 'passwd');
    const testOutsidePath = join(sep, 'etc', 'passwd');
    const testPrefixPath = join(sep, 'home', 'user', '.claude', 'skills-evil');

    it('should allow normal skill paths within target directory', () => {
      expect(isPathSafe(testSkillPath, testBaseDir)).toBe(true);
    });

    it('should block path traversal attempts with ../', () => {
      expect(isPathSafe(testTraversalPath, testBaseDir)).toBe(false);
    });

    it('should block paths outside target directory', () => {
      expect(isPathSafe(testOutsidePath, testBaseDir)).toBe(false);
    });

    it('should block paths that are prefix but not subdirectory', () => {
      // /home/user/.claude/skills-evil should NOT be allowed when target is /home/user/.claude/skills
      expect(isPathSafe(testPrefixPath, testBaseDir)).toBe(false);
    });

    it('should allow nested subdirectories', () => {
      expect(isPathSafe(testNestedPath, testBaseDir)).toBe(true);
    });
  });
});

describe('GitHub shorthand parsing', () => {
  // Test the parsing logic for owner/repo and owner/repo/path
  const parseGitHubShorthand = (source: string): { repoUrl: string; skillSubpath: string } | null => {
    const parts = source.split('/');
    if (parts.length === 2) {
      return {
        repoUrl: `https://github.com/${source}`,
        skillSubpath: '',
      };
    } else if (parts.length > 2) {
      return {
        repoUrl: `https://github.com/${parts[0]}/${parts[1]}`,
        skillSubpath: parts.slice(2).join('/'),
      };
    }
    return null;
  };

  it('should parse owner/repo format', () => {
    const result = parseGitHubShorthand('anthropics/skills');
    expect(result).not.toBeNull();
    expect(result?.repoUrl).toBe('https://github.com/anthropics/skills');
    expect(result?.skillSubpath).toBe('');
  });

  it('should parse owner/repo/skill-path format', () => {
    const result = parseGitHubShorthand('anthropics/skills/document-skills/pdf');
    expect(result).not.toBeNull();
    expect(result?.repoUrl).toBe('https://github.com/anthropics/skills');
    expect(result?.skillSubpath).toBe('document-skills/pdf');
  });

  it('should parse owner/repo/nested/path format', () => {
    const result = parseGitHubShorthand('owner/repo/deep/nested/skill');
    expect(result).not.toBeNull();
    expect(result?.repoUrl).toBe('https://github.com/owner/repo');
    expect(result?.skillSubpath).toBe('deep/nested/skill');
  });

  it('should return null for single part', () => {
    const result = parseGitHubShorthand('single');
    expect(result).toBeNull();
  });
});
