import { execFileSync } from 'node:child_process';

export function resolveBuildSha() {
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export function applyBuildMarker(html, sha) {
  const build = /^[a-f0-9]{7,40}$/i.test(String(sha || '')) ? String(sha) : 'unknown';
  return String(html)
    .replace(/<html(?=\s|>)/, `<html data-build="${build}"`)
    .replace(/<meta charset="UTF-8"\s*\/?\s*>/, match => `${match}\n    <meta name="h4-build" content="${build}" />`);
}

export function shouldLogBuild(environment = process.env) {
  return environment?.VERCEL_ENV !== 'production';
}

export const buildSha = resolveBuildSha();
