module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Add it in Vercel project settings.' });
    return;
  }

  const { contents } = req.body;

  // Try the fast, high-quota model first; fall back to a second model if it's busy.
  const models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];

  for (let i = 0; i < models.length; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${models[i]}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents }),
          signal: controller.signal
        }
      );
      clearTimeout(timeout);
      const data = await response.json();

      // If this model is overloaded/rate-limited and we have another model to try, retry with it.
      if ((response.status === 429 || response.status === 503) && i < models.length - 1) {
        continue;
      }

      if (response.status === 429) {
        res.status(429).json({ error: { message: 'Lots of people are using Study Buddy right now and the free daily limit was hit. Please try again in a few minutes.' } });
        return;
      }

      res.status(response.status).json(data);
      return;
    } catch (err) {
      clearTimeout(timeout);
      if (i === models.length - 1) {
        if (err.name === 'AbortError') {
          res.status(504).json({ error: { message: 'The AI took too long to respond. Please try again.' } });
        } else {
          res.status(500).json({ error: { message: 'Something went wrong contacting the AI service: ' + err.message } });
        }
        return;
      }
      // otherwise, loop continues to try the next model
    }
  }
};
