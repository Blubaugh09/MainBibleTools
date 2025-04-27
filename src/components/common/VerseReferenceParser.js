/**
 * Utility functions for parsing Bible verse references in text
 */

// Regular expression to match common Bible verse patterns
// Matches patterns like:
// - John 3:16
// - Genesis 1:1-10
// - 1 Corinthians 13:4-7
// - Romans 8:28, 38-39
const VERSE_REGEX = /\b((?:[1-3]\s)?[A-Za-z]+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?(?:,\s*(\d+)(?:-(\d+))?)*\b/g;

/**
 * Extract verse references from a string of text
 * @param {string} text - Text to search for Bible verse references
 * @returns {string[]} - Array of unique verse references
 */
export const extractVerseReferences = (text) => {
  if (!text) return [];
  
  const matches = Array.from(text.matchAll(VERSE_REGEX));
  const references = [];
  
  for (const match of matches) {
    // Basic reference like "John 3:16"
    if (match[1] && match[2] && match[3]) {
      const book = match[1];
      const chapter = match[2];
      const verse = match[3];
      const endVerse = match[4]; // For ranges like "John 3:16-18"
      
      if (endVerse) {
        references.push(`${book} ${chapter}:${verse}-${endVerse}`);
      } else {
        references.push(`${book} ${chapter}:${verse}`);
      }
    } else if (match[1] && match[2]) {
      // Chapter reference like "John 3"
      references.push(`${match[1]} ${match[2]}`);
    }
  }
  
  // Return unique references
  return [...new Set(references)];
};

/**
 * Check if a text contains any Bible verse references
 * @param {string} text - Text to check
 * @returns {boolean} - True if text contains verse references
 */
export const containsVerseReferences = (text) => {
  if (!text) return false;
  return VERSE_REGEX.test(text);
};

export default {
  extractVerseReferences,
  containsVerseReferences
}; 