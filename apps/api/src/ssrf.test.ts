// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { isPublicAddress, validateTargetUrl, type LookupFn } from './ssrf.js';

const publicLookup: LookupFn = async () => [{ address: '93.184.216.34', family: 4 }];

const privateIpv4 = [
  '0.0.0.0',
  '10.0.0.1',
  '100.64.0.1',
  '127.0.0.1',
  '169.254.169.254',
  '172.16.0.1',
  '172.31.255.255',
  '192.0.0.1',
  '192.168.1.1',
  '198.18.0.1',
  '198.51.100.1',
  '203.0.113.1',
  '224.0.0.1',
  '255.255.255.255',
];

const privateIpv6 = [
  '::',
  '::1',
  '::ffff:127.0.0.1',
  '::ffff:10.0.0.1',
  '::ffff:7f00:1',
  'fc00::1',
  'fd12:3456::1',
  'fe80::1',
  'ff02::1',
  '2001:db8::1',
];

describe('isPublicAddress', () => {
  it.each(privateIpv4)('拒绝私网 IPv4 %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(privateIpv6)('拒绝私网 IPv6 %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(['93.184.216.34', '8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])(
    '接受公网地址 %s',
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );

  it('拒绝非法地址字符串', () => {
    expect(isPublicAddress('not-an-ip')).toBe(false);
    expect(isPublicAddress('999.1.1.1')).toBe(false);
  });
});

describe('validateTargetUrl', () => {
  it('允许 https 公网域名并返回解析地址', async () => {
    const target = await validateTargetUrl(
      'https://api.example.com/v1/chat/completions',
      publicLookup,
    );
    expect(target.url.href).toBe('https://api.example.com/v1/chat/completions');
    expect(target.address).toBe('93.184.216.34');
    expect(target.family).toBe(4);
  });

  it('允许 https 公网 IP 字面量', async () => {
    const lookup = vi.fn<LookupFn>(publicLookup);
    const target = await validateTargetUrl('https://93.184.216.34/v1', lookup);
    expect(target.address).toBe('93.184.216.34');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('拒绝非法 URL', async () => {
    await expect(validateTargetUrl('not-a-url', publicLookup)).rejects.toMatchObject({
      code: 'URL_NOT_ALLOWED',
      status: 400,
    });
  });

  it('拒绝非 https 协议', async () => {
    await expect(
      validateTargetUrl('http://api.example.com/v1', publicLookup),
    ).rejects.toMatchObject({ code: 'URL_NOT_ALLOWED', status: 400 });
    await expect(validateTargetUrl('ftp://api.example.com/v1', publicLookup)).rejects.toMatchObject(
      {
        code: 'URL_NOT_ALLOWED',
        status: 400,
      },
    );
  });

  it('拒绝 URL 内嵌账号密码', async () => {
    await expect(
      validateTargetUrl('https://user:pass@api.example.com/v1', publicLookup),
    ).rejects.toMatchObject({ code: 'URL_NOT_ALLOWED', status: 400 });
  });

  it('拒绝 localhost 与 .localhost', async () => {
    await expect(validateTargetUrl('https://localhost/v1', publicLookup)).rejects.toMatchObject({
      code: 'URL_NOT_ALLOWED',
    });
    await expect(validateTargetUrl('https://api.localhost/v1', publicLookup)).rejects.toMatchObject(
      { code: 'URL_NOT_ALLOWED' },
    );
  });

  it.each(privateIpv4)('拒绝私网 IPv4 字面量 %s', async (address) => {
    await expect(validateTargetUrl(`https://${address}/v1`, publicLookup)).rejects.toMatchObject({
      code: 'URL_NOT_ALLOWED',
      status: 400,
    });
  });

  it.each(['::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1'])(
    '拒绝私网 IPv6 字面量 %s',
    async (address) => {
      await expect(
        validateTargetUrl(`https://[${address}]/v1`, publicLookup),
      ).rejects.toMatchObject({ code: 'URL_NOT_ALLOWED', status: 400 });
    },
  );

  it('拒绝 DNS 解析到私网地址', async () => {
    const lookup: LookupFn = async () => [{ address: '10.0.0.8', family: 4 }];
    await expect(validateTargetUrl('https://api.example.com/v1', lookup)).rejects.toMatchObject({
      code: 'URL_NOT_ALLOWED',
      status: 400,
    });
  });

  it('域名解析结果中任一地址为私网即拒绝', async () => {
    const lookup: LookupFn = async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ];
    await expect(validateTargetUrl('https://api.example.com/v1', lookup)).rejects.toMatchObject({
      code: 'URL_NOT_ALLOWED',
    });
  });

  it('DNS 无记录返回 NETWORK', async () => {
    const lookup: LookupFn = async () => [];
    await expect(validateTargetUrl('https://api.example.com/v1', lookup)).rejects.toMatchObject({
      code: 'NETWORK',
      status: 502,
    });
  });

  it('DNS 解析失败返回 NETWORK', async () => {
    const lookup: LookupFn = async () => {
      throw new Error('ENOTFOUND');
    };
    await expect(validateTargetUrl('https://api.example.com/v1', lookup)).rejects.toMatchObject({
      code: 'NETWORK',
      status: 502,
    });
  });
});
