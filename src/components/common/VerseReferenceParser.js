/**
 * Utility functions for parsing Bible verse references in text
 */

// Enhanced regular expression to match more Bible verse patterns
// Handles virtually all common Bible verse reference formats
const VERSE_REGEX = /\b((?:[1-3](?:\s|\s?)[A-Za-z]+(?:\s[A-Za-z]+)?)|(?:[A-Za-z]+(?:\s[A-Za-z]+)?))\s+(\d+)(?::(\d+)(?:-(\d+))?)?(?:,\s*(?:\d+)(?:-\d+)?)*\b/g;

// Alternative approach with multiple targeted patterns
const PATTERNS = [
  // Standard formats: John 3:16, Genesis 1:1-10
  /\b([A-Za-z]+(?:\s[A-Za-z]+)?)\s+(\d+):(\d+)(?:-(\d+))?\b/g,
  
  // Books with numbers: 1 John 1:1, 2 Corinthians 5:17
  /\b([1-3]\s[A-Za-z]+(?:\s[A-Za-z]+)?)\s+(\d+):(\d+)(?:-(\d+))?\b/g,
  
  // Chapter only: John 3, Genesis 1
  /\b([A-Za-z]+(?:\s[A-Za-z]+)?)\s+(\d+)\b(?!\s*:)/g,
  
  // Chapter only with numbered books: 1 John 3, 2 Kings 4
  /\b([1-3]\s[A-Za-z]+(?:\s[A-Za-z]+)?)\s+(\d+)\b(?!\s*:)/g,
  
  // Comma-separated verses: John 3:16,18,20-22
  /\b([A-Za-z]+(?:\s[A-Za-z]+)?)\s+(\d+):(\d+)(?:,(\d+))*(?:-(\d+))?\b/g,
  
  // Verse ranges with hyphens: John 3:16-19, Genesis 1:1-10
  /\b([A-Za-z]+(?:\s[A-Za-z]+)?)\s+(\d+):(\d+)-(\d+)\b/g,
  
  // Verse ranges with hyphens for numbered books: 1 John 3:16-19
  /\b([1-3]\s[A-Za-z]+(?:\s[A-Za-z]+)?)\s+(\d+):(\d+)-(\d+)\b/g
];

/**
 * Extract verse references from a string of text
 * @param {string} text - Text to search for Bible verse references
 * @returns {string[]} - Array of unique verse references
 */
export const extractVerseReferences = (text) => {
  if (!text) return [];
  
  const references = new Set();
  
  // Clean the text - ensure punctuation doesn't interfere with verse detection
  // Remove punctuation that might appear after verse references but keep hyphens and colons
  const cleanedText = text.replace(/([^\w\s:,-])/g, ' $1 ');
  
  // Method 1: Using main regex with comprehensive parsing
  const matches = Array.from(cleanedText.matchAll(new RegExp(VERSE_REGEX, 'g')));
  
  for (const match of matches) {
    const fullMatch = match[0];
    let book = match[1]?.trim();
    let chapter = match[2]?.trim();
    
    // Skip if book or chapter is missing
    if (!book || !chapter) continue;
    
    // Handle specific verse reference (John 3:16)
    if (match[3]) {
      const verse = match[3];
      const endVerse = match[4];
      
      if (endVerse) {
        references.add(`${book} ${chapter}:${verse}-${endVerse}`);
      } else {
        references.add(`${book} ${chapter}:${verse}`);
      }
    } 
    // Handle chapter-only reference (John 3)
    else {
      references.add(`${book} ${chapter}`);
    }
    
    // Handle comma-separated verses
    if (fullMatch.includes(',')) {
      try {
        const parts = fullMatch.split(',');
        const firstPart = parts[0];
        
        // Extract book and chapter from first part
        const bookChapterMatch = firstPart.match(/^(.+?)\s+(\d+)(?::(\d+))?/);
        if (bookChapterMatch) {
          const [, extractedBook, extractedChapter] = bookChapterMatch;
          
          // Process remaining parts
          for (let i = 1; i < parts.length; i++) {
            let part = parts[i].trim();
            
            // Handle verse ranges (e.g., "18-20")
            if (part.includes('-')) {
              const [startVerse, endVerse] = part.split('-');
              references.add(`${extractedBook} ${extractedChapter}:${startVerse}-${endVerse}`);
            } 
            // Handle single verses (e.g., "18")
            else if (/^\d+$/.test(part)) {
              references.add(`${extractedBook} ${extractedChapter}:${part}`);
            }
          }
        }
      } catch (e) {
        console.error('Error parsing comma-separated verses', e);
      }
    }
  }
  
  // Method 2: Also use targeted patterns to catch edge cases
  for (const pattern of PATTERNS) {
    const patternMatches = Array.from(cleanedText.matchAll(new RegExp(pattern, 'g')));
    
    for (const match of patternMatches) {
      if (pattern.toString().includes('(?!\\s*:)')) {
        // Chapter-only pattern
        references.add(`${match[1]} ${match[2]}`);
      } else if (pattern.toString().includes(':(\\d+)-(\\d+)')) {
        // Explicit verse range pattern
        const endVerseIndex = pattern.toString().includes('([1-3]\\s[A-Za-z]+') ? 4 : 4;
        references.add(`${match[1]} ${match[2]}:${match[3]}-${match[endVerseIndex]}`);
      } else if (match[4] && !isNaN(match[4])) {
        // Verse range from main patterns
        references.add(`${match[1]} ${match[2]}:${match[3]}-${match[4]}`);
      } else if (match[3]) {
        // Single verse
        references.add(`${match[1]} ${match[2]}:${match[3]}`);
      }
    }
  }
  
  return Array.from(references);
};

/**
 * Check if a text contains any Bible verse references
 * @param {string} text - Text to check
 * @returns {boolean} - True if text contains verse references
 */
export const containsVerseReferences = (text) => {
  if (!text) return false;
  
  // Clean the text similar to extract function
  const cleanedText = text.replace(/([^\w\s:,-])/g, ' $1 ');
  
  // Check with main regex
  if (new RegExp(VERSE_REGEX, 'g').test(cleanedText)) {
    return true;
  }
  
  // Also check with each pattern
  for (const pattern of PATTERNS) {
    if (new RegExp(pattern, 'g').test(cleanedText)) {
      return true;
    }
  }
  
  return false;
};

export default {
  extractVerseReferences,
  containsVerseReferences
}; 