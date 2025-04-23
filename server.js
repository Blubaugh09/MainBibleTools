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
      message: response.choices[0].message.content
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      message: error.message || 'Something went wrong'
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
      message: response.choices[0].message.content
    });
  } catch (error) {
    console.error('Advanced chat error:', error);
    res.status(500).json({
      message: error.message || 'Something went wrong'
    });
  }
});

// Visual Parallels Tool Endpoint
app.post('/api/tools/visual-parallels', async (req, res) => {
  try {
    console.log('Visual Parallels request received');
    const { query } = req.body;
    
    if (!openai.apiKey) {
      return res.status(500).json({ message: 'OpenAI API key is not configured' });
    }
    
    console.log(`Generating visual parallels for query: ${query}`);
    
    const systemPrompt = `You are a Bible scholar specializing in comparing Old and New Testament themes, symbols, and concepts.
    
    Analyze the user's query, which may be about biblical parallels, typology, or thematic connections. Even if they don't explicitly mention Old and New Testament elements, identify the most relevant comparison to make.
    
    Your task is to provide a structured JSON response that will be used to create a visual side-by-side comparison.
    
    The response must be valid JSON with the following structure and MUST follow this EXACT format:
    {
      "title": "A concise title describing the parallel",
      "summary": "A brief explanation of the connection between the Old and New Testament elements",
      "oldTestament": {
        "name": "Name of the Old Testament element (person, event, symbol, etc.)",
        "reference": "Primary biblical reference (e.g., 'Genesis 22:1-18')",
        "description": "Detailed description of the Old Testament element",
        "significance": "Theological/historical significance within the Old Testament context",
        "keyVerses": ["Verse 1", "Verse 2", "Verse 3"],
        "keywords": ["keyword1", "keyword2", "keyword3"]
      },
      "newTestament": {
        "name": "Name of the New Testament element (person, event, symbol, etc.)",
        "reference": "Primary biblical reference (e.g., 'John 3:16')",
        "description": "Detailed description of the New Testament element",
        "significance": "Theological significance and fulfillment aspects",
        "keyVerses": ["Verse 1", "Verse 2", "Verse 3"],
        "keywords": ["keyword1", "keyword2", "keyword3"]
      },
      "connections": {
        "symbolic": "Explanation of symbolic parallels",
        "thematic": "Explanation of thematic parallels",
        "prophetic": "Explanation of prophetic fulfillment (if applicable)",
        "theological": "Shared theological principles"
      },
      "visualElements": {
        "color": "A suggested color theme (e.g., 'blue-red', 'purple-gold')",
        "symbol": "A suggested symbol representing this parallel (e.g., 'lamb', 'temple', 'crown')",
        "visualDescription": "Brief description of how to visually represent this parallel"
      }
    }

    Ensure your JSON is properly formatted and valid. Focus on making accurate, theologically sound connections.`;
    
    const userPrompt = `Please analyze this request and provide a visual parallel between Old and New Testament elements: "${query}"`;
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1500,
      temperature: 0.7,
      response_format: { type: "json_object" }
    });
    
    console.log('Response received from OpenAI for Visual Parallels');
    
    // Parse the response to ensure it's valid JSON
    let parallelData;
    try {
      parallelData = JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      // If parsing fails, return the raw text
      return res.status(500).json({
        message: "Failed to generate proper JSON format. Please try a different query."
      });
    }
    
    res.json(parallelData);
    
  } catch (error) {
    console.error('Visual Parallels error:', error);
    res.status(500).json({
      message: error.message || 'Something went wrong'
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
        respectful of diverse interpretations, and spiritually insightful.`
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
    
    res.json({
      commentary: response.choices[0].message.content
    });
  } catch (error) {
    console.error('Bible Commentary error:', error);
    res.status(500).json({
      message: error.message || 'Something went wrong'
    });
  }
});

// Verse Analyzer Tool Endpoint
app.post('/api/tools/verse-analyzer', async (req, res) => {
  try {
    // Check if OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ message: "OpenAI API key is not configured" });
    }

    const { verse, conversationHistory } = req.body;
    
    // Validate input
    if (!verse) {
      return res.status(400).json({ message: "Verse is required" });
    }

    console.log('Analyzing verse:', verse);
    
    let messages = [];
    
    // If there's conversation history, use it
    if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      messages = [
        {
          role: 'system',
          content: `You are a Bible scholar specializing in detailed verse analysis. 
          Provide helpful, insightful information about Bible verses, their meanings, historical context, 
          and applications. Use markdown formatting for clear sections.
          
          The user has submitted this verse or reference for analysis: "${verse}"
          
          Now they are asking a follow-up question. Provide a helpful, educational response.`
        },
        ...conversationHistory
      ];
    } else {
      // Default system prompt for initial analysis
      messages = [
        {
          role: 'system',
          content: `You are a Bible scholar specializing in detailed verse analysis. 
          Provide helpful, insightful information about Bible verses, their meanings, historical context, 
          and applications. Use markdown formatting for clear sections.
          
          For each verse analyzed, include:
          
          1. **Translation Check**: If a full verse is given, verify it against common translations (KJV, NIV, ESV, etc.) or identify the translation if possible. If only a reference is given, provide the verse from a common translation.
          
          2. **Historical Context**: Explain when and why this verse was written, including author, audience, and setting.
          
          3. **Literary Context**: Explain how this verse fits into the surrounding passages and the broader biblical narrative.
          
          4. **Key Terms**: Identify and explain important words, phrases, or concepts, especially those that have specific meanings in the original languages.
          
          5. **Theological Significance**: Explain the key biblical truths or principles illustrated in this verse.
          
          6. **Interpretive Issues**: Note if there are different understandings of this verse among scholars or denominations.
          
          7. **Application**: Suggest how this verse might be applied to contemporary life.
          
          8. **Related Verses**: Provide 2-3 related verses that shed additional light on this passage.
          
          When a user submits a verse or reference, provide a detailed analysis following this structure.
          Format your response with clear markdown headings and concise, insightful content under each section.`
        },
        {
          role: 'user',
          content: `Analyze this verse: ${verse}`
        }
      ];
    }
    
    // Call OpenAI API for chat completion
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000
    });

    // Extract response
    const analysisText = completion.choices[0].message.content;
    
    console.log('Sending analysis response');
    
    // Send successful response
    res.json({ 
      analysis: analysisText
    });
    
  } catch (error) {
    console.error('Error in verse analyzer API:', error);
    res.status(500).json({ 
      message: `Error processing verse analysis: ${error.message}` 
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