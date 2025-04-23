const express = require('express');
const path = require('path');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for development
app.use(cors());

// Parse JSON requests
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// Initialize OpenAI with API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env: {
      apiKeySet: !!process.env.OPENAI_API_KEY
    }
  });
});

// Regular Chat Endpoint (GPT-3.5)
app.post('/api/chat', async (req, res) => {
  try {
    console.log('Regular chat request received');
    const { messages } = req.body;
    
    if (!openai.apiKey) {
      return res.status(500).json({ message: 'OpenAI API key is not configured' });
    }
    
    console.log(`Processing ${messages.length} messages`);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    });
    
    console.log('Response received from OpenAI');
    
    res.json({
      message: response.choices[0].message.content,
      metadata: {
        model: 'gpt-3.5-turbo',
        usage: response.usage,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      message: error.message || 'Something went wrong',
      error: true
    });
  }
});

// Advanced Chat Endpoint (GPT-4o-mini)
app.post('/api/chat/advanced', async (req, res) => {
  try {
    console.log('Advanced chat request received');
    const { messages } = req.body;
    
    if (!openai.apiKey) {
      return res.status(500).json({ message: 'OpenAI API key is not configured' });
    }
    
    console.log(`Processing ${messages.length} messages`);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 800,
      temperature: 0.7,
    });
    
    console.log('Response received from OpenAI for advanced chat');
    
    res.json({
      message: response.choices[0].message.content,
      metadata: {
        model: 'gpt-4o-mini',
        usage: response.usage,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Advanced chat error:', error);
    res.status(500).json({
      message: error.message || 'Something went wrong',
      error: true
    });
  }
});

// Bible Commentary Tool Endpoint
app.post('/api/tools/bible-commentary', async (req, res) => {
  try {
    console.log('Bible Commentary request received');
    const { book, chapter } = req.body;
    
    if (!openai.apiKey) {
      return res.status(500).json({ message: 'OpenAI API key is not configured' });
    }
    
    console.log(`Generating commentary for ${book} ${chapter}`);
    
    const messages = [
      {
        role: 'system',
        content: `You are a Bible scholar and theological expert. Provide an in-depth commentary on Bible chapters with historical context, 
        theological analysis, and practical applications. Use markdown formatting for clear section headers. Include information about key 
        figures, themes, connections to other chapters, and historical background where relevant. Your commentary should be educational, 
        respectful of diverse interpretations, and spiritually insightful.
        
        Structure your response with these sections (using markdown headers):
        1. ## Historical Context
        2. ## Key Themes
        3. ## Verse-by-Verse Analysis (if relevant)
        4. ## Theological Significance
        5. ## Practical Applications
        
        Always cite other relevant Bible verses using proper references, such as "John 3:16" or "Genesis 1:1".`
      },
      {
        role: 'user',
        content: `Please provide a detailed commentary on ${book} chapter ${chapter}. Include historical context, key verses, themes, 
        and interpretations. Make sure to structure your response with clear sections using markdown.`
      }
    ];
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 1200,
      temperature: 0.6,
    });
    
    console.log('Response received from OpenAI for Bible Commentary');
    
    // Extract key verses using regex
    const versePattern = /(\d+):(\d+(?:-\d+)?)/g;
    const content = response.choices[0].message.content;
    let match;
    const keyVerses = [];
    
    while ((match = versePattern.exec(content)) !== null) {
      keyVerses.push(match[0]);
    }
    
    // Extract sections
    const sections = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('## ')) {
        sections.push({
          title: line.replace('## ', ''),
          level: 2
        });
      } else if (line.startsWith('### ')) {
        sections.push({
          title: line.replace('### ', ''),
          level: 3
        });
      }
    }
    
    res.json({
      commentary: content,
      book,
      chapter,
      keyVerses: [...new Set(keyVerses)], // Remove duplicates
      sections,
      metadata: {
        model: 'gpt-4o-mini',
        usage: response.usage,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Bible Commentary error:', error);
    res.status(500).json({
      message: error.message || 'Something went wrong',
      error: true
    });
  }
});

// Verse Analyzer Tool Endpoint
app.post('/api/tools/verse-analyzer', async (req, res) => {
  try {
    console.log('Verse Analyzer request received');
    const { verse } = req.body;
    
    if (!openai.apiKey) {
      return res.status(500).json({ message: 'OpenAI API key is not configured' });
    }
    
    console.log(`Analyzing verse: ${verse}`);
    
    const messages = [
      {
        role: 'system',
        content: `You are a Bible scholar specializing in detailed verse analysis. Provide comprehensive analysis of Bible verses 
        with linguistic insights, cultural context, theological meaning, and practical applications. Structure your response with 
        clear sections using markdown formatting. Your analysis should be educational, insightful, and respectful of various 
        interpretations. If given a reference without the verse text, try to recall the verse content first, then analyze it.
        
        Structure your response with these sections (using markdown headers):
        1. ## Verse Text (if not provided, include the text of the reference)
        2. ## Original Language Insights
        3. ## Historical and Cultural Context
        4. ## Theological Meaning
        5. ## Related Passages (make sure to cite these as proper references, such as "John 3:16" or "Genesis 1:1")
        6. ## Practical Application
        
        Always cite other relevant Bible verses using proper references.`
      },
      {
        role: 'user',
        content: `Please analyze this Bible verse or reference: "${verse}". If this is just a reference without the full verse, 
        please include the verse text first. Then provide detailed analysis including: original language insights if relevant, 
        historical/cultural context, theological significance, connections to other passages, and practical applications. 
        Structure your response with clear markdown formatting.`
      }
    ];
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 1000,
      temperature: 0.6,
    });
    
    console.log('Response received from OpenAI for Verse Analyzer');
    
    const content = response.choices[0].message.content;
    
    // Extract related verse references
    const verseRefPattern = /([1-3]?(?:\s?[A-Za-z]+))\s+(\d+):(\d+(?:-\d+)?)/g;
    let match;
    const relatedVerses = [];
    
    while ((match = verseRefPattern.exec(content)) !== null) {
      relatedVerses.push(match[0]);
    }
    
    // Extract sections
    const sections = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('## ')) {
        sections.push({
          title: line.replace('## ', ''),
          level: 2
        });
      } else if (line.startsWith('### ')) {
        sections.push({
          title: line.replace('### ', ''),
          level: 3
        });
      }
    }
    
    res.json({
      analysis: content,
      verse,
      relatedVerses: [...new Set(relatedVerses)], // Remove duplicates
      sections,
      metadata: {
        model: 'gpt-4o-mini',
        usage: response.usage,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Verse Analyzer error:', error);
    res.status(500).json({
      message: error.message || 'Something went wrong',
      error: true
    });
  }
});

// Handle SPA routing in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/api/health`);
  console.log(`OpenAI API key set: ${!!process.env.OPENAI_API_KEY}`);
}); 