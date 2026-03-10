# DayTracker 👶

A mobile-first daily care dashboard for Kid, tracking food rotation, medicines, schedule, and health.

## 🌐 Live Demo

Deployed on Vercel: [Your Vercel URL]

## Features

- **🍽️ Food Rotation** - 4-day rotation diet with full ingredient list
- **💊 Medicine Tracking** - AM/PM/Evening doses with tap-to-mark
- **📅 Schedule** - Weekday/weekend schedules with school, bus, nanny times
- **📝 Potty Tracker** - Log bowel movements with notes for issues
- **☁️ Cloud Sync** - Supabase integration for multi-device sync

## Tech Stack

- Vanilla HTML/CSS/JavaScript
- Supabase for cloud storage & real-time sync
- Mobile-first responsive design

## 🚀 Quick Start

### Local Development

```bash
# Clone the repo
git clone https://github.com/seav-labs-ai/daytracker.git
cd daytracker

# Start a local server
npx serve
```

### Supabase Setup (for cloud sync)

1. Create a project at [supabase.com](https://supabase.com)

2. Run the SQL schema in the SQL Editor:
   - Open `supabase-schema.sql`
   - Copy and paste into Supabase SQL Editor
   - Click "Run"

3. Get your credentials:
   - Go to Project Settings → API
   - Copy `Project URL` and `anon public` key

4. Update `supabase.js`:
   ```javascript
   const SUPABASE_URL = 'your-project-url';
   const SUPABASE_ANON_KEY = 'your-anon-key';
   ```

5. Deploy to Vercel (it will auto-deploy on push)

## 📊 Database Schema

| Table | Purpose |
|-------|---------|
| `medicine_status` | Tracks which medicines were given each day |
| `medicines` | Custom medicine configurations per day |
| `bowel_movements` | Daily potty log entries |
| `settings` | User preferences (bus times, nanny hours) |

## 🍽️ Food Rotation Reference

| Day | Protein | Starch | Fat | Milk | Fruit | Vegetable | Cook Starch | Sugar |
|-----|---------|--------|-----|------|-------|-----------|-------------|-------|
| 1 | Chicken | Sweet Potato | Coconut Oil | Coconut Milk | Watermelon/Honeydew | Cauliflower | Arrowroot | Coconut Sugar |
| 2 | Beef | Plantain | Beef Tallow | Rice Milk | Banana/Citrus | Peas/Tomato | Rice Flour | Maple Syrup |
| 3 | Turkey | Potato/Pumpkin | Avocado Oil | Oat Milk | Strawberry/Blueberry | Zucchini | Potato Starch | Honey |
| 4 | Pork | Cassava | Olive Oil | Cashew Milk | Apple/Pear | Carrot | Tapioca | Agave |

Rotation calculated from anchor date (Dec 3, 2025 = Day 4).

## 📁 Project Structure

```
daytracker/
├── index.html          # Main app
├── styles.css          # Styling
├── app.js              # UI logic
├── data.js             # Food rotation data
├── utils.js            # Helper functions + localStorage
├── supabase.js         # Cloud sync integration
├── supabase-schema.sql # Database setup script
└── README.md           # This file
```

## 🔮 Future Enhancements

- [ ] Push notifications for medicines
- [ ] Google Calendar integration
- [ ] History analytics & charts
- [ ] Photo attachments
- [ ] Multiple child support

---
Built with ❤️ for Kid
