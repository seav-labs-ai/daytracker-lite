// Vercel Serverless Function: Today's Food Rotation
// Endpoint: GET /api/today
// Used by Home Assistant to get current food day

// Food rotation data
const FOOD_DAYS = [
    { id: 1, menu: 'A', emoji: '🍽️' },
    { id: 2, menu: 'B', emoji: '🥗' },
    { id: 3, menu: 'C', emoji: '🥙' },
    { id: 4, menu: 'D', emoji: '🥩' }
];

// Reference date: December 30, 2025 = Menu A
const REFERENCE_DATE = new Date('2025-12-30T00:00:00');

function getDayRotation(date) {
    const refDate = new Date(REFERENCE_DATE);
    refDate.setHours(0, 0, 0, 0);

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - refDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    // 4-day rotation starting from Day 1
    let dayIndex = (diffDays % 4);
    if (dayIndex < 0) dayIndex += 4;

    return dayIndex + 1;
}

export default async function handler(req, res) {
    // Set CORS headers for Home Assistant
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        let dayId = null;
        let overrideActive = false;

        // Check for manual override in Supabase settings (using fetch, no SDK needed)
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
            try {
                const response = await fetch(
                    `${supabaseUrl}/rest/v1/settings?id=eq.default&select=config`,
                    {
                        headers: {
                            'apikey': supabaseKey,
                            'Authorization': `Bearer ${supabaseKey}`
                        }
                    }
                );

                if (response.ok) {
                    const data = await response.json();
                    if (data?.[0]?.config?.current_day_override) {
                        const override = parseInt(data[0].config.current_day_override, 10);
                        if (override >= 1 && override <= 4) {
                            dayId = override;
                            overrideActive = true;
                        }
                    }
                }
            } catch (dbError) {
                console.error('Supabase check failed:', dbError.message);
            }
        }

        // Calculate from rotation if no override
        if (!dayId) {
            const now = new Date();
            dayId = getDayRotation(now);
        }

        const food = FOOD_DAYS.find(f => f.id === dayId);

        if (!food) {
            return res.status(500).json({ error: 'Invalid day calculation' });
        }

        // Response for Home Assistant
        const response = {
            day: food.id,
            protein: food.protein,
            emoji: food.emoji,
            milk: food.milk,
            label: `Day ${food.id} - ${food.protein}`,
            override_active: overrideActive,
            timestamp: new Date().toISOString()
        };

        return res.status(200).json(response);

    } catch (error) {
        console.error('Today API error:', error);
        return res.status(500).json({ error: 'Failed to get today\'s food' });
    }
}
