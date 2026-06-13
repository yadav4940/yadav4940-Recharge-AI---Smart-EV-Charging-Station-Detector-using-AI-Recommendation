# RechargeAI ⚡

RechargeAI is a premium, smart EV charging assistant, trip planner, and booking platform tailored for the Indian EV market. Designed with a Tesla-inspired dark aesthetic, glassmorphism UI, and vivid cyan/green accents, it provides EV drivers with real-time station discovery, automated trip routing, slot booking, and personalized AI assistance.

---

## 🌟 Key Features

### 🗺️ Live Map & Station Discovery
- **Leaflet & OpenStreetMap Integration**: Seamless interactive map featuring custom SVG markers for different charger types (Fast, Slow, AC, DC).
- **Mappls & OpenChargeMap API Data**: Direct integration displaying public charging stations across India, paired with quick-actions for major Indian cities.
- **30s Auto-Refresh**: Always up-to-date status indicators for charger availability.
- **Station Details Modal**: Comprehensive info panel including charger specifications, real-time load progress, and direct Google Maps navigation shortcuts.

### 🛣️ Smart Trip Planner
- **Intelligent Route Optimization**: Greedy selection route planning algorithm that places optimal charging stops along your route.
- **Battery Safety Guard**: Configured with an automated 10% battery safety margin to ensure you never run out of juice.
- **Dynamic Station Suggestions**: Automatically recommends the best charging hubs based on real-time vehicle battery state and compatibility.

### 📅 Seamless Slot Booking
- **External Station Compatibility**: Supports smart virtual-registration for OpenChargeMap or Mappls stations seamlessly behind the scenes, making every map point bookable.
- **Partner Bookings**: Real-time reservation flow for registered partner hubs, securing charging slots instantly.

### 🤖 AI Recommendations & Chatbot
- **Gemini-powered Chatbot**: Built-in conversational agent integrated via Supabase Edge Functions, offering EV maintenance tips, charging recommendations, and app support.
- **Top 5 Station Ranking**: Smart AI ranking system highlighting the top 5 closest, fastest, and most compatible stations matching your EV profile.

### 🚗 EV Specs & Registration
- **Detailed 2-Step Registration**: Personalized onboarding flow to collect vehicle make, model, battery capacity, connector type, and charging specifications.
- **Dynamic Stats Dashboard**: Real-time driving stats, remaining range estimators, and vehicle health insights matching your registered vehicle.
- **Profile Management**: Fast inline-editing to update personal info, billing preferences, and EV specifications on the fly.

### 🎨 Immersive UX & Tech Details
- **Tesla-Inspired Aesthetic**: Modern glassmorphic interfaces, beautiful neon glowing states, and responsive dark/light theme options.
- **High-Fidelity Loading Screen**: Immersive SVG loading animation accompanied by high-quality synthesizer audio using the Web Audio API.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite 5, TypeScript 5, Tailwind CSS v3, Framer Motion, Leaflet
- **Backend & Database**: Supabase (Auth, Database, Realtime Sync, Storage, Edge Functions)
- **AI Integration**: Google Gemini-3 via Supabase Edge Functions
- **Mapping APIs**: Leaflet, OSM, Mappls API, OpenChargeMap API

---

## 🚀 Getting Started

### Local Development

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add your Supabase connection strings:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Start development server:**
   ```sh
   npm run dev
   ```

### Database & Backend Setup

Database schemas, Row-Level Security (RLS) rules, functions, and real-time triggers are fully orchestrated via Supabase migrations. 

To deploy any newly added edge functions:
```sh
supabase functions deploy auth-email-hook
```

### 👨‍💻 Developer

**Rohit Yadav**

MCA Student | Data Analyst | Data Science Enthusiast

### Skills
- Python
- SQL
- Power BI
- Excel
- Machine Learning
- Data Visualization

### Connect With Me
- LinkedIn: https://www.linkedin.com/in/rohit-yadav-845203290/
- GitHub: https://github.com/yadav4940
- Email: rohitbharatyadav@gmail.com