// Helpers compartidos de los schemas Keystatic (T27).
//
// Contexto: Keystatic REESCRIBE el frontmatter desde el schema al guardar;
// cualquier clave real no mapeada se BORRA. Antes de escribir estos módulos se
// inventarió la corpus completa (813 posts, 302 cursos, 4 páginas) clave a
// clave; cada clave real está mapeada en las colecciones de este directorio.
import { fields } from '@keystatic/core';
import type { ContentFormField } from '@keystatic/core';

// Campo de contenido "texto crudo" para cuerpos HTML (posts, cursos, páginas).
//
// Keystatic NO trae un campo de contenido de texto plano: los disponibles
// (fields.document / fields.markdoc / fields.mdx) son editores ricos que
// REESCRIBEN el cuerpo al guardar y corromperían nuestro HTML (se renderiza en
// build con set:html + sanitizer). fields.text tampoco sirve: su formKind es
// 'slug', no 'content', y `format.contentField` exige un campo con
// formKind 'content' — si no, la carga del config lanza
// ContentFieldLocationError ("does not point to a content field").
//
// Este campo cumple el contrato ContentFormField:
//  - Lee el cuerpo del .md tal cual (bytes crudos) y lo expone como string.
//  - Al guardar devuelve exactamente esos bytes como contenido (round-trip),
//    de modo que una escritura futura (T29) no toca el HTML.
//  - Input() devuelve null A PROPÓSITO: el cuerpo NO es editable desde la UI
//    de Keystatic. Un editor rico lo reescribiría y corruptiría el HTML.
// El tipo ContentFormField de esta versión de Keystatic no admite `label`
// (a diferencia de los campos básicos), así que el campo va sin etiqueta UI.
export function rawHtmlContent(): ContentFormField<string | null, string | null, string | null> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return {
    kind: 'form',
    formKind: 'content',
    contentExtension: '.md',
    // Sin UI a propósito: ver comentario superior.
    Input() {
      return null;
    },
    defaultValue() {
      return null;
    },
    // El cuerpo no vive en el frontmatter: el valor frontmatter de esta clave
    // es siempre undefined y el contenido real llega por args.content.
    parse() {
      return null;
    },
    serialize(value: string | null) {
      return {
        value: undefined,
        content: value === null ? undefined : encoder.encode(value),
        external: new Map<string, ReadonlyMap<string, Uint8Array>>(),
        other: new Map<string, Uint8Array>(),
      };
    },
    validate(value: string | null) {
      return value;
    },
    reader: {
      parse(_value, extra: { content: Uint8Array | undefined }) {
        return extra.content === undefined ? null : decoder.decode(extra.content);
      },
    },
  };
}

// Campo de fecha ISO para `date` (posts) y `extractedAt` (cursos/páginas).
//
// Realidad del corpus (verificado archivo a archivo): el timestamp va SIN
// comillas (`date: 2014-03-17T11:39:52.000Z`) y js-yaml —la misma librería que
// usa Keystatic para parsear frontmatter— lo resuelve como objeto Date.
//
// T1 (spec S4): en T27 se usaba `fields.date`, que AL GUARDAR trunca el
// timestamp a 'YYYY-MM-DD' (su parse convierte Date → solo la fecha UTC) —
// pérdida irreversible de la hora en las 1.119 entradas en el primer guardado.
// Este campo conserva el instante completo:
//  - parse: Date → toISOString() completo (o string tal cual, que es lo que
//    devuelve el input de fecha para entradas nuevas).
//  - serialize: MISMA técnica que usa el propio fields.date (un Date con
//    toISOString()/toString() parcheados): js-yaml emite el timestamp SIN
//    comillas, de modo que al releerlo sigue siendo un Date con el mismo
//    instante. (Verificado: dump emite `date: 2015-03-18T15:51:28.000Z`.)
//  - Input: el `<input type="date">` de Keystatic solo admite 'YYYY-MM-DD',
//    así que muestra la fecha y, si el editor la cambia, re-adjunta la hora
//    original (una fecha nueva sin hora previa se guarda como fecha pura).
//
// Alternativas descartadas (rompían la lectura del corpus):
//  - fields.dateTime: su validador exige /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/ y
//    el parse de un Date devuelve 'YYYY-MM-DDTHH:mm:ss' (con segundos) →
//    FieldDataError en el 100 % de las entradas.
//  - fields.text: parseAsNormalField lanza 'Must be a string' sobre un Date.
export function isoDateField(label: string) {
  const base = fields.date({
    label,
    validation: { isRequired: true },
  });
  type Stored = Parameters<typeof base.parse>[0];
  type InputProps = Parameters<typeof base.Input>[0];
  type Value = ReturnType<typeof base.parse>;

  const parse = (value: Stored): Value => {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    throw new Error(`${label}: se esperaba una fecha ISO`);
  };
  const validate = (value: Value): string => {
    if (value === null) throw new Error(`${label} is required`);
    if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(value)) {
      throw new Error(`${label}: fecha inválida ("${value}")`);
    }
    return value;
  };

  return {
    ...base,
    Input(props: InputProps) {
      const full = props.value;
      return base.Input({
        ...props,
        value: full === null ? null : full.slice(0, 10),
        onChange(next) {
          if (next === null || next === '') {
            props.onChange(null);
            return;
          }
          const timePart = full !== null && full.includes('T') ? full.slice(full.indexOf('T')) : '';
          props.onChange(`${next}${timePart}`);
        },
      });
    },
    parse,
    serialize(value: Value) {
      if (value === null) return { value: undefined };
      const date = new Date(value);
      date.toISOString = () => value;
      date.toString = () => value;
      return { value: date };
    },
    validate,
    reader: {
      parse: (value: Stored) => validate(parse(value)),
    },
  };
}

// Texto que SOBREVIVE al guardado cuando su valor es '' (T1, spec S4).
//
// fields.text.serialize('') devuelve { value: undefined } y el visitor
// `object` de serializeProps ELIMINA la clave del YAML. En el corpus eso
// borra al guardar: `title` (9 posts vacíos), `excerpt` (170) y
// `thumbnailAlt` (813/813 siempre vacío); como Astro exige esas claves
// (`z.string()`), el siguiente build se rompe. Aplicar a toda clave presente
// en el corpus cuyo valor pueda ser ''.
export function persistText(
  label: string,
  options: { required?: boolean; multiline?: boolean } = {},
) {
  const base = fields.text({
    label,
    multiline: options.multiline,
    validation: options.required ? { isRequired: true } : undefined,
  });
  return {
    ...base,
    serialize(value: string) {
      return { value };
    },
  };
}

// Campo slug canónico (slugField de las tres colecciones).
//
// T1 (spec S4): serializeProps trata la clave slugField con
// serializeWithSlug(...).value, y fields.text devuelve value: undefined — Keystatic
// ESCRIBE el slug solo en el nombre de archivo y OMITE la clave `slug` del
// frontmatter al guardar. Astro exige `slug` en las tres colecciones
// (z.coerce.string / z.string) ⇒ el primer guardado rompería el build.
// Al devolver value conservamos la clave, siempre coherente con el nombre de
// archivo (el nombre se deriva del mismo valor en getSlugFromState).
// La lectura no cambia: el reader de Keystatic sigue exponiendo
// data.slug === null y el slug canónico vive en entry.slug (contrato T27).
export function slugKeyField(label: string) {
  const base = fields.text({
    label,
    validation: { isRequired: true },
  });
  return {
    ...base,
    serializeWithSlug(value: string) {
      return { slug: value, value: value === '' ? undefined : value };
    },
  };
}
