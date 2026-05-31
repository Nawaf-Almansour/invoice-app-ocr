export class ReviewLineUpdateDto {
  id: string;
  productId?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
}

export class ReviewUpdateDto {
  supplierName?: string;
  supplierVatNumber?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  subtotal?: number;
  vatAmount?: number;
  total?: number;
  currency?: string;
  lines?: ReviewLineUpdateDto[];
}
