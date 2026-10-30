/** Categorías de gasto. El valor es también la etiqueta que ve el usuario. */
export const EXPENSE_CATEGORIES = [
  "Mercado",
  "Restaurantes y domicilios",
  "Transporte",
  "Servicios públicos",
  "Telefonía e internet",
  "Suscripciones",
  "Salud",
  "Educación",
  "Vivienda",
  "Compras",
  "Entretenimiento",
  "Cuidado personal",
  "Mascotas",
  "Impuestos y seguridad social",
  "Efectivo",
  "Transferencias",
  "Otros",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const UNCATEGORIZED = "Sin categoría";

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Clave estable de un comercio: sin tildes, sin números (sucursales,
 * referencias) ni signos. "TIENDA D1 CALI 245" y "Tienda D1 Cali" → "TIENDA D CALI".
 */
export function merchantKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * Comercios frecuentes en Colombia que no necesitan IA. No son reglas
 * fiscales: solo ahorran llamadas. El orden importa (lo primero que coincide gana).
 */
const KEYWORD_RULES: [RegExp, ExpenseCategory][] = [
  [/\b(FLYPASS|PEAJE|PEAJES|TERPEL|PRIMAX|BIOMAX|TEXACO|ESSO|ESTACION|GASOLINERA|PARQUEADERO|UBER|DIDI|CABIFY|INDRIVE|SITP|TRANSMILENIO)\b/, "Transporte"],
  [/\b(RAPPI|IFOOD|DOMICILIOS|RESTAURANTE|PIZZA|BURGER|KFC|MCDONALDS|CREPES|FRISBY|CORRAL|JUAN VALDEZ|STARBUCKS|PANADERIA|CAFE)\b/, "Restaurantes y domicilios"],
  [/\b(MERCADOLI\w*|MERCADO LIBRE|AMAZON|TEMU|SHEIN|DOLLARCITY|FALABELLA)\b/, "Compras"],
  [/\b(ARA|EXITO|OLIMPICA|JUMBO|CARULLA|METRO|ALKOSTO|MAKRO|SUPERMERCADO|MERCADO|MINIMERCADO|TIENDAS? D|FRUVER|LA CANASTA|ISIMO)\b/, "Mercado"],
  [/\b(NETFLIX|SPOTIFY|DISNEY|HBO|YOUTUBE|APPLE|ICLOUD|GOOGLE|MICROSOFT|OPENAI|CHATGPT|ANTHROPIC|CLAUDE|SUSCR)\b/, "Suscripciones"],
  [/\b(CELSIA|EPM|EMCALI|ACUAVALLE|ACUEDUCTO|CODENSA|ENEL|VANTI|GASES|ESSA|EMPRESAS PUBLICAS)\b/, "Servicios públicos"],
  [/\b(CLARO|MOVISTAR|TIGO|WOM|ETB|DIRECTV)\b/, "Telefonía e internet"],
  [/\b(DROGUERIA|FARMACIA|CRUZ VERDE|LOCATEL|FARMATODO|COLSUBSIDIO|EPS|CLINICA|LABORATORIO|ODONTO)\b/, "Salud"],
  [/\b(CINE|CINEMARK|PROCINAL|CINE COLOMBIA|STEAM|PLAYSTATION|XBOX|NINTENDO|BOLETAS|TUBOLETA)\b/, "Entretenimiento"],
  [/\b(PILA|APORTES EN LINEA|MI PLANILLA|SOI|ASOPAGOS|DIAN|IMPUESTO|PREDIAL)\b/, "Impuestos y seguridad social"],
];

/** Reglas que deciden solas, antes que las de comercios. */
const EXACT_RULES: [RegExp, ExpenseCategory][] = [
  [/^RETIRO EN CAJERO$/, "Efectivo"],
  [/^SUC VIRTUAL$/, "Transferencias"],
  [/^(INTERESES|COMISIONES|CARGOS) TARJETA NU$/, "Otros"],
  [/^CUOTA DE MANEJO BANCOLOMBIA$/, "Otros"],
];

export function categoryByKeyword(key: string): ExpenseCategory | null {
  for (const [pattern, category] of EXACT_RULES) {
    if (pattern.test(key)) return category;
  }
  for (const [pattern, category] of KEYWORD_RULES) {
    if (pattern.test(key)) return category;
  }
  return null;
}

/**
 * Nombres de pila frecuentes en Colombia. Un pago por QR puede ir a una
 * * persona ("PEDRO PRUEBA PIÑA"): esos nombres no se envían a la IA.
 */
const FIRST_NAMES = new Set(
  `ADRIANA ALBA ALBERTO ALEJANDRA ALEJANDRO ALEXANDER ALVARO ANA ANDREA ANDRES ANGELA ANGIE ANTONIO ARMANDO
  BEATRIZ BRAYAN CAMILA CAMILO CARLOS CAROLINA CATALINA CESAR CLARA CLAUDIA CRISTIAN DANIEL DANIELA DAVID DIANA
  DIEGO EDGAR EDUARDO EDWIN ELIZABETH ESTEBAN FABIAN FELIPE FERNANDO FRANCISCO GABRIEL GABRIELA GERMAN GLORIA
  GUSTAVO HECTOR HERNAN ISABEL JAIME JAVIER JEISON JENNIFER JESSICA JHON JOHANA JOHN JORGE JOSE JUAN JULIAN
  JULIANA JULIO KAREN KATHERINE LAURA LEIDY LILIANA LINA LORENA LUCIA LUIS LUISA LUZ MANUEL MANUELA MARCELA
  MARCO MARIA MARIO MARTHA MATEO MAURICIO MIGUEL MONICA NATALIA NELSON NICOLAS OLGA OMAR OSCAR PABLO PAOLA
  PATRICIA PAULA PEDRO RAFAEL RAMIRO RICARDO ROBERTO RODRIGO ROSA SAMUEL SANDRA SANTIAGO SARA SEBASTIAN SERGIO
  SOFIA STEVEN TATIANA VALENTINA VALERIA VANESSA VICTOR WILLIAM WILSON YAMILE YESENIA YOLANDA`.split(/\s+/),
);

export function looksLikePersonName(key: string): boolean {
  const words = key.split(" ");
  return words.length >= 2 && words.length <= 4 && FIRST_NAMES.has(words[0]);
}
