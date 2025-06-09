// Authentication helper functions
async function checkAuthStatus() {
  try {
    const response = await fetch('/api/auth/status');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking auth status:', error);
    return { authenticated: false, user: null };
  }
}

async function getUserProfile() {
  try {
    const response = await fetch('/api/profile');
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

function initiateGoogleLogin() {
  window.location.href = '/auth/google';
}

function logout() {
  // Clear user data before redirecting
  if (typeof clearUserData !== 'undefined') {
    clearUserData();
  }
  window.location.href = '/logout';
}

// Check auth status on page load
document.addEventListener('DOMContentLoaded', async () => {
  const authStatus = await checkAuthStatus();

  if (authStatus.authenticated) {
    // User is logged in - show main interface
    console.log('User logged in:', authStatus.user);
    // Update UI to show user info
    updateUIForLoggedInUser(authStatus.user);
  } else {
    // User not logged in - show login option
    console.log('User not logged in');
    showLoginOption();
  }
});

async function updateUIForLoggedInUser(user) {
  // Set global login state
  if (typeof isUserLoggedIn !== 'undefined') {
    isUserLoggedIn = true;
  }

  // Load user's threads from server
  if (typeof loadUserThreads !== 'undefined') {
    await loadUserThreads();
  }

  // Update top navigation with user info
  updateTopNavForUser(user);

  // Personalize hero title
  personalizeHeroTitle(user);

  // Remove any existing login prompts
  const existingLoginBtn = document.querySelector('.auth-placeholder');
  if (existingLoginBtn) {
    existingLoginBtn.remove();
  }

  // Hide login modal if it's showing
  if (typeof hideLoginModal !== 'undefined') {
    hideLoginModal();
  }

  // Update UI with user's data
  if (typeof updateUI !== 'undefined') {
    updateUI();
  }
}

function showLoginOption() {
  // Set global login state
  if (typeof isUserLoggedIn !== 'undefined') {
    isUserLoggedIn = false;
  }

  // Clear user data
  if (typeof clearUserData !== 'undefined') {
    clearUserData();
  }

  // Update top navigation for non-authenticated user
  updateTopNavForGuest();

  // Show generic hero title
  showGenericHeroTitle();

  // Update UI to show empty state
  if (typeof updateUI !== 'undefined') {
    updateUI();
  }
}

function updateTopNavForUser(user) {
  const navRight = document.querySelector('.nav-right');

  // Remove existing auth elements
  const existingAuth = navRight.querySelector('.auth-container');
  if (existingAuth) {
    existingAuth.remove();
  }

  // Create user info container
  const authContainer = document.createElement('div');
  authContainer.className = 'auth-container';
  authContainer.innerHTML = `
    <div class="user-profile">
      <div class="user-avatar">
        ${user.picture ? `<img src="${user.picture}" alt="${user.name}" class="avatar-img">` : '👤'}
      </div>
      <span class="user-name">${user.name}</span>
      <button class="logout-btn" onclick="logout()">Logout</button>
    </div>
  `;

  // Insert before existing nav items
  const firstChild = navRight.firstChild;
  navRight.insertBefore(authContainer, firstChild);
}

function updateTopNavForGuest() {
  const navRight = document.querySelector('.nav-right');

  // Remove existing auth elements
  const existingAuth = navRight.querySelector('.auth-container');
  if (existingAuth) {
    existingAuth.remove();
  }

  // Create login/signup container
  const authContainer = document.createElement('div');
  authContainer.className = 'auth-container';
  authContainer.innerHTML = `
    <button class="login-btn" onclick="initiateGoogleLogin()">Login</button>
    <button class="signup-btn" onclick="initiateGoogleLogin()">Sign Up</button>
  `;

  // Insert before existing nav items
  const firstChild = navRight.firstChild;
  navRight.insertBefore(authContainer, firstChild);
}

function personalizeHeroTitle(user) {
  const heroTitle = document.querySelector('.hero-title');
  const heroSubtitle = document.querySelector('.hero-subtitle');

  if (heroTitle) {
    const displayName = user.preferredFirstName || user.name.split(' ')[0];
    const greeting = user.isComplete && user.preferredFirstName ? `Welcome back, ${displayName}!` : `Welcome, ${displayName}!`;
    heroTitle.textContent = greeting;
  }

  if (heroSubtitle) {
    heroSubtitle.innerHTML = `Ready to boost your productivity with <strong>PRISMiTY.AI</strong>? Let's get things done faster with intelligent automation.`;
  }
}

function showGenericHeroTitle() {
  const heroTitle = document.querySelector('.hero-title');
  const heroSubtitle = document.querySelector('.hero-subtitle');

  if (heroTitle) {
    heroTitle.textContent = 'PRISMiTY.AI';
  }

  if (heroSubtitle) {
    heroSubtitle.innerHTML = `Your <strong>AI-powered productivity assistant</strong> for marketing and automation tasks. Get things done faster with intelligent automation.`;
  }
}