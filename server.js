const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors()); // Allows your Vercel frontend to connect smoothly

// In-memory key-value store using GitHub username as unique key to prevent duplicates
let talentPool = {};

/**
 * POST /api/talent/register
 * Enforces uniqueness and aggregates telemetry from GitHub API
 */
app.post('/api/talent/register', async (req, res) => {
  try {
    const { name, email, city, country, lat, lng, githubUsername, skills } = req.body;
    const cleanUsername = githubUsername.trim().toLowerCase();

    // Default placeholder metrics in case GitHub API fails or blocks us
    let publicRepos = 0;
    let topLanguages = ["HTML/CSS"];

    // Wrap GitHub API calls in a safety net to prevent server crashes
    try {
      const githubResponse = await axios.get(`https://api.github.com/users/${cleanUsername}`, {
        headers: { 'User-Agent': 'Kwancho-Talent-App' }
      });
      publicRepos = githubResponse.data.public_repos || 0;

      const reposData = await axios.get(`https://api.github.com/users/${cleanUsername}/repos`, {
        headers: { 'User-Agent': 'Kwancho-Talent-App' }
      });
      
      if (Array.isArray(reposData.data)) {
        // Complete the logic that got cut off, filtering out null/empty languages safely
        topLanguages = [...new Set(reposData.data.map(repo => repo.language).filter(Boolean))];
      }
    } catch (gitError) {
      console.warn(`[WARNING] GitHub data fetch bypassed for ${cleanUsername}:`, gitError.message);
      // Keeps going even if GitHub is angry at our IP address
    }

    // Combine everything into a single passport record
    const newPassport = {
      _id: cleanUsername + Date.now(), // Generate a unique ID fallback string
      name,
      email,
      location: { city, country, lat: parseFloat(lat), lng: parseFloat(lng) },
      githubUsername: cleanUsername,
      skills: Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim()),
      metrics: {
        publicRepos,
        topLanguages: topLanguages.length > 0 ? topLanguages : ["Vanilla stack"]
      }
    };

    // Save into our storage dictionary
    talentPool[cleanUsername] = newPassport;

    // Send success confirmation back to React frontend
    return res.status(201).json({ success: true, message: "Passport minted!", data: newPassport });

  } catch (err) {
    console.error("Critical registration endpoint error:", err);
    return res.status(500).json({ error: "Internal processing error" });
  }
});

/**
 * GET /api/talent/
 * Delivers array mapping to frontend's live telemetry dynamic state engine
 */
app.get('/api/talent', (req, res) => {
  return res.json(Object.values(talentPool));
});

// System Status landing root check for Render health monitoring
app.get('/', (req, res) => {
  res.json({ status: "online", system: "Kwancho Core API Active" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`[SYSTEM] Gateway deployed running on port ${PORT}`));