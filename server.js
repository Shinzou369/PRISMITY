require('dotenv').config();
const express = require("express");
const path = require("path");
const OpenAI = require('openai');
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const app = express();
const port = process.env.PORT || 3000;

// Validate required environment variables
const requiredEnvVars = [
  'OPENAI_API_KEY',
  'GOOGLE_CLIENT_ID', 
  'GOOGLE_CLIENT_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env file or environment configuration');
}

// OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Passport configuration
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://prismity.onrender.com/auth/google/callback"
  //callbackURL: "/auth/google/callback"
},
(accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

app.use(session({
  secret: process.env.SESSION_SECRET || 'prismity-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiry on activity
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax'
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Security and parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.static(path.join(__dirname, "public")));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Chat endpoint with thread and system message support
// Helper function to get API configuration based on model
function getAPIConfig(model) {
  const isDeepSeek = model === "deepseek-chat";
  return {
    apiKey: isDeepSeek ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY,
    apiUrl: isDeepSeek ? "https://api.deepseek.com/v1/chat/completions" : "https://api.openai.com/v1/chat/completions"
  };
}

app.post('/chat', async (req, res) => {
  try {
    const { messages, model, system, thread_id } = req.body;
    const selectedModel = model || "gpt-3.5-turbo";

    // Input validation
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages must be an array' });
    }

    if (messages.length === 0) {
      return res.status(400).json({ error: 'Messages array cannot be empty' });
    }

    // Validate message format
    const invalidMessage = messages.find(msg => 
      !msg.role || !msg.content || typeof msg.content !== 'string'
    );
    
    if (invalidMessage) {
      return res.status(400).json({ error: 'Invalid message format' });
    }

    const finalMessages = [];
    if (system) {
      finalMessages.push({ role: 'system', content: system });
    }
    finalMessages.push(...messages);

    const { apiKey, apiUrl } = getAPIConfig(selectedModel);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: finalMessages,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    // Increment prompt count for authenticated users
    if (req.isAuthenticated()) {
      incrementUserPromptCount(req.user.id);
    }

    res.json({
      message: data.choices[0].message,
      thread_id,
      model: selectedModel
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Error processing your request' });
  }
});

// User storage functions
const fs = require('fs');
const usersFile = 'users.json';
const threadsFile = 'user_threads.json';

function loadUsers() {
  try {
    if (fs.existsSync(usersFile)) {
      return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
  return {};
}

function saveUsers(users) {
  try {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error saving users:', err);
  }
}

function loadUserThreads() {
  try {
    if (fs.existsSync(threadsFile)) {
      return JSON.parse(fs.readFileSync(threadsFile, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading user threads:', err);
  }
  return {};
}

function saveUserThreads(userThreads) {
  try {
    fs.writeFileSync(threadsFile, JSON.stringify(userThreads, null, 2));
  } catch (err) {
    console.error('Error saving user threads:', err);
  }
}

function getUserThreads(userId) {
  const userThreads = loadUserThreads();
  return userThreads[userId] || [];
}

function saveThreadsForUser(userId, threads) {
  const userThreads = loadUserThreads();
  userThreads[userId] = threads;
  saveUserThreads(userThreads);
}

function findUserByEmail(email) {
  const users = loadUsers();
  return Object.values(users).find(user => user.email === email);
}

function saveUser(userData) {
  const users = loadUsers();
  users[userData.googleId] = userData;
  saveUsers(users);
}

// Google OAuth routes with proper account selection
app.get("/auth/google",
  passport.authenticate("google", { 
    scope: ["profile", "email"],
    prompt: 'select_account'
  })
);

// Separate signup route with forced account selection
app.get("/auth/google/signup",
  passport.authenticate("google", { 
    scope: ["profile", "email"],
    prompt: 'select_account consent'
  })
);

// Separate login route with account selection
app.get("/auth/google/login",
  passport.authenticate("google", { 
    scope: ["profile", "email"],
    prompt: 'select_account'
  })
);

app.get("/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login-failed"
  }),
  (req, res) => {
    if (req.user) {
      const userEmail = req.user.emails?.[0]?.value;
      const existingUser = findUserByEmail(userEmail);
      
      // Check if this was a signup or login request
      const authIntent = req.session.authIntent || 'login';
      
      // Clear the auth intent after use
      delete req.session.authIntent;
      
      if (authIntent === 'signup') {
        if (existingUser) {
          // User already exists, show option to login instead
          return res.redirect('/account-exists');
        } else {
          // New user, redirect to complete signup
          return res.redirect('/complete-signup');
        }
      } else {
        // Login flow
        if (existingUser) {
          return res.redirect('/confirm-login');
        } else {
          // No account exists, redirect to signup
          return res.redirect('/no-account');
        }
      }
    }
    res.redirect('/login-failed');
  }
);

// Set auth intent and clear any existing session
app.get('/set-auth-intent/:type', (req, res) => {
  // Clear any existing authentication
  req.logout(() => {
    req.session.destroy((err) => {
      // Create new session with auth intent
      req.session = req.sessionStore.createSession(req, {});
      req.session.authIntent = req.params.type;
      
      if (req.params.type === 'signup') {
        res.redirect('/auth/google/signup');
      } else {
        res.redirect('/auth/google/login');
      }
    });
  });
});

app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});

// API endpoint to get user profile data
app.get("/api/profile", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  // First check session for user data, then fallback to saved data
  let userData = req.user.savedUserData;
  if (!userData) {
    const userEmail = req.user.emails?.[0]?.value;
    userData = findUserByEmail(userEmail);
  }
  
  res.json({
    name: req.user.displayName,
    email: req.user.emails?.[0]?.value,
    picture: req.user.photos?.[0]?.value,
    id: req.user.id,
    preferredFirstName: userData?.preferredFirstName || req.user.preferredFirstName || null,
    preferredLastName: userData?.preferredLastName || req.user.preferredLastName || null,
    isComplete: userData?.isComplete || req.user.isComplete || false
  });
});

// Check authentication status endpoint
app.get("/api/auth/status", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.json({ authenticated: false, user: null });
  }
  
  // First check session for user data, then fallback to saved data
  let userData = req.user.savedUserData;
  if (!userData) {
    const userEmail = req.user.emails?.[0]?.value;
    userData = findUserByEmail(userEmail);
  }
  
  const userResponse = {
    name: req.user.displayName,
    email: req.user.emails?.[0]?.value,
    picture: req.user.photos?.[0]?.value,
    preferredFirstName: userData?.preferredFirstName || req.user.preferredFirstName || null,
    preferredLastName: userData?.preferredLastName || req.user.preferredLastName || null,
    isComplete: userData?.isComplete || req.user.isComplete || false
  };
  
  res.json({ 
    authenticated: true,
    user: userResponse
  });
});

// Token usage management
const tokenUsageFile = 'token_usage.json';

function loadTokenUsage() {
  try {
    if (fs.existsSync(tokenUsageFile)) {
      return JSON.parse(fs.readFileSync(tokenUsageFile, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading token usage:', err);
  }
  return {};
}

function saveTokenUsage(tokenUsage) {
  try {
    fs.writeFileSync(tokenUsageFile, JSON.stringify(tokenUsage, null, 2));
  } catch (err) {
    console.error('Error saving token usage:', err);
  }
}

function getUserTokenUsage(userId) {
  const tokenUsage = loadTokenUsage();
  return tokenUsage[userId] || { tokens: 0, prompts: 0 };
}

function updateUserTokenUsage(userId, usage) {
  const tokenUsage = loadTokenUsage();
  tokenUsage[userId] = usage;
  saveTokenUsage(tokenUsage);
}

function incrementUserPromptCount(userId) {
  const tokenUsage = loadTokenUsage();
  const currentUsage = tokenUsage[userId] || { tokens: 0, prompts: 0 };
  currentUsage.prompts = (currentUsage.prompts || 0) + 1;
  tokenUsage[userId] = currentUsage;
  saveTokenUsage(tokenUsage);
}

// Token usage API endpoints
app.get("/api/token-usage", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  const userId = req.user.id;
  const usage = getUserTokenUsage(userId);
  
  // Handle both old format (number) and new format (object)
  if (typeof usage === 'number') {
    res.json({ usage: { tokens: usage, prompts: 0 } });
  } else {
    res.json({ usage });
  }
});

app.post("/api/token-usage", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  const userId = req.user.id;
  const { usage } = req.body;
  
  updateUserTokenUsage(userId, usage);
  res.json({ success: true, usage });
});

app.post("/api/token-usage/increment", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  const userId = req.user.id;
  const currentUsage = getUserTokenUsage(userId);
  
  // Handle both old format (number) and new format (object)
  let newUsage;
  if (typeof currentUsage === 'number') {
    newUsage = { tokens: currentUsage + 1, prompts: 0 };
  } else {
    newUsage = { 
      tokens: (currentUsage.tokens || 0) + 1, 
      prompts: currentUsage.prompts || 0 
    };
  }
  
  updateUserTokenUsage(userId, newUsage);
  res.json({ success: true, usage: newUsage });
});

app.post("/api/token-usage/increment-prompt", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  const userId = req.user.id;
  incrementUserPromptCount(userId);
  const currentUsage = getUserTokenUsage(userId);
  
  res.json({ success: true, usage: currentUsage });
});

// Thread management API endpoints
app.get("/api/threads", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  const userId = req.user.id;
  const threads = getUserThreads(userId);
  res.json({ threads });
});

