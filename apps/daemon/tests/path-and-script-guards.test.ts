import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { openBrowser } from '../src/browser/index.js';
import { writeBrandSystem } from '../src/brands/engine/build.js';
import type { BrandSystem } from '../src/brands/engine/types.js';
import { readTranscript } from '../src/critique/transcript.js';
import { renderOAuthResultPage } from '../src/http/oauth-result-page.js';

const tempDirs: string[] = [];
function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'od-guards-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('openBrowser', () => {
  it('refuses non-web schemes without spawning an opener', () => {
    const spawn = vi.fn();
    for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'not a url']) {
      expect(openBrowser(url, { platform: 'linux', spawn: spawn as never })).toBeNull();
    }
    expect(spawn).not.toHaveBeenCalled();
  });
});

describe('renderOAuthResultPage', () => {
  it('keeps an attacker-supplied message inside the inline script', () => {
    const html = renderOAuthResultPage({
      ok: false,
      message: '</script><script>alert(1)</script>',
    });
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html).toContain('\\u003c/script\\u003e');
  });
});

describe('writeBrandSystem', () => {
  it('writes nothing when any file would land outside the output directory', () => {
    const root = tempDir();
    const outDir = path.join(root, 'out');
    const system = {
      slug: 'x',
      files: { 'tokens.json': '{}', '../escaped.txt': 'nope' },
    } as unknown as BrandSystem;
    expect(() => writeBrandSystem(system, outDir)).toThrow(/escapes the output directory/);
    expect(fs.existsSync(path.join(root, 'escaped.txt'))).toBe(false);
    expect(fs.existsSync(path.join(outDir, 'tokens.json'))).toBe(false);
  });
});

describe('readTranscript', () => {
  it('rejects a file name that climbs out of the artifact directory', async () => {
    const dir = tempDir();
    const read = async () => {
      for await (const _event of readTranscript(dir, '../outside.ndjson')) {
        // unreachable
      }
    };
    await expect(read()).rejects.toThrow(RangeError);
  });
});
