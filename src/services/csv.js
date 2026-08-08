export function csvEscape(value) {
  let str = String(value ?? '');
  // Planilhas interpretam estes prefixos como fórmula. O apóstrofo mantém
  // o conteúdo como texto e evita CSV injection ao abrir o arquivo.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  if (/[",\n;]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}