app.post("/api/threads", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  const userId = req.user.id;
  const { threads } = req.body;
  
  if (!Array.isArray(threads)) {
    return res.status(400).json({ error: "Threads must be an array" });
  }
  
  saveThreadsForUser(userId, threads);
  res.json({ success: true });
});

app.delete("/api/threads/:threadId", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  const userId = req.user.id;
  const threadId = parseInt(req.params.threadId);
  
  let threads = getUserThreads(userId);
  threads = threads.filter(thread => thread.id !== threadId);
  
  saveThreadsForUser(userId, threads);
  res.json({ success: true });
});

// Complete signup route
app.post("/api/complete-signup", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { firstName, lastName } = req.body;
  if (!firstName || !lastName) {
    return res.status(400).json({ error: "First name and last name are required" });
  }

  const userData = {
    googleId: req.user.id,
    email: req.user.emails?.[0]?.value,
    googleName: req.user.displayName,
    profilePicture: req.user.photos?.[0]?.value,
    preferredFirstName: firstName,
    preferredLastName: lastName,
    createdAt: new Date().toISOString(),
    isComplete: true
  };

  // Save user data to persistent storage
  saveUser(userData);
  
  // Update the session user object with complete profile data
  req.user.preferredFirstName = firstName;
  req.user.preferredLastName = lastName;
  req.user.isComplete = true;
  req.user.savedUserData = userData;
  
  // Ensure session is marked as modified to trigger save
  req.session.passport.user = req.user;
  
  // Force session save before responding
  req.session.save((err) => {
    if (err) {
      console.error('Session save error:', err);
      return res.status(500).json({ error: "Session save failed" });
    }
    
    console.log('✅ New User Signup:', {
      name: `${firstName} ${lastName}`,
      email: userData.email,
      id: userData.googleId,
      timestamp: userData.createdAt
    });

    res.json({ 
      success: true, 
      message: "Signup completed successfully",
      user: {
        name: `${firstName} ${lastName}`,
        email: userData.email,
        picture: userData.profilePicture,
        preferredFirstName: firstName,
        preferredLastName: lastName,
        isComplete: true
      }
    });
  });
});

