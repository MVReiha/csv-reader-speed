// Fast drop-in for csv-reader 1.0.0 (make.fun's own CSV reader).
// Same answers, bit for bit: {columns, rows, errors} per {text, header}.
// Strategy: one pass over the text. Unquoted fields are scanned with a tight
// charCodeAt loop and sliced once at the delimiter (no indexOf call per
// field); quoted fields are found by locating the next quote (doubled quotes
// collapse to one) and slicing the segments; newlines inside quotes are
// transformed once, at the end of the field, and only when the field actually
// holds one.
// Pure: no clock, no randomness, no locale, nothing kept from one call to the next.

const COMMA = 0;
const BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = (n > 0 && text.charCodeAt(0) === 0xfeff) ? 1 : 0;
  let line = 1;

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    const recordLine = line;
    const recordRow = (header && columns === null) ? null : rows.length;
    const fields = [];
    let fend = COMMA;
    let fquoted = false;
    do {
      let fval;
      if (text.charCodeAt(pos) === 34) {
        fquoted = true;
        const open = pos;
        const openLine = line;
        let value = '';
        let seg = pos + 1;
        let q = -1;
        let closed = false;
        for (;;) {
          q = text.indexOf('"', seg);
          if (q === -1) break;
          if (text.charCodeAt(q + 1) === 34) {
            value += text.slice(seg, q);
            value += '"';
            seg = q + 2;
            continue;
          }
          value += text.slice(seg, q);
          closed = true;
          break;
        }
        if (!closed) {
          // The quote never closes: it is a literal character, and the text
          // after it is read again as an unquoted field.
          pos = open + 1;
          line = openLine;
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          // Fall through to the unquoted scan with initial value '"'.
          let v = '"';
          let i = pos;
          for (;;) {
            const c = i < n ? text.charCodeAt(i) : -1;
            if (c === 44) {
              v += text.slice(pos, i);
              pos = i + 1;
              fval = v;
              fend = COMMA;
              break;
            }
            if (c === 10) {
              v += text.slice(pos, i);
              pos = i + 1;
              line += 1;
              fval = v;
              fend = BREAK;
              break;
            }
            if (c === 13) {
              if (text.charCodeAt(i + 1) === 10) {
                v += text.slice(pos, i);
                pos = i + 2;
                line += 1;
                fval = v;
                fend = BREAK;
                break;
              }
              errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
              v += text.slice(pos, i);
              pos = i + 1;
              i = pos;
              continue;
            }
            if (c === -1) {
              v += text.slice(pos, n);
              pos = n;
              fval = v;
              fend = END;
              break;
            }
            i += 1;
          }
        } else {
          // CRLF and lone CR inside quotes are each one LF.
          if (value.indexOf('\n') !== -1 || value.indexOf('\r') !== -1) {
            value = value.replace(/\r\n?/g, '\n');
            let br = 0;
            for (let i = 0; i < value.length; i++) {
              if (value.charCodeAt(i) === 10) br += 1;
            }
            line += br;
          }
          pos = q + 1;
          if (pos >= n) {
            fval = value;
            fend = END;
          } else {
            const c = text.charCodeAt(pos);
            if (c === 44) {
              pos += 1;
              fval = value;
              fend = COMMA;
            } else if (c === 10) {
              pos += 1;
              line += 1;
              fval = value;
              fend = BREAK;
            } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
              pos += 2;
              line += 1;
              fval = value;
              fend = BREAK;
            } else {
              // What follows the closing quote is appended as it stands.
              let v = value;
              let i = pos;
              let added = 0;
              for (;;) {
                const d = i < n ? text.charCodeAt(i) : -1;
                if (d === 44) {
                  const s = text.slice(pos, i);
                  v += s;
                  added += s.length;
                  pos = i + 1;
                  fval = v;
                  fend = COMMA;
                  break;
                }
                if (d === 10) {
                  const s = text.slice(pos, i);
                  v += s;
                  added += s.length;
                  pos = i + 1;
                  line += 1;
                  fval = v;
                  fend = BREAK;
                  break;
                }
                if (d === 13) {
                  if (text.charCodeAt(i + 1) === 10) {
                    const s = text.slice(pos, i);
                    v += s;
                    added += s.length;
                    pos = i + 2;
                    line += 1;
                    fval = v;
                    fend = BREAK;
                    break;
                  }
                  errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
                  const s = text.slice(pos, i);
                  v += s;
                  added += s.length;
                  pos = i + 1;
                  i = pos;
                  continue;
                }
                if (d === -1) {
                  const s = text.slice(pos, n);
                  v += s;
                  added += s.length;
                  pos = n;
                  fval = v;
                  fend = END;
                  break;
                }
                i += 1;
              }
              if (added > 0) {
                errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
              }
            }
          }
        }
      } else {
        fquoted = false;
        // Unquoted field: scan to the next delimiter, slice once.
        let i = pos;
        let c = -1;
        while (i < n) {
          c = text.charCodeAt(i);
          if (c === 44 || c === 10 || c === 13) break;
          i += 1;
        }
        if (i >= n) {
          fval = text.slice(pos, n);
          pos = n;
          fend = END;
        } else if (c === 44) {
          fval = text.slice(pos, i);
          pos = i + 1;
          fend = COMMA;
        } else if (c === 10) {
          fval = text.slice(pos, i);
          pos = i + 1;
          line += 1;
          fend = BREAK;
        } else if (text.charCodeAt(i + 1) === 10) {
          fval = text.slice(pos, i);
          pos = i + 2;
          line += 1;
          fend = BREAK;
        } else {
          // Stray CR: dropped, error kept, scan on from after it.
          errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
          let v = text.slice(pos, i);
          pos = i + 1;
          i = pos;
          for (;;) {
            const d = i < n ? text.charCodeAt(i) : -1;
            if (d === 44) {
              v += text.slice(pos, i);
              pos = i + 1;
              fval = v;
              fend = COMMA;
              break;
            }
            if (d === 10) {
              v += text.slice(pos, i);
              pos = i + 1;
              line += 1;
              fval = v;
              fend = BREAK;
              break;
            }
            if (d === 13) {
              if (text.charCodeAt(i + 1) === 10) {
                v += text.slice(pos, i);
                pos = i + 2;
                line += 1;
                fval = v;
                fend = BREAK;
                break;
              }
              errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
              v += text.slice(pos, i);
              pos = i + 1;
              i = pos;
              continue;
            }
            if (d === -1) {
              v += text.slice(pos, n);
              pos = n;
              fval = v;
              fend = END;
              break;
            }
            i += 1;
          }
        }
      }
      fields.push(fval);
    } while (fend === COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !fquoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
