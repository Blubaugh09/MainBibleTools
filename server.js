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

// Generate Parallel Image Endpoint
app.post('/api/tools/generate-parallel-image', async (req, res) => {
  try {
    console.log('Parallel Image Generation request received');
    const { parallelData } = req.body;
    
    if (!openai.apiKey) {
      return res.status(500).json({ message: 'OpenAI API key is not configured' });
    }
    
    if (!parallelData) {
      return res.status(400).json({ message: 'Parallel data is required' });
    }
    
    // Construct a prompt for image generation that is appropriate and educational
    const prompt = constructImagePrompt(parallelData);
    console.log('Generated image prompt:', prompt);
    
    // Call OpenAI to generate the image
    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt,
      response_format: "b64_json",
      size: "1024x1024",
      quality: "standard"
    });
    
    // Send back the base64-encoded image
    if (result.data && result.data[0] && result.data[0].b64_json) {
      console.log('Image generated successfully');
      res.json({
        image: result.data[0].b64_json,
        prompt: prompt
      });
    } else {
      throw new Error('Image generation failed');
    }
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({
      message: error.message || 'Image generation failed'
    });
  }
});

// Visual Parallels Tool
app.post('/api/tools/visual-parallels', async (req, res) => {
  const { query } = req.body;

  if (!process.env.OPENAI_API_KEY) {
    console.log('API key not configured');
    return res.status(500).json({ message: 'API key not configured on the server' });
  }

  if (!query) {
    return res.status(400).json({ message: 'Query is required' });
  }

  try {
    console.log(`Received visual parallel request for: ${query}`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            "role": "system",
            "content": `You are a Biblical scholar specializing in typology and parallels between the Old and New Testament. 
            Your task is to identify and explain parallels between the Old and New Testament based on the user's query.
            You should provide a structured response in the following JSON format:
            
            {
              "title": "Title of the Parallel",
              "summary": "Brief one-sentence summary of the parallel",
              "oldTestament": {
                "name": "Name of the Old Testament element",
                "reference": "Scripture reference(s)",
                "description": "Detailed description of the Old Testament element",
                "significance": "Explanation of its significance in the Old Testament context",
                "keyVerses": ["Verse 1", "Verse 2"],
                "keywords": ["Keyword1", "Keyword2"]
              },
              "newTestament": {
                "name": "Name of the New Testament element",
                "reference": "Scripture reference(s)",
                "description": "Detailed description of the New Testament element",
                "significance": "Explanation of its significance in the New Testament context",
                "keyVerses": ["Verse 1", "Verse 2"],
                "keywords": ["Keyword1", "Keyword2"]
              },
              "connections": {
                "symbolic": "Explanation of symbolic connections",
                "thematic": "Explanation of thematic connections",
                "prophetic": "Explanation of prophetic connections",
                "theological": "Explanation of theological connections"
              },
              "visualElements": {
                "color": "A color theme that symbolically represents this parallel",
                "symbol": "A symbolic object or image that represents this parallel",
                "visualDescription": "A detailed description of how this parallel could be visually represented"
              }
            }
            
            Use Markdown formatting in the description, significance, and connections fields. Ensure your response is valid JSON.`
          },
          {
            "role": "user",
            "content": query
          }
        ],
        temperature: 0.7,
        max_tokens: 2500
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
      return res.status(response.status).json({ 
        message: 'Error generating visual parallel',
        error: errorData
      });
    }

    const data = await response.json();
    console.log('OpenAI response received');
    
    let parallelData;
    try {
      parallelData = JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error('Error parsing JSON from OpenAI:', error);
      return res.status(500).json({ 
        message: 'Error processing the response',
        error: 'Invalid JSON received from OpenAI'
      });
    }
    
    res.json(parallelData);
  } catch (error) {
    console.error('Error in visual parallels endpoint:', error);
    res.status(500).json({ message: 'An error occurred while generating the visual parallel' });
  }
});

// Image Generation for Visual Parallels
app.post('/api/tools/generate-parallel-image', async (req, res) => {
  const { parallelData } = req.body;

  if (!process.env.OPENAI_API_KEY) {
    console.log('API key not configured');
    return res.status(500).json({ message: 'API key not configured on the server' });
  }

  if (!parallelData) {
    return res.status(400).json({ message: 'Parallel data is required' });
  }

  try {
    console.log(`Generating image for parallel: ${parallelData.title}`);
    
    // Construct a prompt that won't trigger content restrictions
    const prompt = constructImagePrompt(parallelData);
    
    console.log('Using image prompt:', prompt);
    
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: prompt,
        n: 1,
        response_format: "b64_json",
        size: "1024x1024",
        quality: "standard"
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
      return res.status(response.status).json({ 
        message: 'Error generating image',
        error: errorData
      });
    }

    const data = await response.json();
    console.log('Image generation successful');
    
    // Send back the base64-encoded image
    res.json({
      image: data.data[0].b64_json,
      prompt: prompt
    });
  } catch (error) {
    console.error('Error in image generation endpoint:', error);
    res.status(500).json({ message: 'An error occurred while generating the image' });
  }
});

// Helper function to construct an image prompt from parallel data
function constructImagePrompt(parallelData) {
  // Get key elements from the parallel data
  const { title, visualElements, oldTestament, newTestament } = parallelData;
  
  // Create a prompt that focuses on symbolic representation rather than literal religious imagery
  // This helps avoid content policy restrictions while still creating meaningful visuals
  let prompt = `Create a metaphorical, symbolic, and artistic illustration for Bible study materials titled "${title}". `;
  
  // Add visual description if available
  if (visualElements && visualElements.visualDescription) {
    prompt += `The image should show: ${visualElements.visualDescription} `;
  }
  
  // Add symbolic elements
  if (oldTestament && newTestament) {
    prompt += `This illustrates the connection between ${oldTestament.name} from the Old Testament and ${newTestament.name} from the New Testament. `;
  }
  
  // Add color theme
  if (visualElements && visualElements.color) {
    prompt += `Use a color palette based on ${visualElements.color}. `;
  }
  
  // Add symbolic object
  if (visualElements && visualElements.symbol) {
    prompt += `Incorporate the symbol of ${visualElements.symbol} in a creative way. `;
  }
  
  // Add style guidelines to ensure appropriate content
  prompt += "The style should be symbolic, abstract, and educational - suitable for a theological textbook or study guide. Avoid depicting specific religious figures or scenes that might be considered iconography. Create a thoughtful, conceptual illustration that evokes the theme while remaining respectful and appropriate.";
  
  return prompt;
}

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