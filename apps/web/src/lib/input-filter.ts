/** AI 提交前自由描述的长度上限（interaction-spec §19.4）。 */
export const AI_FREE_TEXT_LIMIT = 500;

export type SensitiveKind = 'phone' | 'idCard' | 'bankCard';

export const SENSITIVE_KIND_LABELS: Readonly<Record<SensitiveKind, string>> = {
  phone: '手机号',
  idCard: '身份证号',
  bankCard: '银行卡号',
};

export interface FreeTextAnalysis {
  /** 过滤首尾空白后的可提交文本。 */
  readonly text: string;
  readonly length: number;
  readonly limit: number;
  readonly overLimit: boolean;
  readonly sensitive: readonly SensitiveKind[];
}

const ZERO_WIDTH = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;
// 目的就是匹配并剔除控制字符，保留 \n（\u000A）与 \r（\u000D）供换行归一化。
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const PHONE_PATTERN = /(?<!\d)1[3-9]\d{9}(?!\d)/g;
const ID_CARD_18_PATTERN = /(?<!\d)\d{17}[\dXx](?!\d)/g;
const ID_CARD_15_PATTERN = /(?<!\d)\d{15}(?!\d)/g;
const BANK_CARD_PATTERN = /(?<![\d-])(?:\d[ -]?){15,18}\d(?![\d-])/g;

interface Range {
  readonly start: number;
  readonly end: number;
}

/** 去除零宽/控制字符，统一换行并合并连续空行；保留首尾空白供继续编辑。 */
export function sanitizeFreeText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '  ')
    .replace(ZERO_WIDTH, '')
    .replace(CONTROL, '')
    .replace(/\n{3,}/g, '\n\n');
}

function overlaps(ranges: readonly Range[], start: number, end: number): boolean {
  return ranges.some((range) => start < range.end && end > range.start);
}

/**
 * 检测常见个人信息格式；只返回类型，不返回命中内容，避免敏感值进入提示或日志。
 * 银行卡在手机号/身份证命中范围外再做 16～19 位判断。
 */
export function detectSensitiveInfo(value: string): SensitiveKind[] {
  const text = sanitizeFreeText(value);
  const ranges: Range[] = [];
  const found = new Set<SensitiveKind>();

  const collect = (pattern: RegExp, kind: SensitiveKind): void => {
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (kind === 'bankCard' && overlaps(ranges, start, end)) continue;
      ranges.push({ start, end });
      found.add(kind);
    }
  };

  collect(PHONE_PATTERN, 'phone');
  collect(ID_CARD_18_PATTERN, 'idCard');
  collect(ID_CARD_15_PATTERN, 'idCard');
  collect(BANK_CARD_PATTERN, 'bankCard');

  return (['phone', 'idCard', 'bankCard'] as const).filter((kind) => found.has(kind));
}

/** 提交前的本地过滤与检测；长度按去首尾空白后的字符数计算。 */
export function analyzeFreeText(value: string): FreeTextAnalysis {
  const text = sanitizeFreeText(value).trim();
  return {
    text,
    length: text.length,
    limit: AI_FREE_TEXT_LIMIT,
    overLimit: text.length > AI_FREE_TEXT_LIMIT,
    sensitive: detectSensitiveInfo(text),
  };
}
