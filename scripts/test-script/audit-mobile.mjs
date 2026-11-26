import { mkdir, writeFile } from 'node:fs/promises';

import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const OUT = '.artifacts/audit/T-021';

const VIEWPORTS = [
  { name: '320', width: 320, height: 640, dpr: 2 },
  { name: '360', width: 360, height: 800, dpr: 2.5 },
  { name: '390', width: 390, height: 844, dpr: 3 },
  { name: '393', width: 393, height: 852, dpr: 3 },
  { name: '412', width: 412, height: 915, dpr: 2.625 },
  { name: '430', width: 430, height: 932, dpr: 3 },
  { name: '440', width: 440, height: 956, dpr: 3 },
  { name: '1440', width: 1440, height: 900, dpr: 1 },
];

const FLOW_VIEWPORTS = ['360', '390', '412'];

await mkdir(OUT, { recursive: true });

const overflowOf = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const touchIssues = (page) =>
  page.evaluate(() => {
    const nodes = [...document.querySelectorAll('button, a[href], [role="button"]')];
    const issues = [];
    const seen = new Set();
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      if (rect.width === 0 || rect.height === 0) continue;
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (style.pointerEvents === 'none') continue;
      if (rect.width >= 44 && rect.height >= 44) continue;
      const label = (
        node.getAttribute('aria-label') ||
        node.textContent ||
        node.getAttribute('name') ||
        node.tagName
      )
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 32);
      const key = `${label}|${Math.round(rect.width)}x${Math.round(rect.height)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push({
        label,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        disabled: node.disabled === true,
      });
    }
    return issues;
  });

const contrastIssues = (page) =>
  page.evaluate(() => {
    const parse = (input) => {
      const parts = input.match(/[\d.]+/g);
      if (!parts || parts.length < 3) return null;
      return [
        Number(parts[0]),
        Number(parts[1]),
        Number(parts[2]),
        parts[3] ? Number(parts[3]) : 1,
      ];
    };
    const luminance = ([r, g, b]) => {
      const channel = (value) => {
        const v = value / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const ratio = (a, b) => {
      const l1 = Math.max(luminance(a), luminance(b));
      const l2 = Math.min(luminance(a), luminance(b));
      return (l1 + 0.05) / (l2 + 0.05);
    };
    const background = (el) => {
      let node = el;
      while (node) {
        const style = getComputedStyle(node);
        const color = parse(style.backgroundColor);
        if (color && color[3] >= 0.95) return color;
        node = node.parentElement;
      }
      return [8, 10, 18, 1];
    };

    const failures = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('[aria-hidden="true"]')) continue;
      const text = [...el.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (Number(style.opacity) < 0.5) continue;
      const fg = parse(style.color);
      if (!fg) continue;
      const size = parseFloat(style.fontSize);
      const weight = Number(style.fontWeight) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const threshold = large ? 3 : 4.5;
      const bg = background(el);
      const value = ratio(fg, bg);
      if (value >= threshold) continue;
      failures.push({
        text: text.slice(0, 36),
        tag: el.tagName.toLowerCase(),
        className: String(el.className || '').slice(0, 48),
        color: style.color,
        background: `rgb(${bg.slice(0, 3).join(',')})`,
        fontSize: size,
        weight,
        ratio: Number(value.toFixed(2)),
        threshold,
      });
    }

    const unique = new Map();
    for (const item of failures) {
      const key = `${item.text}|${item.className}|${item.ratio}`;
      if (!unique.has(key)) unique.set(key, item);
    }
    return [...unique.values()].sort((a, b) => a.ratio - b.ratio).slice(0, 15);
  });

const fpsSample = (page, durationMs = 1500) =>
  page.evaluate(async (ms) => {
    const deltas = [];
    await new Promise((resolve) => {
      let last = performance.now();
      const start = last;
      const tick = (now) => {
        deltas.push(now - last);
        last = now;
        if (now - start < ms) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    const frames = deltas.slice(1);
    if (!frames.length) return { fps: 0, p95FrameMs: 0, frames: 0 };
    const average = frames.reduce((sum, value) => sum + value, 0) / frames.length;
    const sorted = [...frames].sort((a, b) => a - b);
    return {
      fps: Number((1000 / average).toFixed(1)),
      p95FrameMs: Number((sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(1)),
      frames: frames.length,
    };
  }, durationMs);

const firstLoad = (page) =>
  page.evaluate(() => {
    const resources = performance.getEntriesByType('resource');
    const scripts = resources.filter(
      (entry) => entry.initiatorType === 'script' || entry.name.endsWith('.js'),
    );
    return {
      requests: resources.length + 1,
      scriptRequests: scripts.length,
      scriptTransferKb: Math.round(
        scripts.reduce((sum, entry) => sum + (entry.transferSize || 0), 0) / 1024,
      ),
      totalTransferKb: Math.round(
        (resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0) +
          (performance.getEntriesByType('navigation')[0]?.transferSize || 0)) /
          1024,
      ),
    };
  });

async function openPage(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr,
  });
  await context.addInitScript(() => window.localStorage.setItem('lrs.guide.v1', '1'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return { context, page, errors };
}

async function gotoHome(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '狼人杀助手' }).waitFor();
}

async function auditStaticPages(browser, viewport) {
  const { context, page, errors } = await openPage(browser, viewport);
  const result = { viewport: viewport.name, pages: {}, errors: [] };
  const full = viewport.name === '320' || viewport.name === '390' || viewport.name === '1440';
  const contrast = viewport.name === '390';

  try {
    await gotoHome(page);
    result.pages.home = {
      overflow: await overflowOf(page),
      touch: full ? await touchIssues(page) : undefined,
      contrast: contrast ? await contrastIssues(page) : undefined,
      load: await firstLoad(page),
      fps: viewport.name === '390' ? await fpsSample(page) : undefined,
    };

    if (viewport.name === '390' || viewport.name === '1440') {
      await page.screenshot({ path: `${OUT}/home-${viewport.name}.png`, fullPage: false });
    }

    await page.getByRole('button', { name: /开始主持/ }).click();
    await page.getByRole('heading', { name: '开局设置' }).waitFor();
    result.pages.setup = {
      overflow: await overflowOf(page),
      touch: full ? await touchIssues(page) : undefined,
      contrast: contrast ? await contrastIssues(page) : undefined,
    };

    await gotoHome(page);
    await page.getByRole('button', { name: '我的助手', exact: true }).click();
    await page.getByRole('heading', { name: '我的身份档案' }).waitFor();
    result.pages.assistant = {
      overflow: await overflowOf(page),
      touch: full ? await touchIssues(page) : undefined,
      contrast: contrast ? await contrastIssues(page) : undefined,
      fps: viewport.name === '390' ? await fpsSample(page) : undefined,
    };

    if (viewport.name === '390') {
      await page.screenshot({ path: `${OUT}/assistant-${viewport.name}.png`, fullPage: false });
    }

    if (viewport.name === '1440') {
      await page.screenshot({ path: `${OUT}/assistant-${viewport.name}.png`, fullPage: false });
    }

    await gotoHome(page);
    await page.getByRole('button', { name: '先翻规则书' }).click();
    await page.getByRole('heading', { name: '月蚀规则书' }).waitFor();
    result.pages.rules = {
      overflow: await overflowOf(page),
      touch: full ? await touchIssues(page) : undefined,
      contrast: contrast ? await contrastIssues(page) : undefined,
    };

    if (viewport.name === '390' || viewport.name === '1440') {
      await page.screenshot({ path: `${OUT}/rules-${viewport.name}.png`, fullPage: false });
    }
  } catch (error) {
    result.error = String(error).slice(0, 300);
  } finally {
    result.errors = errors;
    await context.close();
  }

  return result;
}

async function auditFlow(browser, viewport) {
  const { context, page, errors } = await openPage(browser, viewport);
  const steps = [];

  try {
    await gotoHome(page);
    await page.getByRole('button', { name: /开始主持/ }).click();
    await page.getByRole('button', { name: /实体牌录入/ }).click();
    await page.getByRole('button', { name: /开始发牌/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: '开始' }).click();
    await page.getByRole('heading', { name: /发牌 · 实体牌录入/ }).waitFor();

    const roles = [
      '预言家',
      '女巫',
      '猎人',
      '守卫',
      '平民',
      '平民',
      '平民',
      '平民',
      '狼人',
      '狼人',
      '狼人',
      '狼人',
    ];
    for (const role of roles) {
      await page
        .getByRole('button', { name: new RegExp(`^${role} · 余 \\d+$`) })
        .first()
        .click();
    }
    await page.getByRole('button', { name: /完成发牌，进入天黑/ }).click();
    await page.getByRole('heading', { name: '天黑请闭眼' }).waitFor();
    steps.push({ phase: 'night', overflow: await overflowOf(page) });
    steps[steps.length - 1].touch = await touchIssues(page);

    await page.getByRole('button', { name: '空守' }).click();
    await page.getByRole('button', { name: '确认，下一位' }).click();
    await page
      .getByRole('group', { name: '预言家目标选择' })
      .getByRole('button', { name: /^09/ })
      .click();
    await page.getByRole('button', { name: '确认，下一位' }).click();
    await page
      .getByRole('group', { name: '狼人目标选择' })
      .getByRole('button', { name: /^05/ })
      .click();
    await page.getByRole('button', { name: '确认，下一位' }).click();
    await page.getByRole('button', { name: '不用药' }).click();
    await page.getByRole('button', { name: '天亮了，结算夜晚' }).click();
    await page.getByRole('heading', { name: '警长竞选' }).waitFor();
    steps.push({ phase: 'sheriff', overflow: await overflowOf(page) });

    await page.getByRole('button', { name: '无人上警 · 本局无警长' }).click();
    await page.getByRole('button', { name: '公布死讯' }).click();
    await page.getByRole('heading', { name: '天亮了' }).waitFor();
    steps.push({ phase: 'dawn', overflow: await overflowOf(page) });

    await page.getByRole('button', { name: '进入发言' }).click();
    await page.getByRole('heading', { name: '依次发言' }).waitFor();
    steps.push({ phase: 'speech', overflow: await overflowOf(page) });

    await page.getByRole('button', { name: '进入投票' }).click();
    await page.getByRole('heading', { name: '放逐投票' }).waitFor();
    steps.push({ phase: 'vote', overflow: await overflowOf(page) });
    steps[steps.length - 1].touch = await touchIssues(page);
  } catch (error) {
    steps.push({ phase: 'error', message: String(error).slice(0, 300) });
  } finally {
    await context.close();
  }

  return { viewport: viewport.name, steps, errors };
}

async function fontScaleAudit(browser) {
  const viewport = VIEWPORTS.find((item) => item.name === '390');
  const { context, page, errors } = await openPage(browser, viewport);
  const result = { pages: {} };
  try {
    await gotoHome(page);
    await page.addStyleTag({ content: 'html { font-size: 125% }' });
    result.pages.home = await overflowOf(page);
    await page.getByRole('button', { name: /开始主持/ }).click();
    await page.getByRole('heading', { name: '开局设置' }).waitFor();
    await page.addStyleTag({ content: 'html { font-size: 125% }' });
    result.pages.setup = await overflowOf(page);
    await gotoHome(page);
    await page.addStyleTag({ content: 'html { font-size: 125% }' });
    await page.getByRole('button', { name: '我的助手', exact: true }).click();
    await page.getByRole('heading', { name: '我的身份档案' }).waitFor();
    await page.addStyleTag({ content: 'html { font-size: 125% }' });
    result.pages.assistant = await overflowOf(page);
  } catch (error) {
    result.error = String(error).slice(0, 300);
  } finally {
    result.errors = errors;
    await context.close();
  }
  return result;
}

async function dprScreenshots(browser) {
  const results = [];
  for (const dpr of [2, 3]) {
    const viewport = { name: `390-dpr${dpr}`, width: 390, height: 844, dpr };
    const { context, page, errors } = await openPage(browser, viewport);
    try {
      await gotoHome(page);
      await page.screenshot({ path: `${OUT}/home-dpr${dpr}.png` });
      await page.getByRole('button', { name: '我的助手', exact: true }).click();
      await page.getByRole('heading', { name: '我的身份档案' }).waitFor();
      await page.screenshot({ path: `${OUT}/assistant-dpr${dpr}.png` });
      results.push({ dpr, errors });
    } catch (error) {
      results.push({ dpr, error: String(error).slice(0, 200), errors });
    } finally {
      await context.close();
    }
  }
  return results;
}

const browser = await chromium.launch();
const report = { base: BASE, viewports: [], flows: [], fontScale: null, dpr: [] };

try {
  for (const viewport of VIEWPORTS) {
    report.viewports.push(await auditStaticPages(browser, viewport));
  }

  for (const name of FLOW_VIEWPORTS) {
    const viewport = VIEWPORTS.find((item) => item.name === name);
    report.flows.push(await auditFlow(browser, viewport));
  }

  report.fontScale = await fontScaleAudit(browser);
  report.dpr = await dprScreenshots(browser);
} finally {
  await browser.close();
}

await writeFile(`${OUT}/audit.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
