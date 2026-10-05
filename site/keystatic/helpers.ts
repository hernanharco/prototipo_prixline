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
// Por eso fields.date, cuyo parse convierte Date → 'YYYY-MM-DD' (UTC) y
// valida el resultado.
//
// Alternativas descartadas (ambas romperían la LECTURA de todas las entradas):
//  - fields.dateTime: su validador exige /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/ y
//    el parse de un Date devuelve 'YYYY-MM-DDTHH:mm:ss' (con segundos) →
//    FieldDataError en el 100 % de las entradas.
//  - fields.text: parseAsNormalField lanza 'Must be a string' sobre un Date.
//
// Riesgo conocido (a revisar en T29): al GUARDAR, fields.date serializa solo
// la fecha y trunca la hora del frontmatter. La lectura (T27) no escribe nada.
export function isoDateField(label: string) {
  return fields.date({
    label,
    validation: { isRequired: true },
  });
}
