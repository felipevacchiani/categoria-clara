// Generador de PDF sin dependencias: Helvetica (fuentes estándar), encabezado de marca,
// secciones, viñetas, recuadros de aviso y pie con referencia y numeración.
// Interfaz estable: pdf(title, lines) -> Buffer.

const W = 595, H = 842, M = 54, CW = W - 2 * M, BOTTOM = 74;
const NAVY = [0.086, 0.094, 0.114], TEAL = [0.918, 0.647, 0.227], DTEAL = [0.541, 0.353, 0.047];
const INK = [0.086, 0.094, 0.114], MUTED = [0.361, 0.373, 0.408], SOFT = [0.965, 0.949, 0.918];
const RULE = [0.890, 0.859, 0.804], AMBER = [0.878, 0.643, 0.227], AMBER_BG = [1, 0.969, 0.902];
const BAND_TEXT = [0.85, 0.82, 0.77];
const FONT = { R: 'F1', B: 'F2', I: 'F3' };

// Anchos AFM (1/1000 em) de Helvetica y Helvetica-Bold para ASCII 32..126.
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const SPECIAL = { '•': [350, 350, '\x95'], '–': [556, 556, '\x96'], '—': [1000, 1000, '\x97'], '‘': [222, 278, '\x91'], '’': [222, 278, '\x92'], '“': [333, 500, '\x93'], '”': [333, 500, '\x94'], '€': [556, 556, '\x80'], '…': [1000, 1000, '\x85'] };
const LATIN = { '·': [278, 278], 'º': [365, 365], 'ª': [370, 370], '°': [400, 400], '¿': [611, 611], '¡': [333, 333], '«': [556, 556], '»': [556, 556], '\xa0': [278, 278] };

function charWidth(ch, font) {
  const bold = font === 'B' ? 1 : 0;
  const code = ch.charCodeAt(0);
  if (code >= 32 && code <= 126) return (bold ? BOLD : HELV)[code - 32];
  if (SPECIAL[ch]) return SPECIAL[ch][bold];
  if (LATIN[ch]) return LATIN[ch][bold];
  const base = ch.normalize('NFD')[0];
  if (base !== ch && base.charCodeAt(0) >= 32 && base.charCodeAt(0) <= 126) return (bold ? BOLD : HELV)[base.charCodeAt(0) - 32];
  return 556;
}
const width = (text, font, size) => [...text].reduce((sum, ch) => sum + charWidth(ch, font), 0) * size / 1000;
const win = text => [...String(text).normalize('NFC')].map(ch => {
  const code = ch.charCodeAt(0);
  if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) return ch;
  return SPECIAL[ch]?.[2] ?? '?';
}).join('');
const clean = text => [...String(text).normalize('NFC')].map(ch => {
  const code = ch.charCodeAt(0);
  return (code >= 32 && code <= 126) || (code >= 160 && code <= 255) || SPECIAL[ch] ? ch : '?';
}).join('');
const escape = text => win(text).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
const rgb = ([r, g, b]) => `${r} ${g} ${b}`;

// Divide runs [{text,font,color}] en renglones que entran en maxW.
function wrap(runs, maxW, size) {
  const tokens = [];
  let pending = false;
  for (const run of runs) {
    clean(run.text).split(' ').forEach((part, i) => {
      if (i > 0) pending = true;
      if (!part) return;
      tokens.push({ ...run, text: part, space: pending && tokens.length > 0 });
      pending = false;
    });
  }
  const lines = [];
  let current = [], used = 0;
  const push = token => {
    const gap = token.space && current.length ? width(' ', token.font, size) : 0;
    const w = width(token.text, token.font, size);
    if (current.length && used + gap + w > maxW) { lines.push(current); current = []; used = 0; return push({ ...token, space: false }); }
    if (w > maxW) {
      let cut = token.text.length;
      while (cut > 1 && used + gap + width(token.text.slice(0, cut), token.font, size) > maxW) cut--;
      current.push({ ...token, text: token.text.slice(0, cut) });
      lines.push(current); current = []; used = 0;
      return push({ ...token, text: token.text.slice(cut), space: false });
    }
    current.push(token); used += gap + w;
  };
  tokens.forEach(push);
  if (current.length) lines.push(current);
  return lines.length ? lines : [[]];
}

