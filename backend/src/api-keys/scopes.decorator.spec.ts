import { Reflector } from '@nestjs/core';
import {
  RequireScopes,
  SCOPES_METADATA_KEY,
} from './scopes.decorator';

/**
 * scope decorator 的單元測試：確認 metadata 被正確寫入、
 * 並可被 Reflector.getAllAndMerge 讀回（這就是 ApiKeyAuthGuard 的行為）。
 */
describe('@RequireScopes decorator', () => {
  it('在 method 上掛 metadata', () => {
    class Demo {
      @RequireScopes('bookings:read')
      handler() {
        return null;
      }
    }
    const reflector = new Reflector();
    const meta = reflector.get(SCOPES_METADATA_KEY, Demo.prototype.handler);
    expect(meta).toEqual(['bookings:read']);
  });

  it('支援多個 scope', () => {
    class Demo {
      @RequireScopes('bookings:read', 'venues:read')
      handler() {
        return null;
      }
    }
    const reflector = new Reflector();
    const meta = reflector.get(SCOPES_METADATA_KEY, Demo.prototype.handler);
    expect(meta).toEqual(['bookings:read', 'venues:read']);
  });

  it('class + method 同時宣告 → getAllAndMerge 合併', () => {
    @RequireScopes('venues:read')
    class Demo {
      @RequireScopes('bookings:read')
      handler() {
        return null;
      }
    }
    const reflector = new Reflector();
    const merged = reflector.getAllAndMerge(SCOPES_METADATA_KEY, [
      Demo.prototype.handler,
      Demo,
    ]);
    // 順序可能依 nest 版本不同，但要包含兩個值
    expect(merged).toEqual(expect.arrayContaining(['bookings:read', 'venues:read']));
    expect(merged).toHaveLength(2);
  });

  it('未掛 decorator → 無 metadata', () => {
    class Demo {
      handler() {
        return null;
      }
    }
    const reflector = new Reflector();
    const meta = reflector.get(SCOPES_METADATA_KEY, Demo.prototype.handler);
    expect(meta).toBeUndefined();
  });
});
