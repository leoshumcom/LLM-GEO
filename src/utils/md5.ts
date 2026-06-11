/**
 * Cloudflare Workers 兼容的 MD5 实现
 * 纯 JS，无外部依赖
 * 参考：js-md5 (MIT License)
 */

export function md5(str: string): string {
  const xl = 8;
  const add32 = (a: number, b: number) => (a + b) & 0xffffffff;

  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }

  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & c) | ((~b) & d), a, b, x, s, t);
  }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(c ^ (b | (~d)), a, b, x, s, t);
  }

  function core(md: number[], blocks: number[]) {
    const len = blocks.length;
    for (let i = 0; i < len; i += 16) {
      const k = blocks.slice(i, i + 16);
      const old = md.slice();
      md[0] = ff(md[0], md[1], md[2], md[3], k[0], 7, -680876936);
      md[3] = ff(md[3], md[0], md[1], md[2], k[1], 12, -389564586);
      md[2] = ff(md[2], md[3], md[0], md[1], k[2], 17, 606105819);
      md[1] = ff(md[1], md[2], md[3], md[0], k[3], 22, -1044525330);
      md[0] = ff(md[0], md[1], md[2], md[3], k[4], 7, -176418897);
      md[3] = ff(md[3], md[0], md[1], md[2], k[5], 12, 1200080426);
      md[2] = ff(md[2], md[3], md[0], md[1], k[6], 17, -1473231341);
      md[1] = ff(md[1], md[2], md[3], md[0], k[7], 22, -45705983);
      md[0] = ff(md[0], md[1], md[2], md[3], k[8], 7, 1770035416);
      md[3] = ff(md[3], md[0], md[1], md[2], k[9], 12, -1958414417);
      md[2] = ff(md[2], md[3], md[0], md[1], k[10], 17, -42063);
      md[1] = ff(md[1], md[2], md[3], md[0], k[11], 22, -1990404162);
      md[0] = ff(md[0], md[1], md[2], md[3], k[12], 7, 1804603682);
      md[3] = ff(md[3], md[0], md[1], md[2], k[13], 12, -40341101);
      md[2] = ff(md[2], md[3], md[0], md[1], k[14], 17, -1502002290);
      md[1] = ff(md[1], md[2], md[3], md[0], k[15], 22, 1236535329);
      md[0] = gg(md[0], md[1], md[2], md[3], k[1], 5, -165796510);
      md[3] = gg(md[3], md[0], md[1], md[2], k[6], 9, -1069501632);
      md[2] = gg(md[2], md[3], md[0], md[1], k[11], 14, 643717713);
      md[1] = gg(md[1], md[2], md[3], md[0], k[0], 20, -373897302);
      md[0] = gg(md[0], md[1], md[2], md[3], k[5], 5, -701558691);
      md[3] = gg(md[3], md[0], md[1], md[2], k[10], 9, 38016083);
      md[2] = gg(md[2], md[3], md[0], md[1], k[15], 14, -660478335);
      md[1] = gg(md[1], md[2], md[3], md[0], k[4], 20, -405537848);
      md[0] = gg(md[0], md[1], md[2], md[3], k[9], 5, 568446438);
      md[3] = gg(md[3], md[0], md[1], md[2], k[14], 9, -1019803690);
      md[2] = gg(md[2], md[3], md[0], md[1], k[3], 14, -187363961);
      md[1] = gg(md[1], md[2], md[3], md[0], k[8], 20, 1163531501);
      md[0] = gg(md[0], md[1], md[2], md[3], k[13], 5, -1444681467);
      md[3] = gg(md[3], md[0], md[1], md[2], k[2], 9, -51403784);
      md[2] = gg(md[2], md[3], md[0], md[1], k[7], 14, 1735328473);
      md[1] = gg(md[1], md[2], md[3], md[0], k[12], 20, -1926607734);
      md[0] = hh(md[0], md[1], md[2], md[3], k[5], 4, -378558);
      md[3] = hh(md[3], md[0], md[1], md[2], k[8], 11, -2022574463);
      md[2] = hh(md[2], md[3], md[0], md[1], k[11], 16, 1839030562);
      md[1] = hh(md[1], md[2], md[3], md[0], k[14], 23, -35309556);
      md[0] = hh(md[0], md[1], md[2], md[3], k[1], 4, -1530992060);
      md[3] = hh(md[3], md[0], md[1], md[2], k[4], 11, 1272893353);
      md[2] = hh(md[2], md[3], md[0], md[1], k[7], 16, -155497632);
      md[1] = hh(md[1], md[2], md[3], md[0], k[10], 23, -1094730640);
      md[0] = hh(md[0], md[1], md[2], md[3], k[13], 4, 681279174);
      md[3] = hh(md[3], md[0], md[1], md[2], k[0], 11, -358537222);
      md[2] = hh(md[2], md[3], md[0], md[1], k[3], 16, -722521979);
      md[1] = hh(md[1], md[2], md[3], md[0], k[6], 23, 76029189);
      md[0] = hh(md[0], md[1], md[2], md[3], k[9], 4, -640364487);
      md[3] = hh(md[3], md[0], md[1], md[2], k[12], 11, -421815835);
      md[2] = hh(md[2], md[3], md[0], md[1], k[15], 16, 530742520);
      md[1] = hh(md[1], md[2], md[3], md[0], k[2], 23, -995338651);
      md[0] = ii(md[0], md[1], md[2], md[3], k[0], 6, -198630844);
      md[3] = ii(md[3], md[0], md[1], md[2], k[7], 10, 1126891415);
      md[2] = ii(md[2], md[3], md[0], md[1], k[14], 15, -1416354905);
      md[1] = ii(md[1], md[2], md[3], md[0], k[5], 21, -57434055);
      md[0] = ii(md[0], md[1], md[2], md[3], k[12], 6, 1700485571);
      md[3] = ii(md[3], md[0], md[1], md[2], k[3], 10, -1894986606);
      md[2] = ii(md[2], md[3], md[0], md[1], k[10], 15, -1051523);
      md[1] = ii(md[1], md[2], md[3], md[0], k[1], 21, -2054922799);
      md[0] = ii(md[0], md[1], md[2], md[3], k[8], 6, 1873313359);
      md[3] = ii(md[3], md[0], md[1], md[2], k[15], 10, -30611744);
      md[2] = ii(md[2], md[3], md[0], md[1], k[6], 15, -1560198380);
      md[1] = ii(md[1], md[2], md[3], md[0], k[13], 21, 1309151649);
      md[0] = ii(md[0], md[1], md[2], md[3], k[4], 6, -145523070);
      md[3] = ii(md[3], md[0], md[1], md[2], k[11], 10, -1120210378);
      md[2] = ii(md[2], md[3], md[0], md[1], k[2], 15, 718787259);
      md[1] = ii(md[1], md[2], md[3], md[0], k[9], 21, -343485551);
      md[0] = add32(md[0], old[0]);
      md[1] = add32(md[1], old[1]);
      md[2] = add32(md[2], old[2]);
      md[3] = add32(md[3], old[3]);
    }
    return md;
  }

  function str2binl(str: string) {
    const bin: number[] = [];
    const mask = (1 << xl) - 1;
    const len = str.length;
    for (let i = 0; i < len * xl; i += xl) {
      bin[i >> 5] |= (str.charCodeAt(i / xl) & mask) << (i % 32);
    }
    return bin;
  }

  function binl2hex(binarray: number[]) {
    const hex_tab = '0123456789abcdef';
    let str = '';
    for (let i = 0; i < binarray.length * 4; i++) {
      str += hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xf) +
        hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xf);
    }
    return str;
  }

  const bin = str2binl(str);
  bin[str.length * xl >> 5] |= 0x80 << ((str.length * xl) % 32);
  bin[(((str.length * xl + 64) >>> 9) << 4) + 14] = str.length * xl;

  const md = core([1732584193, -271733879, -1732584194, 271733878], bin);
  return binl2hex(md);
}

export default md5;
