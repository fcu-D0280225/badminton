import { numericSimpleArrayTransformer } from './api-key.entity';

/**
 * BADM-T15 fix：TypeORM `simple-array` 反序列化後是 string[]（DB 存 `1,2`，
 * 讀回 `['1','2']`），與 ParseIntPipe 之後的 `number` 直接比對會永遠 false。
 * 這個 spec 鎖死 transformer 行為：read-side 拿到的就是 number[]，
 * 且 `includes(1)` 對「DB 讀回的 row」成立。
 */
describe('numericSimpleArrayTransformer (api-key.entity)', () => {
  describe('from（DB → entity）', () => {
    it('將 typeorm simple-array 反序列化的 string[] 轉成 number[]', () => {
      const result = numericSimpleArrayTransformer.from(['1', '2', '3']);
      expect(result).toEqual([1, 2, 3]);
      // 關鍵迴歸：模擬 controller 拿 ParseIntPipe 後的 number 來 includes
      expect(result.includes(1)).toBe(true);
      // 對比未經 transform 的原始陣列：`['1'].includes(1) === false`（這是 bug 來源）
      expect((['1'] as unknown as number[]).includes(1)).toBe(false);
    });

    it('原本就是 number[] → 維持 number[]', () => {
      expect(numericSimpleArrayTransformer.from([5, 7])).toEqual([5, 7]);
    });

    it('null / undefined → []', () => {
      expect(numericSimpleArrayTransformer.from(null)).toEqual([]);
      expect(numericSimpleArrayTransformer.from(undefined)).toEqual([]);
    });

    it('非陣列 → []（防呆）', () => {
      expect(numericSimpleArrayTransformer.from('1,2' as any)).toEqual([]);
    });

    it('夾雜垃圾值會被 filter 掉，不會回 NaN', () => {
      const result = numericSimpleArrayTransformer.from(['1', 'abc', '2']);
      expect(result).toEqual([1, 2]);
    });
  });

  describe('to（entity → DB）', () => {
    it('number[] passthrough', () => {
      expect(numericSimpleArrayTransformer.to([1, 2])).toEqual([1, 2]);
    });

    it('undefined / null → []（避免 simple-array 拋錯）', () => {
      expect(numericSimpleArrayTransformer.to(undefined)).toEqual([]);
      expect(numericSimpleArrayTransformer.to(null)).toEqual([]);
    });
  });
});
