/**
 * Utility functions for parsing Bible verse references in text
 */

// Enhanced regular expression to match more Bible verse patterns
// Handles:
// - John 1:1
// - Genesis 1:1-10
// - 1 Corinthians 13:4-7
// - Romans 8:28, 38-39
// - Revelation 21:3-4, 6-8
// - Book names with spaces and numbers (1 John, 2 Peter)
const VERSE_REGEX = /\b((?:[1-3]\s)?[A-Za-z]+(?:\s[A-Za-z]+)?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?(?:,\s*(\d+)(?:-(\d+))?)*\b/g;

/**
 * Extract verse references from a string of text
 * @param {string} text - Text to search for Bible verse references
 * @returns {string[]} - Array of unique verse references
 */
export const extractVerseReferences = (text) => {
  if (!text) return [];
  
  // Create a copy of the regex to reset lastIndex
  const regex = new RegExp(VERSE_REGEX);
  const matches = Array.from(text.matchAll(regex));
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
    
    // Handle comma-separated verses like "John 3:16, 18, 20-22"
    const fullMatch = match[0];
    if (fullMatch.includes(',')) {
      const parts = fullMatch.split(',');
      if (parts.length > 1) {
        // Already handled the first part above
        const [book, chapter] = parts[0].match(/^((?:[1-3]\s)?[A-Za-z]+(?:\s[A-Za-z]+)?)\s+(\d+)/).slice(1, 3);
        
        // Handle additional comma-separated verses
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i].trim();
          if (part.includes(':')) {
            // Handle "chapter:verse" format in subsequent parts
            const [chapterVerse, verseRange] = part.split(':');
            if (verseRange) {
              if (verseRange.includes('-')) {
                const [startVerse, endVerse] = verseRange.split('-');
                references.push(`${book} ${chapterVerse}:${startVerse}-${endVerse}`);
              } else {
                references.push(`${book} ${chapterVerse}:${verseRange}`);
              }
            }
          } else if (part.includes('-')) {
            // Handle verse ranges like "18-20"
            const [startVerse, endVerse] = part.split('-');
            references.push(`${book} ${chapter}:${startVerse}-${endVerse}`);
          } else {
            // Handle single verses like "18"
            references.push(`${book} ${chapter}:${part}`);
          }
        }
      }
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
  
  // Create a copy of the regex to reset lastIndex
  const regex = new RegExp(VERSE_REGEX);
  return regex.test(text);
};

export default {
  extractVerseReferences,
  containsVerseReferences
}; 