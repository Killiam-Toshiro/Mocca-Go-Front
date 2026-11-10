import type { components } from '@/lib/api/schema';

type Schemas = components['schemas'];

/** Producto tal como lo ve el personal: sin costo ni margen (D-070). */
export type StaffProduct = Omit<
  Schemas['ProductResponse'],
  'cost' | 'costPercent'
>;
export type ProductPage = Omit<Schemas['ProductPageResponse'], 'data'> & {
  data: StaffProduct[];
};
export type Movement = Schemas['MovementResponse'];
export type MovementPage = Schemas['MovementPageResponse'];
export type CreatedMovement = Schemas['CreatedMovementResponse'];
export type Category = StaffProduct['category'];
export type MovementType = Movement['type'];
export interface MovementInput {
  type: MovementType;
  quantity: number;
  reason: string;
}

/** Se descarta el costo al llegar: ninguna pantalla puede mostrarlo por error. */
export function toStaffProduct(
  product: Schemas['ProductResponse'],
): StaffProduct {
  const { cost: _cost, costPercent: _costPercent, ...rest } = product;
  void _cost;
  void _costPercent;
  return rest;
}
