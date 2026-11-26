import type { components } from '@/lib/api/schema';

type Schemas = components['schemas'];

/** Producto del catálogo tal como lo ve el admin: con costo y margen (D-115). */
export type Product = Schemas['ProductResponse'];
export type ProductPage = Schemas['ProductPageResponse'];
export type Category = Product['category'];
export type SimpleCategory = Exclude<Category, 'combo'>;
export type ComponentLine = Product['components'][number];