function classify(line) {
  let m;
  if (!line.trim()) return { type: 'space' };
  if ((m = line.match(/^---\s*(.+?)\s*---$/))) {
    const parts = m[1].match(/^(.*?)\s*(\(.*\))?$/);
    return { type: 'heading', text: parts[1], note: parts[2] ?? '' };
  }
  if ((m = line.match(/^- (.*)$/))) return { type: 'bullet', text: m[1] };
  if ((m = line.match(/^(\d+)\.\s+(.*)$/))) return { type: 'num', n: m[1], text: m[2] };
  if ((m = line.match(/^(Fecha|Para|Asunto|De|Hechos|Solicito|Firma):\s?(.*)$/))) return { type: 'kv', key: m[1], value: m[2] };
  if (/^Encuadre normativo de referencia:$/.test(line)) return { type: 'label', text: line };
  if (/^(Atención|Plazos de protesta|En vuelos de cabotaje)/.test(line)) return { type: 'callout', text: line };
  if (/^Borrador informativo/.test(line)) return { type: 'disclaimer', text: line };
  return { type: 'paragraph', text: line };
}

export function pdf(title, lines) {
  const [brand, service] = title.includes(' · ') ? title.split(' · ') : ['Categoría Clara', title];
  let meta = null, body = lines;
  if (/^Servicio: /.test(lines[0] ?? '') && /^Referencia: /.test(lines[1] ?? '')) {
    const motor = (lines[0].match(/Motor\s+\S+/) ?? [''])[0];
    const [ref, fecha] = lines[1].slice(12).split(' · ');
    meta = { motor, ref, fecha, privado: lines[2] ?? '', descripcion: lines[3] ?? '' };
    body = lines.slice(4);
  }
  const blocks = body.flatMap(line => String(line).split('\n')).map(classify);
  while (blocks[0]?.type === 'space') blocks.shift();

  const pages = [];
  let ops, y;
  const text = (x, yy, str, font, size, color) => ops.push(`BT /${FONT[font]} ${size} Tf ${rgb(color)} rg ${x.toFixed(2)} ${yy.toFixed(2)} Td (${escape(str)}) Tj ET`);
  const rect = (x, yy, w, h, color) => ops.push(`${rgb(color)} rg ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  const box = (x, yy, w, h, fill, stroke) => ops.push(`${rgb(fill)} rg ${rgb(stroke)} RG 0.6 w ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re B`);
  const rule = (yy, color = RULE) => ops.push(`${rgb(color)} RG 0.6 w ${M} ${yy.toFixed(2)} m ${W - M} ${yy.toFixed(2)} l S`);
  const drawLine = (tokens, x, yy, size) => {
    let cursor = x, segment = null;
    const flush = () => { if (segment) { text(segment.x, yy, segment.text, segment.font, size, segment.color); segment = null; } };
    for (const token of tokens) {
      const gap = token.space ? width(' ', token.font, size) : 0;
      if (segment && segment.font === token.font && segment.color === token.color) {
        segment.text += (token.space ? ' ' : '') + token.text;
      } else {
        flush();
        cursor += gap;
        segment = { x: cursor, text: token.text, font: token.font, color: token.color };
        cursor -= gap;
      }
      cursor += gap + width(token.text, token.font, size);
    }
    flush();
  };

  function firstPage() {
    ops = []; pages.push(ops);
    rect(0, H - 124, W, 124, NAVY);
    rect(M, H - 34, 28, 3, TEAL);
    text(M, H - 50, brand, 'B', 11, TEAL);
    const nameLines = wrap([{ text: service, font: 'B', color: [1, 1, 1] }], CW, 24);
    let ty = H - 82;
    for (const l of nameLines.slice(0, 2)) { drawLine(l, M, ty, 24); ty -= 26; }
    if (meta) text(M, H - 112, `Referencia ${meta.ref}  ·  ${meta.fecha}  ·  ${meta.motor}`, 'R', 8.5, BAND_TEXT);
    y = H - 152;
    if (meta?.descripcion) {
      for (const l of wrap([{ text: meta.descripcion, font: 'R', color: INK }], CW, 12)) { drawLine(l, M, y, 12); y -= 16; }
      y -= 2;
    }
    if (meta?.privado) { text(M, y, meta.privado, 'I', 8.5, MUTED); y -= 12; }
    rule(y); y -= 24;
  }
  function nextPage() {
    ops = []; pages.push(ops);
    text(M, H - 40, brand, 'B', 9, DTEAL);
    text(M + width(brand + '  ', 'B', 9), H - 40, service, 'R', 9, MUTED);
    rule(H - 50);
    y = H - 74;
  }
  const ensure = h => { if (y - h < BOTTOM) nextPage(); };
  const flow = (wrapped, x, size, leading) => { for (const l of wrapped) { ensure(leading); drawLine(l, x, y, size); y -= leading; } };

  firstPage();
  const SIZE = 10.5, LEAD = 15;
  for (const block of blocks) {
    switch (block.type) {
      case 'space': y -= 6; break;
      case 'heading': {
        y -= 10; ensure(22 + LEAD * 2);
        rect(M, y - 3, 3, 14, TEAL);
        text(M + 11, y, block.text, 'B', 11.5, NAVY);
        if (block.note) text(M + 11 + width(block.text + '  ', 'B', 11.5), y, block.note, 'R', 9, MUTED);
        y -= 22; break;
      }
      case 'kv': {
        if (block.key === 'Firma') y -= 14;
        if (block.key === 'Hechos' || block.key === 'Solicito') y -= 4;
        flow(wrap([{ text: block.key + ':', font: 'B', color: NAVY }, { text: ' ' + block.value, font: 'R', color: INK }], CW, SIZE), M, SIZE, LEAD);
        break;
      }
      case 'label': y -= 4; flow(wrap([{ text: block.text, font: 'B', color: NAVY }], CW, SIZE), M, SIZE, LEAD); break;
      case 'bullet': {
        const wrapped = wrap([{ text: block.text, font: 'R', color: INK }], CW - 18, SIZE);
        ensure(LEAD); text(M + 6, y, '•', 'B', SIZE, DTEAL);
        flow(wrapped, M + 18, SIZE, LEAD); y -= 2; break;
      }
      case 'num': {
        const wrapped = wrap([{ text: block.text, font: 'R', color: INK }], CW - 20, SIZE);
        ensure(LEAD); text(M + 2, y, block.n + '.', 'B', SIZE, DTEAL);
        flow(wrapped, M + 20, SIZE, LEAD); y -= 3; break;
      }
      case 'callout': case 'disclaimer': {
        const callout = block.type === 'callout';
        const size = callout ? 10 : 8.5, lead = callout ? 14 : 12;
        const wrapped = wrap([{ text: block.text, font: callout ? 'R' : 'I', color: callout ? INK : MUTED }], CW - 28, size);
        const h = wrapped.length * lead + 16;
        y -= callout ? 6 : 14; ensure(h);
        if (callout) { rect(M, y - h + lead - 2, CW, h, AMBER_BG); rect(M, y - h + lead - 2, 3, h, AMBER); }
        else box(M, y - h + lead - 2, CW, h, SOFT, RULE);
        y -= 6;
        for (const l of wrapped) { drawLine(l, M + 14, y, size); y -= lead; }
        y -= 12; break;
      }
      default: flow(wrap([{ text: block.text, font: 'R', color: INK }], CW, SIZE), M, SIZE, LEAD);
    }
  }

  const total = pages.length;
  pages.forEach((pageOps, i) => {
    ops = pageOps;
    rule(54);
    text(M, 40, `${brand} · ${service}${meta ? ' · Ref. ' + meta.ref : ''}`, 'R', 7.5, MUTED);
    const label = `Página ${i + 1} de ${total}`;
    text(W - M - width(label, 'R', 7.5), 40, label, 'R', 7.5, MUTED);
  });

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>', '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>',
    `<< /Title (${escape(title)}) /Producer (${escape(brand)}) >>`
  ];
  const refs = [];
  for (const pageOps of pages) {
    const id = objects.length + 1;
    refs.push(`${id} 0 R`);
    const stream = pageOps.join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${id + 1} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
  }
  objects[1] = `<< /Type /Pages /Count ${refs.length} /Kids [${refs.join(' ')}] >>`;
  let document = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = document.length;
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = document.length;
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(document, 'latin1');
}