// Confirm login route
app.post("/api/confirm-login", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const userEmail = req.user.emails?.[0]?.value;
  const existingUser = findUserByEmail(userEmail);

  if (!existingUser) {
    return res.status(404).json({ error: "User not found" });
  }

  // Load user data into session for consistent access
  req.user.preferredFirstName = existingUser.preferredFirstName;
  req.user.preferredLastName = existingUser.preferredLastName;
  req.user.isComplete = existingUser.isComplete;
  req.user.savedUserData = existingUser;

  console.log('✅ User Login:', {
    name: `${existingUser.preferredFirstName} ${existingUser.preferredLastName}`,
    email: existingUser.email,
    id: existingUser.googleId,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, message: "Login confirmed" });
});

// Serve signup and login pages
app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

app.get("/complete-signup", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/signup");
  }
  res.sendFile(path.join(__dirname, "public", "complete-signup.html"));
});

app.get("/confirm-login", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/signup");
  }
  res.sendFile(path.join(__dirname, "public", "confirm-login.html"));
});

// Account exists route (for signup attempts with existing accounts)
app.get("/account-exists", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/signup");
  }
  res.sendFile(path.join(__dirname, "public", "account-exists.html"));
});

// No account route (for login attempts without accounts)
app.get("/no-account", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }
  res.sendFile(path.join(__dirname, "public", "no-account.html"));
});

// Login failed route
app.get("/login-failed", (req, res) => {
  res.redirect("/?error=auth_failed");
});

// Serve login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Serve the frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Serve token dashboard
app.get("/token-dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "token-dashboard.html"));
});

// Model configuration endpoints
const modelConfigFile = 'model_config.json';

app.post('/save-model-config', (req, res) => {
  try {
    const fs = require('fs');
    fs.writeFileSync(modelConfigFile, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving model config:', error);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

app.get('/model-config', (req, res) => {
  try {
    const fs = require('fs');
    if (fs.existsSync(modelConfigFile)) {
      const config = JSON.parse(fs.readFileSync(modelConfigFile, 'utf8'));
      res.json(config);
    } else {
      res.json({
        model_triggers: {
          "gpt-4-turbo": ["complex", "detailed", "thorough", "comprehensive", "advanced"],
          "gpt-4": ["longer", "extensive", "elaborate", "in-depth", "complete"],
          "gpt-3.5-turbo": ["quick", "simple", "basic", "fast", "brief"],
          "deepseek-chat": ["deeper", "creative", "deep", "innovative", "alternative"]
        },
        default_model: "gpt-3.5-turbo"
      });
    }
  } catch (error) {
    console.error('Error loading model config:', error);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});
