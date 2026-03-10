// ============================================
// User Dashboard - Shared Data
// ============================================

// Food Rotation Data 
const FOOD_DAYS = [
    {
        id: 1,
        name: 'Menu A: Standard',
        shortName: 'Menu A',
        emoji: '🍽️',
        color: '#4CAF50',
        bgGradient: 'linear-gradient(135deg, #4CAF50 0%, #81C784 100%)',
        categories: {
            Protein: 'Chicken',
            Carb: 'Rice',
            Vegetable: 'Broccoli',
            Fruit: 'Apple',
            Beverage: 'Water'
        },
        meals: {
            Breakfast: "Oatmeal and Fruit",
            "Snack AM": "Apple Slices",
            Lunch: "Chicken and Rice Bowl",
            "Snack PM": "Trail Mix",
            Dinner: "Grilled Chicken Salad"
        },
        allowedFoods: ['chicken', 'rice', 'broccoli', 'apple', 'oatmeal']
    },
    {
        id: 2,
        name: 'Menu B: Vegetarian',
        shortName: 'Menu B',
        emoji: '🥗',
        color: '#FFC107',
        bgGradient: 'linear-gradient(135deg, #FFC107 0%, #FFD54F 100%)',
        categories: {
            Protein: 'Tofu',
            Carb: 'Quinoa',
            Vegetable: 'Spinach',
            Fruit: 'Banana',
            Beverage: 'Tea'
        },
        meals: {
            Breakfast: "Smoothie Bowl",
            "Snack AM": "Banana",
            Lunch: "Quinoa Salad",
            "Snack PM": "Yogurt",
            Dinner: "Tofu Stir-fry"
        },
        allowedFoods: ['tofu', 'quinoa', 'spinach', 'banana', 'yogurt']
    },
    {
        id: 3,
        name: 'Menu C: Mediterranean',
        shortName: 'Menu C',
        emoji: '🥙',
        color: '#9C27B0',
        bgGradient: 'linear-gradient(135deg, #9C27B0 0%, #BA68C8 100%)',
        categories: {
            Protein: 'Fish',
            Carb: 'Couscous',
            Vegetable: 'Tomato & Cucumber',
            Fruit: 'Grapes',
            Beverage: 'Sparkling Water'
        },
        meals: {
            Breakfast: "Greek Yogurt",
            "Snack AM": "Grapes",
            Lunch: "Mediterranean Wrap",
            "Snack PM": "Hummus & Carrots",
            Dinner: "Baked Fish with Couscous"
        },
        allowedFoods: ['fish', 'couscous', 'tomato', 'cucumber', 'grapes']
    },
    {
        id: 4,
        name: 'Menu D: Low-Carb',
        shortName: 'Menu D',
        emoji: '🥩',
        color: '#2196F3',
        bgGradient: 'linear-gradient(135deg, #2196F3 0%, #64B5F6 100%)',
        categories: {
            Protein: 'Beef',
            Carb: 'Cauliflower Rice',
            Vegetable: 'Asparagus',
            Fruit: 'Berries',
            Beverage: 'Water'
        },
        meals: {
            Breakfast: "Eggs & Bacon",
            "Snack AM": "Berries",
            Lunch: "Steak Salad",
            "Snack PM": "Almonds",
            Dinner: "Beef and Asparagus"
        },
        allowedFoods: ['beef', 'cauliflower', 'asparagus', 'berries', 'eggs']
    }
];

// Default Medicines (Generic schedule)
const DEFAULT_MEDICINES = {
    am: [
        { id: 'vitamin-c', name: 'Vitamin C + Multi-vitamin', dose: '1 pill + 5ml', icon: '💊' },
        { id: 'probiotic', name: 'Daily Probiotic', dose: '1 pack (with milk)', icon: '💊' },
        { id: 'allergy-med', name: 'Allergy Medicine', dose: '', icon: '🩹' }
    ],
    pm: [
        { id: 'allergy-med-pm', name: 'Allergy Medicine', dose: '2:00 PM', icon: '🩹' },
        { id: 'iron-supplement', name: 'Iron Supplement', dose: '2:00 PM', icon: '💊' }
    ],
    evening: [
        { id: 'iron-eve', name: 'Iron Supplement', dose: '6:00 PM', icon: '💊' },
        { id: 'evening-supps', name: 'Calcium + Magnesium + Zinc', dose: '1/2 scoop + 1/4 scoop + 1/2 pill', icon: '💊' },
        { id: 'melatonin', name: 'Melatonin', dose: 'as needed', icon: '😴' }
    ]
};

