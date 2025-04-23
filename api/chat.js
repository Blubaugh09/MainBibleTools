// This is a serverless function that will be deployed to handle OpenAI API requests
// The API key is kept secure on the server side
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    // Get API key from environment variable (server-side only)
    const apiKey = process.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ message: 'API key not configured' });
    }

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
      throw new Error(data.error?.message || 'Error from OpenAI API');
    }

    return res.status(200).json({ message: data.choices[0].message.content });
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    return res.status(500).json({ message: 'Failed to communicate with AI service' });
  }
} 