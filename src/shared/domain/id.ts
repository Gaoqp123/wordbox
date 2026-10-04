/**
 * 主键生成：UUID v7。
 *
 * 为什么不用 `crypto.randomUUID()`（v4）：v4 完全随机，做主键时索引会随机写入，
 * 而且**按 id 排序看不出创建顺序**。v7 把毫秒时间戳放在高位，既保留全局唯一，
 * 又天然按时间递增——列表默认排序、分页游标、将来做同步都能直接用。
 *
 * 这里只做纯格式化：时间戳与随机字节由调用方提供，所以可以脱离运行时单测。
 */

const HEX = '0123456789abcdef'

function toHex(bytes: Uint8Array): string {
  let output = ''
  for (const byte of bytes) {
    output += HEX[byte >> 4] + HEX[byte & 0x0f]
  }
  return output
}

/**
 * @param timestampMs 毫秒时间戳，占 48 位
 * @param random 10 个随机字节；其中 6 位要借给版本号与变体位
 */
export function formatUuidV7(timestampMs: number, random: Uint8Array): string {
  if (!Number.isInteger(timestampMs) || timestampMs < 0 || timestampMs > 2 ** 48 - 1) {
    throw new RangeError('时间戳超出 UUID v7 的 48 位范围')
  }
  if (random.length < 10) {
    throw new RangeError('随机字节不足 10 个')
  }

  const time = timestampMs.toString(16).padStart(12, '0')

  // 这 10 个字节对应 UUID 里的第 7~16 个字节（前面的 6 个字节是时间戳）。
  // 于是：bytes[0] 承载版本号，bytes[2] 承载变体位——差一位就会让变体位跑到最后一组去。
  const bytes = Uint8Array.from(random.slice(0, 10))
  // 版本 7：该字节高四位固定为 0111
  bytes[0] = (bytes[0] & 0x0f) | 0x70
  // 变体：该字节高两位固定为 10
  bytes[2] = (bytes[2] & 0x3f) | 0x80

  const rest = toHex(bytes)
  return [
    time.slice(0, 8),
    time.slice(8, 12),
    rest.slice(0, 4),
    rest.slice(4, 8),
    rest.slice(8, 20)
  ].join('-')
}
