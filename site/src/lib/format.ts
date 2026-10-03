// Helpers de presentación para el contenido importado (posts/páginas).
// Los títulos y textos de WordPress traen entidades HTML (`&nbsp;`, `&#8230;`,
// etc.); Astro escapa los nodos de texto, así que hay que decodificarlas aquí
// para que no se vean literales en la página.

const NAMED: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&([a-zA-Z]+);/g, (match, name: string) =>
      name in NAMED ? NAMED[name] : match,
    );
}

const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Formato largo en español, determinista (sin depender de ICU/locale). */
export function formatDateEs(date: Date): string {
  return `${date.getDate()} de ${MONTHS_ES[date.getMonth()]} de ${date.getFullYear()}`;
}

/** Valor para el atributo `datetime` de `<time>` (YYYY-MM-DD). */
export function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
