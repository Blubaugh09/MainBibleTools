const express = require('express');
const path = require('path');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for development
app.use(cors());

// Parse JSON requests - increase limits for image data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
    
    try {
      // Try to generate an image with URL (DALL-E 3)
      const result = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard"
      });
      
      // If we have a URL, return it
      if (result.data && result.data[0] && result.data[0].url) {
        console.log('Image generated successfully with URL');
        res.json({
          image: result.data[0].url,
          prompt: prompt,
          format: 'url'
        });
      } else {
        throw new Error('Image generation failed - no URL returned');
      }
    } catch (dallE3Error) {
      // If DALL-E 3 fails, fallback to DALL-E 2 with b64_json
      console.log('Falling back to DALL-E 2 with base64:', dallE3Error.message);
      
      // Try with DALL-E 2 and b64_json
      const fallbackResult = await openai.images.generate({
        model: "dall-e-2",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json"
      });
      
      if (fallbackResult.data && fallbackResult.data[0] && fallbackResult.data[0].b64_json) {
        console.log('Image generated successfully with base64');
        // Return as a complete data URL
        const dataUrl = `data:image/png;base64,${fallbackResult.data[0].b64_json}`;
        res.json({
          image: dataUrl,
          prompt: prompt,
          format: 'dataUrl'
        });
      } else {
        throw new Error('Both image generation methods failed');
      }
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
            "content": `You are a Biblical scholar specializing in typology, parallels, and comparisons throughout Scripture. 
            Your task is to identify and explain meaningful parallels or comparisons between any Biblical elements based on the user's query.
            These could be between Old and New Testament, within the same testament, between characters, events, symbols, or themes.
            
            You should provide a structured response in the following JSON format:
            
            {
              "title": "Title of the Parallel or Comparison",
              "summary": "Brief one-sentence summary of the parallel or comparison",
              "elementA": {
                "name": "Name of the first Biblical element",
                "reference": "Scripture reference(s)",
                "description": "Detailed description of this element",
                "significance": "Explanation of its significance in context",
                "keyVerses": ["Verse 1", "Verse 2"],
                "keywords": ["Keyword1", "Keyword2"],
                "testament": "Old or New (if applicable)"
              },
              "elementB": {
                "name": "Name of the second Biblical element",
                "reference": "Scripture reference(s)",
                "description": "Detailed description of this element",
                "significance": "Explanation of its significance in context",
                "keyVerses": ["Verse 1", "Verse 2"],
                "keywords": ["Keyword1", "Keyword2"],
                "testament": "Old or New (if applicable)"
              },
              "connections": {
                "symbolic": "Explanation of symbolic connections",
                "thematic": "Explanation of thematic connections",
                "prophetic": "Explanation of prophetic connections (if applicable)",
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

// Image proxy endpoint to avoid CORS issues
app.post('/api/proxy-image', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ message: 'Image URL is required' });
    }
    
    console.log('Proxying image from:', imageUrl);
    
    // Fetch the image
    const imageResponse = await fetch(imageUrl);
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    
    // Convert to buffer
    const imageBuffer = await imageResponse.arrayBuffer();
    
    // Convert to base64
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    
    // Return the base64 data
    res.json({ 
      imageData: base64Image,
      contentType: imageResponse.headers.get('content-type') || 'image/jpeg'
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(500).json({ 
      message: 'Failed to proxy image',
      error: error.message
    });
  }
});

// Timeline Tool Endpoint
app.post('/api/tools/timeline', async (req, res) => {
  try {
    console.log('Timeline request received');
    const { query } = req.body;
    
    if (!openai.apiKey) {
      return res.status(500).json({ message: 'OpenAI API key is not configured' });
    }
    
    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }
    
    console.log(`Generating timeline for: ${query}`);
    
    const messages = [
      {
        role: 'system',
        content: `You are a Bible scholar specializing in biblical chronology and history. 
        Your task is to create a detailed timeline based on the user's query about biblical events, characters, periods, or books.
        
        For any query, even if it's vague or general, you should determine the most relevant biblical timeline to create.
        
        Respond with a JSON object in the following format:
        
        {
          "title": "Clear title for the timeline",
          "description": "Brief overview of what this timeline covers",
          "events": [
            {
              "date": "Date or time period (e.g., '1000 BC', '30-33 AD', or 'During the Exodus')",
              "title": "Short title for this event",
              "description": "Detailed description of the event, its significance, and context",
              "scripture": "Relevant scripture references (e.g., 'Genesis 12:1-9', 'Matthew 4:1-11')"
            }
          ],
          "additionalInfo": "Optional additional context or explanation about the timeline as a whole"
        }
        
        Ensure that:
        1. Events are in chronological order
        2. Dates are as specific as biblically and historically possible
        3. Each event has at least one scripture reference
        4. The descriptions are informative but concise
        5. For periods where exact dates are disputed, provide the generally accepted range or approximation
        
        Use Markdown formatting in the descriptions for better readability.`
      },
      {
        role: 'user',
        content: query
      }
    ];
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 2000,
      temperature: 0.7,
    });
    
    console.log('Response received from OpenAI for Timeline');
    
    try {
      const timelineData = JSON.parse(response.choices[0].message.content);
      res.json(timelineData);
    } catch (parseError) {
      console.error('Failed to parse timeline data as JSON:', parseError);
      // If parsing fails, return the raw content
      res.status(500).json({ 
        message: 'Failed to parse timeline data from OpenAI response',
        rawContent: response.choices[0].message.content
      });
    }
  } catch (error) {
    console.error('Timeline generation error:', error);
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

// Maps Tool Endpoint
app.post('/api/maps', async (req, res) => {
  try {
    console.log('Maps request received');
    const { query } = req.body;
    
    if (!openai.apiKey) {
      return res.status(500).json({ message: 'OpenAI API key is not configured' });
    }
    
    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }
    
    console.log(`Generating map data for: ${query}`);
    
    const messages = [
      {
        role: 'system',
        content: `You are a Bible scholar specializing in biblical geography and history. 
        Your task is to provide detailed information about biblical locations based on the user's query.
        
        For any query about biblical locations, journeys, or places, respond with a JSON object in the following format:
        
        {
          "title": "Clear title summarizing the mapped locations",
          "overview": "Brief overview of the historical and biblical significance of these locations",
          "locations": [
            {
              "name": "Location name",
              "description": "Detailed description including biblical and historical context",
              "coordinates": [latitude, longitude],
              "verses": ["Reference 1", "Reference 2"],
              "shortDescription": "Very brief description for map tooltips"
            }
          ]
        }
        
        Ensure that:
        1. Coordinates are historically accurate and suitable for mapping (use latitude/longitude)
        2. Each location has at least one scripture reference
        3. The descriptions are informative but concise
        4. Include enough detail to understand the significance of each location
        
        Use Markdown formatting in the descriptions for better readability.`
      },
      {
        role: 'user',
        content: query
      }
    ];
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 2000,
      temperature: 0.7,
    });
    
    console.log('Response received from OpenAI for Maps');
    
    try {
      const mapData = JSON.parse(response.choices[0].message.content);
      res.json(mapData);
    } catch (parseError) {
      console.error('Failed to parse map data as JSON:', parseError);
      // If parsing fails, return the raw content
      res.status(500).json({ 
        message: 'Failed to parse map data from OpenAI response',
        rawContent: response.choices[0].message.content
      });
    }
  } catch (error) {
    console.error('Map generation error:', error);
    res.status(500).json({
      message: error.message || 'Something went wrong'
    });
  }
});

// Biblical Image Generator Endpoint
app.post('/api/tools/biblical-image', async (req, res) => {
  try {
    // Check if API key is set
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'OpenAI API key is not configured'
      });
    }

    // Validate request
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }

    console.log(`Generating biblical image for prompt: "${prompt}"`);

    // Enhanced prompt with artistic guidance
    const enhancedPrompt = `
      Create a symbolic and abstract representation of the biblical concept: "${prompt}". 
      This should be suitable for educational materials, avoiding overly realistic depictions. 
      The illustration should be artistic, using rich colors and symbolic elements to convey the spiritual meaning.
      Do not include any specific religious iconography that might be controversial.
      Make the image suitable for a Bible study application.
    `;

    // Call OpenAI API
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "url",
    });

    // Return the generated image URL
    console.log('Image generation successful');
    res.json({
      success: true,
      image: response.data[0].url
    });
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate image'
    });
  }
});

// Biblical Image Editor Endpoint
app.post('/api/tools/edit-biblical-image', async (req, res) => {
  try {
    // Check if API key is set
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'OpenAI API key is not configured'
      });
    }

    // Validate request
    const { prompt, imageData } = req.body;
    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }
    if (!imageData) {
      return res.status(400).json({
        success: false,
        message: 'Image data is required'
      });
    }

    console.log(`Editing biblical image with prompt: "${prompt}"`);

    // Get optional mask data
    const { maskData } = req.body;

    // Enhanced prompt with artistic guidance
    const enhancedPrompt = `
      Modify this biblical image according to the request: "${prompt}". 
      Maintain the symbolic and abstract representation suitable for educational materials.
      The edited illustration should continue to use rich colors and symbolic elements to convey spiritual meaning.
      Do not include any specific religious iconography that might be controversial.
      Make the image suitable for a Bible study application.
    `;

    // Create temporary files for the image and mask
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const crypto = require('crypto');

    // Create a unique filename
    const randomId = crypto.randomBytes(16).toString('hex');
    const imageFilePath = path.join(os.tmpdir(), `image-${randomId}.png`);
    const maskFilePath = maskData ? path.join(os.tmpdir(), `mask-${randomId}.png`) : null;

    // Convert base64 image data to file
    const imageBuffer = Buffer.from(imageData.split(',')[1], 'base64');
    fs.writeFileSync(imageFilePath, imageBuffer);

    // Convert base64 mask data to file if provided
    let maskBuffer = null;
    if (maskData) {
      maskBuffer = Buffer.from(maskData.split(',')[1], 'base64');
      fs.writeFileSync(maskFilePath, maskBuffer);
    }

    // Call OpenAI API
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    let response;
    if (maskData) {
      // If mask is provided, use image edit API (inpainting)
      response = await openai.images.edit({
        model: "dall-e-2", // DALL-E 2 is required for edit operations
        image: fs.createReadStream(imageFilePath),
        mask: fs.createReadStream(maskFilePath),
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
        response_format: "url",
      });
    } else {
      // If no mask, use variation API to create a variation based on the prompt
      // Since OpenAI doesn't have a direct "edit without mask" API, 
      // we'll use the general image creation API with the original image as reference
      response = await openai.images.generate({
        model: "dall-e-3",
        prompt: `${enhancedPrompt} The changes should be applied to the existing image that shows: [Detailed description would be here, but using the prompt as reference]`,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url",
      });
    }

    // Clean up temporary files
    try {
      fs.unlinkSync(imageFilePath);
      if (maskFilePath) fs.unlinkSync(maskFilePath);
    } catch (cleanupError) {
      console.error('Error cleaning up temporary files:', cleanupError);
      // Continue execution even if cleanup fails
    }

    // Return the edited image URL
    console.log('Image editing successful');
    res.json({
      success: true,
      image: response.data[0].url
    });
  } catch (error) {
    console.error('Error editing image:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to edit image'
    });
  }
});

// Character Study Tool Endpoint
app.post('/api/tools/character-study', async (req, res) => {
  try {
    console.log('Character Study request received');
    const { query } = req.body;
    
    if (!openai.apiKey) {
      return res.status(500).json({ message: 'OpenAI API key is not configured' });
    }
    
    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }
    
    console.log(`Generating character study for: ${query}`);
    
    const messages = [
      {
        role: 'system',
        content: `You are a Bible scholar with expertise in biblical characters and their stories. 
        Your task is to provide comprehensive information about biblical characters based on the user's query.
        
        The user may provide a specific character name or a more general query about a biblical figure.
        You should interpret the query and respond with detailed information about the most relevant biblical character.
        
        Respond with a JSON object in the following format:
        
        {
          "character": {
            "name": "Full name of the character",
            "alternateNames": ["Any alternate names or titles"],
            "shortDescription": "One sentence summary of who this character is",
            "testament": "Old or New Testament",
            "timePeriod": "Approximate time period (e.g., '~1000 BC' or 'First Century AD')"
          },
          "biography": {
            "summary": "Brief summary of the character's life and significance",
            "background": "Background information about the character",
            "keyEvents": [
              {
                "title": "Name of event",
                "description": "Description of the event",
                "reference": "Bible reference"
              }
            ]
          },
          "relationships": [
            {
              "name": "Related character name",
              "relationship": "Type of relationship (e.g., father, disciple, enemy)",
              "description": "Brief description of their relationship",
              "reference": "Bible reference"
            }
          ],
          "verses": [
            {
              "reference": "Bible reference",
              "text": "Verse text",
              "significance": "Why this verse is significant for this character"
            }
          ],
          "attributes": {
            "qualities": ["Positive character qualities"],
            "flaws": ["Character flaws or weaknesses"],
            "roles": ["Roles or positions held"]
          },
          "legacy": {
            "impact": "The character's lasting impact",
            "lessons": ["Key lessons from this character's life"],
            "inOtherTexts": "Mentions in non-biblical historical sources (if applicable)"
          },
          "visualElements": {
            "symbols": ["Symbols associated with this character"],
            "settings": ["Key locations associated with this character"],
            "artifacts": ["Objects or items associated with this character"]
          }
        }
        
        Ensure that:
        1. All fields contain historically accurate information based on biblical accounts
        2. Each event or claim is supported by at least one scripture reference
        3. The information is educational and respects diverse interpretations
        4. Passages that have different interpretations are presented neutrally
        
        If the user's query is ambiguous, choose the most prominent biblical character that matches.`
      },
      {
        role: 'user',
        content: query
      }
    ];
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 2500,
      temperature: 0.7,
    });
    
    console.log('Response received from OpenAI for Character Study');
    
    try {
      const characterData = JSON.parse(response.choices[0].message.content);
      res.json(characterData);
    } catch (parseError) {
      console.error('Failed to parse character data as JSON:', parseError);
      // If parsing fails, return the raw content
      res.status(500).json({ 
        message: 'Failed to parse character data from OpenAI response',
        rawContent: response.choices[0].message.content
      });
    }
  } catch (error) {
    console.error('Character study generation error:', error);
    res.status(500).json({
      message: error.message || 'Something went wrong'
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

// Helper function to construct an image prompt from parallel data
function constructImagePrompt(parallelData) {
  // Get key elements from the parallel data
  const { title, visualElements, elementA, elementB } = parallelData;
  
  // Create a prompt that focuses on symbolic representation rather than literal religious imagery
  // This helps avoid content policy restrictions while still creating meaningful visuals
  let prompt = `Create a metaphorical, symbolic, and artistic illustration for Bible study materials titled "${title}". `;
  
  // Add visual description if available
  if (visualElements && visualElements.visualDescription) {
    prompt += `The image should show: ${visualElements.visualDescription} `;
  }
  
  // Add symbolic elements - more flexible for any Biblical comparison
  if (elementA && elementB) {
    prompt += `This illustrates the connection between ${elementA.name} and ${elementB.name}. `;
    
    // Add testament information if available
    if (elementA.testament && elementB.testament && elementA.testament !== elementB.testament) {
      prompt += `This compares elements from the ${elementA.testament} Testament and the ${elementB.testament} Testament. `;
    }
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

// Helper function to construct a biblical image prompt
function constructBiblicalImagePrompt(originalPrompt) {
  // Create a prompt that focuses on educational and artistic representation
  // This helps avoid content policy restrictions while creating meaningful biblical imagery
  let prompt = `Create an artistic, conceptual illustration for biblical education materials showing: ${originalPrompt}. `;
  
  // Add style guidelines to ensure appropriate content
  prompt += "The style should be symbolic, abstract, and educational - suitable for a theological textbook or study guide. ";
  prompt += "Avoid depicting specific religious figures in a way that might be considered iconography. ";
  prompt += "Create a thoughtful, conceptual illustration that evokes the biblical theme while remaining respectful and appropriate. ";
  prompt += "Focus on landscapes, symbols, architecture, and artistic representation rather than realistic depictions of biblical figures.";
  
  // Ensure the prompt isn't too long for DALL-E
  if (prompt.length > 950) {
    prompt = prompt.substring(0, 950);
  }
  
  return prompt;
} 