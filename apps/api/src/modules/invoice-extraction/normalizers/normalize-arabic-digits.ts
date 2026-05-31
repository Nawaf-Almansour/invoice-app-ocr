export function normalizeArabicDigits(input: string): string {
  const map: Record<string, string> = {
    '\u0660': '0', '\u0661': '1', '\u0662': '2', '\u0663': '3', '\u0664': '4',
    '\u0665': '5', '\u0666': '6', '\u0667': '7', '\u0668': '8', '\u0669': '9',
    '\u06F0': '0', '\u06F1': '1', '\u06F2': '2', '\u06F3': '3', '\u06F4': '4',
    '\u06F5': '5', '\u06F6': '6', '\u06F7': '7', '\u06F8': '8', '\u06F9': '9',
  };
  return input.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (char) => map[char] ?? char);
}
