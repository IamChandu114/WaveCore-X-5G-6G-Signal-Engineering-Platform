export function getEncodingPreview(message, bitsPerSymbol) {
  if (!Number.isInteger(bitsPerSymbol) || bitsPerSymbol < 1) {
    throw new RangeError("bitsPerSymbol must be a positive integer");
  }

  const characters = Array.from(message);
  const visibleCharacters = characters.slice(0, 10);
  const bytes = Array.from(new TextEncoder().encode(visibleCharacters.join("")));
  const bitStream = bytes.map((byte) => byte.toString(2).padStart(8, "0")).join("");
  const symbols = Array.from({ length: Math.ceil(bitStream.length / bitsPerSymbol) }, (_, index) =>
    bitStream.slice(index * bitsPerSymbol, (index + 1) * bitsPerSymbol).padEnd(bitsPerSymbol, "0"),
  );

  return { characters, visibleCharacters, bytes, symbols };
}
