import { describe, expect, it } from 'vitest'
import { formatUuidV7 } from '@shared/domain/id'

const bytes = (fill: number): Uint8Array => Uint8Array.from({ length: 10 }, () => fill)

describe('formatUuidV7', () => {
  it('生成标准 36 位 UUID，并标上版本号 7 与变体位', () => {
    const id = formatUuidV7(0, bytes(0))
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('时间戳在高位，因此按字符串排序等于按时间排序', () => {
    const earlier = formatUuidV7(1_700_000_000_000, bytes(1))
    const later = formatUuidV7(1_700_000_001_000, bytes(2))
    expect(earlier < later).toBe(true)
  })

  it('同一毫秒内随机部分不同则 id 不同', () => {
    const a = formatUuidV7(1_700_000_000_000, bytes(1))
    const b = formatUuidV7(1_700_000_000_000, bytes(2))
    expect(a).not.toBe(b)
  })

  it('时间戳超出 48 位就报错，而不是悄悄截断', () => {
    expect(() => formatUuidV7(2 ** 48, bytes(1))).toThrow(RangeError)
  })

  it('随机字节不足 10 个时报错', () => {
    expect(() => formatUuidV7(0, new Uint8Array(4))).toThrow(RangeError)
  })
})
