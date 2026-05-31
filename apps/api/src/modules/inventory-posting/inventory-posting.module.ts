import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { InventoryPostingService } from './inventory-posting.service';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryMovement])],
  providers: [InventoryPostingService],
  exports: [InventoryPostingService],
})
export class InventoryPostingModule {}
