module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: { message: 'Server is missing GEMINI_API_KEY. Add it in Vercel project settings.' } });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const { contents } = req.body;

    if (!contents) {
      clearTimeout(timeout);
      res.status(400).json({ error: { message: 'Missing "contents" in request body.' } });
      return;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
        signal: controller.signal
      }
    );

    clearTimeout(timeout);
    const data = await response.json();

    if (response.status === 429) {
      res.status(429).json({
        error: {
          message: 'Lots of people are using Study Buddy right now and the free daily limit was hit. Please try again in a few minutes.'
        }
      });
      return;
    }

    if (!response.ok) {
      res.status(response.status).json({
        error: {
          message: (data.error && data.error.message) || 'The AI service returned an error.'
        }
      });
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      res.status(504).json({ error: { message: 'The AI took too long to respond. Please try again.' } });
    } else {
      res.status(500).json({ error: { message: 'Something went wrong contacting the AI service: ' + err.message } });
    }
  }
};
