// Vercel Serverless Function for OpenAI Analysis
// API key is stored in Vercel environment variable: OPENAI_API_KEY

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    try {
        const { data } = req.body;

        if (!data) {
            return res.status(400).json({ error: 'No data provided' });
        }

        // Build the analysis prompt from the data
        const prompt = buildPrompt(data);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful pediatric health assistant analyzing care tracking data for a child with food sensitivities. Provide brief, actionable insights in 2-3 sentences. Focus on patterns between food types and digestive/sleep outcomes. Use emojis sparingly for readability.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 200,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('OpenAI API error:', error);
            return res.status(response.status).json({ error: 'OpenAI API error' });
        }

        const result = await response.json();
        const insight = result.choices?.[0]?.message?.content || 'No insights available.';

        return res.status(200).json({ insight });

    } catch (error) {
        console.error('Analysis error:', error);
        return res.status(500).json({ error: 'Analysis failed' });
    }
}

function buildPrompt(data) {
    // Summarize data for the AI
    const foodCounts = {};
    const foodPotty = {};
    const foodSleep = {};

    data.forEach(day => {
        const food = day.food;
        foodCounts[food] = (foodCounts[food] || 0) + 1;

        if (!foodPotty[food]) foodPotty[food] = { good: 0, soft: 0, wet: 0 };
        foodPotty[food].good += day.potty.good;
        foodPotty[food].soft += day.potty.soft;
        foodPotty[food].wet += day.potty.wet;

        if (!foodSleep[food]) foodSleep[food] = { good: 0, bad: 0 };
        if (day.sleep === 'good') foodSleep[food].good++;
        if (day.sleep === 'bad') foodSleep[food].bad++;
    });

    let prompt = `Analyze this ${data.length}-day care tracking summary for a child:\n\n`;

    Object.keys(foodCounts).forEach(food => {
        prompt += `${food} Day (${foodCounts[food]} days):\n`;
        prompt += `  - Potty: ${foodPotty[food].good} good, ${foodPotty[food].soft} soft, ${foodPotty[food].wet} wet\n`;
        prompt += `  - Sleep: ${foodSleep[food].good} good nights, ${foodSleep[food].bad} bad nights\n`;
    });

    // Include recent notes
    const recentNotes = data.filter(d => d.notes).slice(0, 5).map(d => `${d.date}: ${d.notes}`);
    if (recentNotes.length > 0) {
        prompt += `\nRecent notes:\n${recentNotes.join('\n')}`;
    }

    prompt += '\n\nProvide 2-3 brief insights about patterns you notice. Focus on correlations between food types and outcomes.';

    return prompt;
}
