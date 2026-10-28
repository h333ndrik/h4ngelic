import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';

const argumentsList = process.argv.slice(2);
const argument = (name, fallback) => {
  const index = argumentsList.indexOf(name);
  return index >= 0 ? argumentsList[index + 1] : fallback;
};
const baseURL = argument('--base-url', 'http://127.0.0.1:4173');
const label = argument('--label', 'after');
const homeRuns = Number(argument('--home-runs', '3'));
const workRuns = Number(argument('--work-runs', '1'));
if (!/^[a-z0-9-]+$/i.test(label) || !Number.isInteger(homeRuns) || homeRuns < 1 || !Number.isInteger(workRuns) || workRuns < 1) {
  throw new Error('Use a simple --label and positive integer --home-runs/--work-runs.');
}

const outputDirectory = new URL('../artifacts/performance/', import.meta.url);
await mkdir(outputDirectory, { recursive: true });
const flags = ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const results = [];
const cases = [{ name: 'home-mobile', path: '/', runs: homeRuns }, { name: 'work-mobile', path: '/work', runs: workRuns }];
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

for (const target of cases) {
  for (let index = 1; index <= target.runs; index++) {
    console.log(`START ${label} ${target.name} run ${index}/${target.runs}`);
    const chrome = await launch({ chromePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', chromeFlags: flags, logLevel: 'silent' });
    try {
      const measured = await lighthouse(new URL(target.path, baseURL).href, {
        port: chrome.port,
        logLevel: 'error',
        output: 'json',
        onlyCategories: ['performance'],
        formFactor: 'mobile',
        throttlingMethod: 'simulate',
        maxWaitForLoad: 20000,
        maxWaitForFcp: 20000,
        disableFullPageScreenshot: true,
      });
      if (!measured?.lhr) throw new Error('Lighthouse did not return a report.');
      const report = measured.lhr;
      const filename = `${label}-${target.name}-${index}.json`;
      await writeFile(new URL(filename, outputDirectory), JSON.stringify(report, null, 2));
      if (report.runtimeError) throw new Error(`Lighthouse runtime error: ${JSON.stringify(report.runtimeError)}`);
      const audit = (name) => report.audits[name]?.numericValue ?? null;
      const requests = report.audits['network-requests']?.details?.items || [];
      const scripts = requests.filter((request) => request.resourceType === 'Script');
      const result = {
        label, target: target.name, run: index, report: filename,
        finalURL: report.finalDisplayedUrl,
        lighthouseVersion: report.lighthouseVersion,
        hostUserAgent: report.environment.hostUserAgent,
        benchmarkIndex: report.environment.benchmarkIndex,
        fetchedAt: report.fetchTime,
        settings: report.configSettings,
        performanceScore: report.categories.performance.score * 100,
        fcpMs: audit('first-contentful-paint'),
        lcpMs: audit('largest-contentful-paint'),
        totalBlockingTimeMs: audit('total-blocking-time'),
        cumulativeLayoutShift: audit('cumulative-layout-shift'),
        speedIndexMs: audit('speed-index'),
        totalTransferredBytes: audit('total-byte-weight'),
        transferredScriptBytes: scripts.reduce((sum, request) => sum + (request.transferSize || 0), 0),
        uncompressedScriptBytes: scripts.reduce((sum, request) => sum + (request.resourceSize || 0), 0),
        requestCount: requests.length,
        scriptURLs: scripts.map((request) => request.url),
        warnings: report.runWarnings || [],
      };
      for (const key of ['fcpMs', 'lcpMs', 'totalBlockingTimeMs', 'cumulativeLayoutShift']) {
        if (result[key] === null) throw new Error(`Required metric ${key} missing from ${filename}.`);
      }
      results.push(result);
      console.log(`DONE ${label} ${target.name} run ${index}: score=${result.performanceScore}, FCP=${Math.round(result.fcpMs)}ms, LCP=${Math.round(result.lcpMs)}ms, TBT=${Math.round(result.totalBlockingTimeMs)}ms, CLS=${result.cumulativeLayoutShift}, JS=${result.transferredScriptBytes}B, requests=${result.requestCount}`);
      if (result.warnings.length) console.log(`WARN ${JSON.stringify(result.warnings)}`);
    } finally {
      await chrome.kill();
    }
  }
}

const metricKeys = ['performanceScore', 'fcpMs', 'lcpMs', 'totalBlockingTimeMs', 'cumulativeLayoutShift', 'speedIndexMs', 'totalTransferredBytes', 'transferredScriptBytes', 'uncompressedScriptBytes', 'requestCount'];
const medians = {};
for (const target of cases) {
  const targetResults = results.filter((result) => result.target === target.name);
  medians[target.name] = { runs: targetResults.length, ...Object.fromEntries(metricKeys.map((key) => [key, median(targetResults.map((result) => result[key]))])) };
}
const summary = { label, baseURL, generatedAt: new Date().toISOString(), chromeFlags: flags, results, medians };
await writeFile(new URL(`${label}-summary.json`, outputDirectory), JSON.stringify(summary, null, 2));
console.log(`SUMMARY ${JSON.stringify(medians)}`);
console.log(`Reports: ${fileURLToPath(outputDirectory)}`);
