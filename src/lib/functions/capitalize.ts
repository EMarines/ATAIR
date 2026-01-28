/**
 * Capitalizes each word in a string.
 * For example: "ricardo enrique" becomes "Ricardo Enrique"
 * @param text The string to capitalize
 * @returns The capitalized string
 */
export function capitalize(text: string) {
  if (!text) return '';
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}