import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('vendor_item_mappings')
export class VendorItemMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string;

  @Column({ name: 'raw_vendor_item_name', type: 'text' })
  rawVendorItemName: string;

  @Column({ name: 'normalized_vendor_item_name', type: 'text' })
  normalizedVendorItemName: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ name: 'source_unit', length: 50, nullable: true })
  sourceUnit: string;

  @Column({ name: 'target_unit', length: 50, nullable: true })
  targetUnit: string;

  @Column({ name: 'conversion_factor', type: 'numeric', precision: 12, scale: 4, nullable: true })
  conversionFactor: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  confidence: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
