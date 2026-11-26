import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { ApiError } from './errors.js';

export interface ResolvedAddress {
  readonly address: string;
  readonly family: number;
}

export type LookupFn = (hostname: string) => Promise<readonly ResolvedAddress[]>;

export const defaultLookup: LookupFn = async (hostname) => {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((record) => ({ address: record.address, family: record.family }));
};

export interface ResolvedTarget {
  readonly url: URL;
  readonly address: string;
  readonly family: number;
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [a, b, c] = parts;
  if (a === undefined || b === undefined || c === undefined) return false;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false;
  return true;
}

function isPublicIpv6(address: string): boolean {
  const value = address.toLowerCase();
  if (value === '::' || value === '::1') return false;

  const mapped = value.match(/ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isPublicIpv4(mapped[1]);
  if (value.startsWith('::ffff:')) return false;

  const firstHextet = value.split(':')[0] ?? '';
  const first = Number.parseInt(firstHextet, 16);
  if (Number.isFinite(first)) {
    if (first >= 0xfc00 && first <= 0xfdff) return false;
    if (first >= 0xfe80 && first <= 0xfebf) return false;
    if (first >= 0xff00) return false;
  }

  if (value.startsWith('2001:db8')) return false;
  return true;
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

export async function validateTargetUrl(
  raw: string,
  lookup: LookupFn = defaultLookup,
): Promise<ResolvedTarget> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ApiError('URL_NOT_ALLOWED', 400, '接口地址格式不正确');
  }

  if (url.protocol !== 'https:') {
    throw new ApiError('URL_NOT_ALLOWED', 400, '仅允许 HTTPS 接口地址');
  }
  if (url.username || url.password) {
    throw new ApiError('URL_NOT_ALLOWED', 400, '接口地址不能包含账号密码');
  }

  const hostname = url.hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase();
  if (!hostname) {
    throw new ApiError('URL_NOT_ALLOWED', 400, '接口地址缺少主机名');
  }
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new ApiError('URL_NOT_ALLOWED', 400, '接口地址不允许指向本机');
  }

  const literalFamily = isIP(hostname);
  if (literalFamily !== 0) {
    if (!isPublicAddress(hostname)) {
      throw new ApiError('URL_NOT_ALLOWED', 400, '接口地址不允许指向内网或本机');
    }
    return { url, address: hostname, family: literalFamily };
  }

  let records: readonly ResolvedAddress[];
  try {
    records = await lookup(hostname);
  } catch {
    throw new ApiError('NETWORK', 502, '无法解析接口地址');
  }
  if (records.length === 0) {
    throw new ApiError('NETWORK', 502, '无法解析接口地址');
  }
  for (const record of records) {
    if (!isPublicAddress(record.address)) {
      throw new ApiError('URL_NOT_ALLOWED', 400, '接口地址不允许指向内网或本机');
    }
  }

  const [first] = records;
  if (!first) {
    throw new ApiError('NETWORK', 502, '无法解析接口地址');
  }
  return { url, address: first.address, family: first.family };
}
