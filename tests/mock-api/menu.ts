/** Menú de prueba con la forma de `MenuItemResponse` del back (sin imagen ni opciones). */
export interface MockMenuItem {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: 'combo' | 'cafe' | 'bebida' | 'panaderia' | 'pasteleria' | 'snack';
  price: number;
  available: boolean;
  components: { name: string; quantity: number }[];
}

const item = (
  sku: string,
  name: string,
  category: MockMenuItem['category'],
  price: number,
  description: string,
  extra: Partial<Pick<MockMenuItem, 'available' | 'components'>> = {},
): MockMenuItem => ({
  id: `prod-${sku.toLowerCase()}`,
  sku,
  name,
  description,
  category,
  price,
  available: extra.available ?? true,
  components: extra.components ?? [],
});

const ORDER = ['combo', 'cafe', 'bebida', 'panaderia', 'pasteleria', 'snack'];

/** 20 productos y 3 combos; dos productos agotados (`PAS-TRES`, `SNK-PAPA`). */
export function buildMenu(): MockMenuItem[] {
  return [
    item('CMB-CLAS', 'Combo Clásico', 'combo', 6500, 'Capuchino y pandebono.', {
      components: [
        { name: 'Capuchino', quantity: 1 },
        { name: 'Pandebono', quantity: 1 },
      ],
    }),
    item('CMB-ESTU', 'Combo Estudio', 'combo', 7500, 'Americano y croissant.', {
      components: [
        { name: 'Americano', quantity: 1 },
        { name: 'Croissant', quantity: 1 },
      ],
    }),
    item('CMB-DULC', 'Combo Dulce', 'combo', 9000, 'Mocca y brownie.', {
      components: [
        { name: 'Mocca', quantity: 1 },
        { name: 'Brownie', quantity: 1 },
      ],
    }),
    item('CAF-ESPR', 'Espresso', 'cafe', 3000, 'Café corto e intenso.'),
    item('CAF-AMER', 'Americano', 'cafe', 3500, 'Espresso alargado con agua.'),
    item('CAF-CAPU', 'Capuchino', 'cafe', 4500, 'Café con leche'),
    item('CAF-LATT', 'Latte', 'cafe', 5000, 'Café suave con mucha leche.'),
    item(
      'CAF-MOCC',
      'Mocca',
      'cafe',
      5500,
      'Café con chocolate y leche vaporizada.',
    ),
    item('BEB-CHOC', 'Chocolate caliente', 'bebida', 4500, 'Espeso y casero.'),
    item('BEB-CHAI', 'Té chai', 'bebida', 4000, 'Té negro con especias.'),
    item('BEB-LIMO', 'Limonada natural', 'bebida', 3500, 'Con hielo.'),
    item('BEB-NARA', 'Jugo de naranja', 'bebida', 4500, 'Recién exprimido.'),
    item('PAN-PAND', 'Pandebono', 'panaderia', 2500, 'Caliente, de queso.'),
    item('PAN-CROI', 'Croissant', 'panaderia', 3800, 'De mantequilla.'),
    item('PAN-ALMO', 'Almojábana', 'panaderia', 2500, 'De queso, suave.'),
    item('PAN-BUNU', 'Buñuelo', 'panaderia', 2000, 'Frito al momento.'),
    item('PAS-BROW', 'Brownie', 'pasteleria', 4500, 'De chocolate oscuro.'),
    item('PAS-ZANA', 'Torta de zanahoria', 'pasteleria', 5500, 'Con nueces.'),
    item('PAS-GALL', 'Galleta de avena', 'pasteleria', 2500, 'Con pasas.'),
    item('PAS-TRES', 'Tres leches', 'pasteleria', 6000, 'Porción individual.', {
      available: false,
    }),
    item('SNK-SAND', 'Sándwich de pollo', 'snack', 8500, 'Pan artesanal.'),
    item('SNK-TOST', 'Tostada con queso', 'snack', 5000, 'Con mantequilla.'),
    item('SNK-PAPA', 'Papas criollas', 'snack', 4000, 'Con salsa.', {
      available: false,
    }),
  ].sort(
    (a, b) =>
      ORDER.indexOf(a.category) - ORDER.indexOf(b.category) ||
      a.name.localeCompare(b.name, 'es'),
  );
}
