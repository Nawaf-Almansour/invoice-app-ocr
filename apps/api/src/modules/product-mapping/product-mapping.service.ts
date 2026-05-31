import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VendorItemMapping } from './entities/vendor-item-mapping.entity';
import { normalizeText } from '../invoice-extraction/normalizers/normalize-text';

const UNIT_CONVERSIONS: Record<string, { targetUnit: string; factor: number }> = {
  box: { targetUnit: 'kg', factor: 5 },
  carton: { targetUnit: 'kg', factor: 12 },
  كرتون: { targetUnit: 'kg', factor: 12 },
  صندوق: { targetUnit: 'kg', factor: 5 },
  كيلو: { targetUnit: 'kg', factor: 1 },
  liter: { targetUnit: 'ml', factor: 1000 },
  لتر: { targetUnit: 'ml', factor: 1000 },
  pcs: { targetUnit: 'piece', factor: 1 },
  قطعة: { targetUnit: 'piece', factor: 1 },
};

@Injectable()
export class ProductMappingService {
  constructor(
    @InjectRepository(VendorItemMapping)
    private readonly repo: Repository<VendorItemMapping>,
  ) {}

  async getSuggestions(rawName: string, supplierId?: string): Promise<VendorItemMapping[]> {
    const normalized = normalizeText(rawName).toLowerCase();

    const exact = await this.repo.find({
      where: {
        normalizedVendorItemName: normalized,
        ...(supplierId ? { supplierId } : {}),
      },
    });
    if (exact.length > 0) return exact;

    const all = await this.repo.find({
      where: supplierId ? { supplierId } : {},
    });

    return all
      .filter((m) => {
        const score = this.fuzzyScore(normalized, m.normalizedVendorItemName);
        return score > 0.5;
      })
      .slice(0, 5);
  }

  async saveMapping(data: {
    supplierId?: string;
    rawVendorItemName: string;
    productId: string;
    sourceUnit?: string;
    targetUnit?: string;
  }): Promise<VendorItemMapping> {
    const normalized = normalizeText(data.rawVendorItemName).toLowerCase();
    const unitConv = data.sourceUnit ? UNIT_CONVERSIONS[data.sourceUnit.toLowerCase()] : undefined;

    const existing = await this.repo.findOne({
      where: {
        normalizedVendorItemName: normalized,
        ...(data.supplierId ? { supplierId: data.supplierId } : {}),
      },
    });

    if (existing) {
      await this.repo.update(existing.id, {
        productId: data.productId,
        sourceUnit: data.sourceUnit,
        targetUnit: data.targetUnit ?? unitConv?.targetUnit,
        conversionFactor: unitConv?.factor,
        confidence: 1.0,
      });
      return this.repo.findOneOrFail({ where: { id: existing.id } });
    }

    const mapping = this.repo.create({
      supplierId: data.supplierId,
      rawVendorItemName: data.rawVendorItemName,
      normalizedVendorItemName: normalized,
      productId: data.productId,
      sourceUnit: data.sourceUnit,
      targetUnit: data.targetUnit ?? unitConv?.targetUnit,
      conversionFactor: unitConv?.factor,
      confidence: 1.0,
    });
    return this.repo.save(mapping);
  }

  private fuzzyScore(a: string, b: string): number {
    const setA = new Set(a.split(' '));
    const setB = new Set(b.split(' '));
    const intersection = [...setA].filter((w) => setB.has(w)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
  }
}
