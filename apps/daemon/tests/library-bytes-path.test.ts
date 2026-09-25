import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { resolveAssetBytesPath } from '../src/library.js';
import type { LibraryAssetRecord } from '../src/library-store.js';

function referenced(
  relPath: string,
  originProjectId = 'proj',
): LibraryAssetRecord {
  return {
    storage: 'referenced',
    originProjectId,
    relPath,
  } as LibraryAssetRecord;
}

describe('resolveAssetBytesPath', () => {
  const projects = path.resolve('/tmp/od-projects');

  it('keeps a relative file inside the project', () => {
    expect(resolveAssetBytesPath(referenced('images/a.png'), projects)).toBe(
      path.resolve(projects, 'proj', 'images/a.png'),
    );
  });

  it('rejects a referenced path that climbs out of the project', () => {
    expect(resolveAssetBytesPath(referenced('../../etc/passwd'), projects)).toBeNull();
  });

  it('rejects a project id that is not a single path segment', () => {
    expect(resolveAssetBytesPath(referenced('a.png', '../other'), projects)).toBeNull();
  });

  it('rejects dot and dot-dot project ids that basename leaves unchanged', () => {
    expect(resolveAssetBytesPath(referenced('secrets/token', '.'), projects)).toBeNull();
    expect(resolveAssetBytesPath(referenced('secrets/token', '..'), projects)).toBeNull();
  });
});
