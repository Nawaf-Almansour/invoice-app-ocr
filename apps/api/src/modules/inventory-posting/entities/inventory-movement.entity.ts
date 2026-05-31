import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('inventory_movements')
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_invoice_id', type: 'uuid' })
  purchaseInvoiceId: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ name: 'movement_type', length: 20, default: 'IN' })
  movementType: string;

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  quantity: number;

  @Column({ length: 50, nullable: true })
  unit: string;

  @Column({ name: 'unit_cost', type: 'numeric', precision: 12, scale: 2, nullable: true })
  unitCost: number;

  @Column({ name: 'total_cost', type: 'numeric', precision: 12, scale: 2, nullable: true })
  totalCost: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
