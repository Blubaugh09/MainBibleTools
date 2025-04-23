const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('Health check endpoint called');
  return res.status(200).json({ 
    status: 'ok', 
    message: 'Server is running',
    env: {
      apiKeySet: !!process.env.VITE_OPENAI_API_KEY
    }
  });
});

// OpenAI Chat API endpoint - gpt-3.5-turbo for public access
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    // Get API key from environment variable (server-side only)
    const apiKey = process.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('API key is not configured');
      return res.status(500).json({ message: 'API key not configured' });
    }
    
    console.log('Processing chat request with messages:', messages.length);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 500
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('OpenAI API error:', data.error);
      throw new Error(data.error?.message || 'Error from OpenAI API');
    }

    console.log('Received response from OpenAI');
    return res.status(200).json({ message: data.choices[0].message.content });
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    return res.status(500).json({ message: 'Failed to communicate with AI service' });
  }
});

// OpenAI Chat API endpoint - 4o-mini model for authenticated users
app.post('/api/chat/advanced', async (req, res) => {
  try {
    const { messages } = req.body;

    // Get API key from environment variable (server-side only)
    const apiKey = process.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('API key is not configured');
      return res.status(500).json({ message: 'API key not configured' });
    }
    
    console.log('Processing advanced chat request with messages:', messages.length);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 800,
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('OpenAI API error:', data.error);
      throw new Error(data.error?.message || 'Error from OpenAI API');
    }

    console.log('Received advanced response from OpenAI');
    return res.status(200).json({ message: data.choices[0].message.content });
  } catch (error) {
    console.error('Error calling OpenAI advanced API:', error);
    return res.status(500).json({ message: 'Failed to communicate with advanced AI service' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/api/health`);
  console.log(`OpenAI API key set: ${!!process.env.VITE_OPENAI_API_KEY}`);
}); 