// Schedule Templates
const SCHEDULE_TEMPLATES = {
    weekday: [
        { id: 'wake', time: '07:00', label: 'Wake Up', icon: '🌅', type: 'routine' },
        { id: 'breakfast', time: '07:30', label: 'Breakfast', icon: '🍳', type: 'meal' },
        { id: 'am-meds', time: '08:00', label: 'AM Medicines', icon: '💊', type: 'medicine' },
        { id: 'commute', time: '08:30', label: 'Morning Commute', icon: '🚗', type: 'transport' },
        { id: 'work-start', time: '09:00', label: 'Work/School Starts', icon: '🏢', type: 'school' },
        { id: 'lunch', time: '12:00', label: 'Lunch', icon: '🥗', type: 'meal' },
        { id: 'commute-home', time: '17:00', label: 'Evening Commute', icon: '🚗', type: 'transport' },
        { id: 'dinner', time: '18:30', label: 'Dinner', icon: '🍽️', type: 'meal' },
        { id: 'evening-meds', time: '19:30', label: 'Evening Medicines', icon: '💊', type: 'medicine' },
        { id: 'bedtime', time: '22:00', label: 'Bedtime', icon: '🌙', type: 'routine' }
    ],
    weekend: [
        { id: 'wake', time: '08:00', label: 'Wake Up', icon: '🌅', type: 'routine' },
        { id: 'breakfast', time: '08:30', label: 'Breakfast', icon: '🍳', type: 'meal' },
        { id: 'am-meds', time: '09:00', label: 'AM Medicines', icon: '💊', type: 'medicine' },
        { id: 'lunch', time: '12:30', label: 'Lunch', icon: '🥗', type: 'meal' },
        { id: 'dinner', time: '18:00', label: 'Dinner', icon: '🍽️', type: 'meal' },
        { id: 'evening-meds', time: '19:30', label: 'Evening Medicines', icon: '💊', type: 'medicine' },
        { id: 'bedtime', time: '23:00', label: 'Bedtime', icon: '🌙', type: 'routine' }
    ]
};

// Log Options (Generic)
const BOWEL_TYPES = [
    { id: 'normal', label: 'Normal', emoji: '✅', color: '#4CAF50' },
    { id: 'irregular', label: 'Irregular', emoji: '⚠️', color: '#FF9800' },
    { id: 'issue', label: 'Issue', emoji: '❌', color: '#F44336' }
];

// Sleep Quality Options
const SLEEP_TYPES = [
    { id: 'good', label: 'Good', emoji: '😴', color: '#4CAF50' },
    { id: 'bad', label: 'Bad', emoji: '😫', color: '#F44336' }
];

// Behavior Tags
const BEHAVIOR_CATEGORIES = [
    {
        id: 'energy',
        name: 'Energy Levels',
        tags: [
            { id: 'high', label: 'High Energy' },
            { id: 'normal', label: 'Normal Energy', ideal: true },
            { id: 'low', label: 'Low Energy' },
            { id: 'exhausted', label: 'Exhausted' }
        ]
    },
    {
        id: 'mood',
        name: 'Daily Mood',
        tags: [
            { id: 'happy', label: 'Happy', ideal: true },
            { id: 'neutral', label: 'Neutral' },
            { id: 'stressed', label: 'Stressed' },
            { id: 'anxious', label: 'Anxious' }
        ]
    },
    {
        id: 'social',
        name: 'Social Interactions',
        tags: [
            { id: 'talkative', label: 'Talkative', ideal: true },
            { id: 'quiet', label: 'Quiet' },
            { id: 'collaborative', label: 'Collaborative', ideal: true },
            { id: 'isolated', label: 'Isolated' }
        ]
    },
    {
        id: 'focus',
        name: 'Focus & Productivity',
        tags: [
            { id: 'focused', label: 'Highly Focused', ideal: true },
            { id: 'distracted', label: 'Distracted' },
            { id: 'productive', label: 'Productive', ideal: true },
            { id: 'unmotivated', label: 'Unmotivated' }
        ]
    }
];

if (typeof window !== 'undefined') {
    window.DEMO_DATA = {
        FOOD_DAYS,
        DEFAULT_MEDICINES,
        SCHEDULE_TEMPLATES,
        BOWEL_TYPES,
        SLEEP_TYPES,
        BEHAVIOR_CATEGORIES
    };
}
