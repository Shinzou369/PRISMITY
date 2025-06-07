// FIXED: Enhanced sidebar toggle with proper workspace expansion and hamburger animation
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const btn = document.querySelector(".toggle-btn");
  const workspace = document.querySelector(".workspace");
  const container = document.querySelector(".container");

  if (!sidebar || !btn) {
    console.warn("Sidebar or toggle button not found in the document.");
    return;
  }

  // Toggle sidebar hidden state
  sidebar.classList.toggle("hidden");

  // FIXED: Correct animation logic - hamburger when visible, cross when hidden
  if (sidebar.classList.contains("hidden")) {
    // Sidebar is hidden, show hamburger lines (≡)
    btn.classList.remove("active");
  } else {
    // Sidebar is visible, show cross (×)
    btn.classList.add("active");
  }

  // FIXED: Properly expand workspace when sidebar is hidden
  if (workspace) {
    workspace.classList.toggle("expanded", sidebar.classList.contains("hidden"));
  }

  // Adjust container for sidebar state
  if (container) {
    container.classList.toggle("sidebar-collapsed", sidebar.classList.contains("hidden"));
  }

  // Add body class to handle workspace adjustment
  document.body.classList.toggle("sidebar-hidden", sidebar.classList.contains("hidden"));
}

// NEW: Website card interaction functionality
function initializeWebsiteCards() {
  const websiteCards = document.querySelectorAll(".website-card");

  websiteCards.forEach(card => {
    card.addEventListener("click", function() {
      // Remove active class from all cards
      websiteCards.forEach(c => c.classList.remove("active"));

      // Add active class to clicked card
      this.classList.add("active");

      // Get website info
      const websiteId = this.dataset.website;
      const websiteName = this.querySelector(".website-name").textContent;

      // Add a message to show which website was selected
      addMessage(`Switched to ${websiteName}`, "system");

      console.log(`Selected website: ${websiteName} (ID: ${websiteId})`);
    });
  });
}

// === MEMORY + TRAINING SETUP ===
let customTraining =
  localStorage.getItem("customTraining") ||
  "You are TaskAI, a helpful assistant for marketing and productivity tasks.";

let threads = JSON.parse(localStorage.getItem("threads")) || [
  {
    id: Date.now(),
    title: "New Chat",
    conversation: [{ role: "system", content: customTraining }],
  },
];

let currentThreadId = threads[0].id;
let conversation = threads[0].conversation;

// === LOGIN GATING SETUP ===
let isUserLoggedIn = false;

function switchThread(threadId) {
  currentThreadId = threadId;
  const thread = threads.find((t) => t.id === threadId);
  if (thread) {
    conversation = thread.conversation;
    updateUI();

    // Update active thread in sidebar
    document.querySelectorAll("#threads-list li").forEach((li) => {
      li.classList.toggle(
        "active",
        li.dataset.threadId === threadId.toString(),
      );
    });
  }
}

function updateUI() {
  const outputBox = document.getElementById("output-box");
  const threadsList = document.getElementById("threads-list");

  if (outputBox) outputBox.innerHTML = "";
  if (threadsList) threadsList.innerHTML = "";

  // Display messages
  conversation.forEach((msg) => {
    if (msg.role === "user" || msg.role === "assistant") {
      addMessage(msg.content, msg.role === "user" ? "user" : "gpt");
    }
  });

  // Update threads list
  threads.forEach((thread) => {
    const li = document.createElement("li");
    const titleSpan = document.createElement("span");
    titleSpan.textContent = thread.title;
    titleSpan.onclick = () => switchThread(thread.id);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "×";
    deleteBtn.className = "delete-thread";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (threads.length > 1) {
        threads = threads.filter((t) => t.id !== thread.id);
        if (currentThreadId === thread.id) {
          switchThread(threads[0].id);
        }
        localStorage.setItem("threads", JSON.stringify(threads));
        updateUI();
      }
    };

    li.appendChild(titleSpan);
    li.appendChild(deleteBtn);
    li.dataset.threadId = thread.id;
    if (thread.id === currentThreadId) li.classList.add("active");
    threadsList.appendChild(li);
  });
}

// === UI HELPERS ===
function formatMarkdown(text) {
  // Configure marked options
  marked.setOptions({
    highlight: function(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang }).value;
        } catch (err) {
          console.warn('Syntax highlighting failed:', err);
        }
      }
      return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true,
    tables: true,
    sanitize: false, // We'll use DOMPurify instead for better control
    smartLists: true,
    smartypants: true
  });

  // Parse markdown
  let html = marked.parse(text);
  
  // Sanitize the HTML to prevent XSS attacks while preserving code highlighting
  html = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'strike', 'del', 'ins', 
                   'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                   'ul', 'ol', 'li', 'blockquote', 
                   'pre', 'code', 'span',
                   'table', 'thead', 'tbody', 'tr', 'th', 'td',
                   'a', 'img', 'hr'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'id'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  });

  return html;
}

// ENHANCED: Message display with system message support and syntax highlighting
function addMessage(content, type = "gpt", model = null) {
  const box = document.getElementById("output-box");
  if (!box) {
    console.warn("Output box not found in the document.");
    return;
  }

  const msg = document.createElement("div");
  msg.classList.add("message", type);

  // Handle different message types
  if (type === "gpt") {
    msg.innerHTML = formatMarkdown(content);
    
    // Initialize syntax highlighting for code blocks
    msg.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });
    
    // Add copy button to GPT messages
    addCopyButton(msg);
    
    // Add copy buttons to code blocks
    addCodeBlockCopyButtons(msg);
  } else if (type === "system") {
    // NEW: System messages for website switching, etc.
    msg.classList.add("system");
    msg.innerHTML = `<em>🔄 ${content}</em>`;
    msg.style.fontSize = "0.9rem";
    msg.style.opacity = "0.8";
    msg.style.fontStyle = "italic";
    msg.style.textAlign = "center";
    msg.style.background = "var(--bg-tertiary)";
    msg.style.border = "1px solid var(--border-color)";
    msg.style.color = "var(--text-muted)";
    msg.style.margin = "8px auto";
    msg.style.maxWidth = "60%";
  } else {
    msg.innerText = content;
  }

  // Add typing animation effect
  if (type === "gpt") {
    msg.style.opacity = "0";
    msg.style.transform = "translateY(20px)";
  }

  box.appendChild(msg);

  // Animate message appearance
  if (type === "gpt") {
    setTimeout(() => {
      msg.style.transition = "all 0.3s ease-out";
      msg.style.opacity = "1";
      msg.style.transform = "translateY(0)";
    }, 50);
  }

  smoothScrollToBottom();
}

// === MODEL SELECTOR ===
function selectModel(prompt) {
  const lower = prompt.toLowerCase();
  if (lower.includes("complex")) return "gpt-4-turbo";
  if (lower.includes("longer")) return "gpt-4";
  if (lower.includes("deeper")) return "gpt-3.5-turbo";
  if (lower.includes("quick")) return "deepseek-chat";
  return "gpt-3.5-turbo"; // default
}

// === GPT API CALL ===
async function getGPTResponse(model) {
  try {
    const response = await fetch('/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: conversation,
        thread_id: currentThreadId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get response');
    }

    const data = await response.json();
    return data.message.content.trim();
  } catch (error) {
    console.error('Error during API call:', error);
    return 'Sorry, there was an error communicating with the AI.';
  }
}

// === MAIN CHAT SUBMISSION FLOW ===
// Enhanced submit flow with modern animations and feedback
async function submitPrompt(promptText) {
  if (!promptText.trim()) return;

  // Check if user is logged in before proceeding
  if (!isUserLoggedIn) {
    showLoginModal();
    return;
  }

  const submitBtn = document.getElementById("submit-btn");
  const promptInput = document.getElementById("prompt-input");

  // Enhanced button state management
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="loading-spinner"></span>';
  submitBtn.style.transform = "scale(0.95)";

  // Enhanced fade out animations
  const header = document.querySelector(".hero-section");
  const quickChat = document.querySelector(".quick-chat");
  const workspace = document.querySelector(".workspace");

  if (header) {
    header.classList.add("fade-out");
  }
  if (quickChat) {
    quickChat.classList.add("fade-out");
    // Add class to workspace to expand chat container
    if (workspace) {
      workspace.classList.add("no-quick-chat");
    }
  }

  // Clear input with animation
  if (promptInput) {
    promptInput.style.transform = "scale(0.98)";
    setTimeout(() => {
      promptInput.value = "";
      promptInput.style.transform = "scale(1)";
    }, 150);
  }

  // Add user message with animation
  addMessage(promptText, "user");

  // Show typing indicator instead of "Thinking..."
  showTypingIndicator();

  conversation.push({ role: "user", content: promptText });

  const selectedModel = selectModel(promptText);

  try {
    const response = await getGPTResponse(selectedModel);

    const outputBox = document.getElementById("output-box");
    if (outputBox) {
      const gptMsgs = outputBox.querySelectorAll(".gpt");
      const lastGpt = gptMsgs[gptMsgs.length - 1];
      if (lastGpt) {
        // Remove any markdown headers (###, ##, #) from the response
        const cleanResponse = response.replace(/^[#]+\s.*$/gm, "").trim();
        const messageContainer = document.createElement("div");
        messageContainer.className = "message-container";

        const messageContent = document.createElement("div");
        messageContent.className = "message-content";
        messageContent.style.position = "relative";

        // Create model indicator
        const modelIndicator = document.createElement("div");
        modelIndicator.className = "model-indicator";

        // Set model indicator text and class
        let modelText = "3";
        let modelClass = "model-3";

        if (selectedModel.includes("gpt-4-turbo")) {
          modelText = "4T";
          modelClass = "model-4t";
        } else if (selectedModel.includes("gpt-4")) {
          modelText = "4";
          modelClass = "model-4";
        } else if (selectedModel.includes("deepseek")) {
          modelText = "D";
          modelClass = "model-d";
        }

        modelIndicator.textContent = modelText;
        modelIndicator.classList.add(modelClass);

        messageContent.innerHTML = `
          <div class="gpt-content">${cleanResponse}</div>
          <div class="model-tag">${selectedModel}</div>
        `;

        messageContent.appendChild(modelIndicator);
        messageContainer.appendChild(messageContent);
        lastGpt.replaceWith(messageContainer);
      }
    }

    conversation.push({ role: "assistant", content: response });

    // Add model indicator message
    const modelMessage = `Powered by ${selectedModel}`;
    const msg = document.createElement("div");
    msg.classList.add("message", "gpt", "model-message");
    msg.innerText = modelMessage;
    outputBox.appendChild(msg);
    conversation.push({ role: "assistant", content: modelMessage });

    // Generate creative thread title using the AI's response
    const currentThread = threads.find((t) => t.id === currentThreadId);
    if (currentThread && currentThread.title === "New Chat") {
      const titlePrompt = `Based on this conversation: "${promptText}", generate a creative and concise title (max 4 words).`;
      conversation.push({ role: "user", content: titlePrompt });
      const titleResponse = await getGPTResponse("gpt-3.5-turbo");
      conversation.pop(); // Remove the title prompt from conversation
      currentThread.title = titleResponse.replace(/["']/g, "").slice(0, 40);
    }

    // Save threads to localStorage
    localStorage.setItem("threads", JSON.stringify(threads));
    updateUI();
  } catch (err) {
    console.error(err);
    hideTypingIndicator();
    addMessage("Sorry, there was an error. Please try again.", "gpt");
  } finally {
    // Enhanced button state restoration
    const submitBtn = document.getElementById("submit-btn");
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="submit-icon">🚀</span>';
    submitBtn.style.transform = "scale(1)";

    hideTypingIndicator();
  }
}

// Enhanced copy button with modern styling
function addCopyButton(messageElement) {
  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-btn";
  copyBtn.innerHTML = '<i data-lucide="copy"></i>';
  copyBtn.title = "Copy message";
  copyBtn.onclick = async () => {
    try {
      const content = messageElement.textContent;
      await navigator.clipboard.writeText(content);
      copyBtn.innerHTML = "✓";
      copyBtn.style.background = "#10b981";
      copyBtn.style.color = "white";
      setTimeout(() => {
        copyBtn.innerHTML = '<i data-lucide="copy"></i>';
        lucide.createIcons();
        copyBtn.style.background = "";
        copyBtn.style.color = "";
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };
  messageElement.appendChild(copyBtn);
}

// Add copy buttons to code blocks
function addCodeBlockCopyButtons(messageElement) {
  const codeBlocks = messageElement.querySelectorAll('pre');
  codeBlocks.forEach((pre) => {
    const copyBtn = document.createElement("button");
    copyBtn.className = "code-copy-btn";
    copyBtn.innerHTML = '<i data-lucide="copy"></i>';
    copyBtn.title = "Copy code";
    copyBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      padding: 4px 8px;
      cursor: pointer;
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      transition: all 0.2s ease;
      opacity: 0;
      z-index: 10;
    `;
    
    copyBtn.onclick = async (e) => {
      e.stopPropagation();
      try {
        const code = pre.querySelector('code');
        const text = code ? code.textContent : pre.textContent;
        await navigator.clipboard.writeText(text);
        copyBtn.innerHTML = "✓";
        copyBtn.style.background = "#10b981";
        copyBtn.style.color = "white";
        setTimeout(() => {
          copyBtn.innerHTML = '<i data-lucide="copy"></i>';
          lucide.createIcons();
          copyBtn.style.background = "rgba(255, 255, 255, 0.1)";
          copyBtn.style.color = "rgba(255, 255, 255, 0.7)";
        }, 2000);
      } catch (err) {
        console.error('Failed to copy code: ', err);
      }
    };
    
    // Show/hide copy button on hover
    pre.style.position = "relative";
    pre.addEventListener('mouseenter', () => {
      copyBtn.style.opacity = "1";
    });
    pre.addEventListener('mouseleave', () => {
      copyBtn.style.opacity = "0";
    });
    
    pre.appendChild(copyBtn);
  });
}

// Smooth scroll to bottom function
function smoothScrollToBottom() {
  const box = document.getElementById("output-box");
  if (box) {
    box.scrollTo({
      top: box.scrollHeight,
      behavior: 'smooth'
    });
  }
}

// Customer service function for FAB
function openCustomerService() {
  const helpMessage = "Here are some frequently asked questions:\n\n• How do I use Prismity AI?\n• What AI models are available?\n• How do I start a new conversation?\n• Can I export my chat history?\n• How do I change themes?\n\nFor more help, you can ask me anything or contact our support team!";
  addMessage(helpMessage, "system");
  
  // Scroll to show the message
  const box = document.getElementById("output-box");
  if (box) {
    box.scrollTo({
      top: box.scrollHeight,
      behavior: 'smooth'
    });
  }
}

// === LOGIN MODAL FUNCTIONS ===
function showLoginModal() {
  // Remove existing modal if any
  const existingModal = document.getElementById('login-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'login-modal';
  modalOverlay.className = 'login-modal-overlay';
  modalOverlay.innerHTML = `
    <div class="login-modal-content">
      <div class="login-modal-header">
        <div class="auth-logo">
          <img src="Logo_of_an_AI_called_Prismity.png" alt="Prismity AI" />
          <span class="auth-logo-text">PRISMiTY.AI</span>
        </div>
        <h2>Please log in to use Prismity AI</h2>
        <p>Sign in with your Google account to continue chatting</p>
      </div>
      <div class="login-modal-body">
        <button class="google-login-modal-btn" onclick="initiateGoogleLogin()">
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  `;

  // Add modal to body
  document.body.appendChild(modalOverlay);

  // Add animation
  setTimeout(() => {
    modalOverlay.classList.add('show');
  }, 10);
}

function hideLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => {
      modal.remove();
    }, 300);
  }
}

// Enhanced typing indicator
function showTypingIndicator() {
  const box = document.getElementById("output-box");
  if (!box) return;

  const typingDiv = document.createElement("div");
  typingDiv.className = "message gpt typing-indicator";
  typingDiv.id = "typing-indicator";
  typingDiv.innerHTML = `
    <div class="typing-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;

  box.appendChild(typingDiv);
  smoothScrollToBottom();
}

function hideTypingIndicator() {
  const typingIndicator = document.getElementById("typing-indicator");
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

// === NEW CHAT (RESET MEMORY) ===
function newChat() {
  const newThread = {
    id: Date.now(),
    title: "New Chat",
    conversation: [{ role: "system", content: customTraining }],
  };

  threads.unshift(newThread);
  localStorage.setItem("threads", JSON.stringify(threads));

  currentThreadId = newThread.id;
  conversation = newThread.conversation;

  // Show header and quick chat for new conversations
  document.querySelector("header")?.classList.remove("fade-out");
  document.querySelector(".quick-chat")?.classList.remove("fade-out");
  document.querySelector(".workspace")?.classList.remove("no-quick-chat");

  const promptInput = document.getElementById("prompt-input");
  if (promptInput) promptInput.value = "";

  

  updateUI();
}

// === TRAINING SETTINGS ===
function setupTrainingEditor() {
  const trainingInput = document.getElementById("training-input");
  if (!trainingInput) return;

  trainingInput.value = customTraining;

  document.getElementById("save-training-btn").addEventListener("click", () => {
    const newTraining = trainingInput.value.trim();
    if (newTraining) {
      customTraining = newTraining;
      localStorage.setItem("customTraining", customTraining);
      newChat(); // reset chat to use new system prompt
      alert("Training updated! Starting a new chat.");
    }
  });
}

// ✨ IMMERSIVE SPIRITUAL WORLD FEATURE START ✨
// Bible verses array (NIV translation) - Enhanced for spiritual experience
const bibleVerses = [
  {
    text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, to give you hope and a future.",
    reference: "Jeremiah 29:11 (NIV)"
  },
  {
    text: "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.",
    reference: "Proverbs 3:5-6 (NIV)"
  },
  {
    text: "And we know that in all things God works for the good of those who love him, who have been called according to his purpose.",
    reference: "Romans 8:28 (NIV)"
  },
  {
    text: "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.",
    reference: "Joshua 1:9 (NIV)"
  },
  {
    text: "I can do all this through him who gives me strength.",
    reference: "Philippians 4:13 (NIV)"
  },
  {
    text: "The Lord your God is with you, the Mighty Warrior who saves. He will take great delight in you; in his love he will no longer rebuke you, but will rejoice over you with singing.",
    reference: "Zephaniah 3:17 (NIV)"
  }
];

let spiritualInterval;
let currentSpiritualIndex = 0;
let isSpiritualHovering = false;

function rotateSpiritualVerse() {
  if (!isSpiritualHovering) return;

  const verseText = document.getElementById('spiritual-verse');
  const verseReference = document.getElementById('spiritual-reference');
  const container = document.querySelector('.spiritual-content');

  if (!verseText || !verseReference || !container) return;

  // Add changing class for transition
  container.classList.add('verse-changing');

  setTimeout(() => {
    // Get next verse
    currentSpiritualIndex = (currentSpiritualIndex + 1) % bibleVerses.length;
    const nextVerse = bibleVerses[currentSpiritualIndex];

    // Update content
    verseText.textContent = nextVerse.text;
    verseReference.textContent = nextVerse.reference;

    // Remove changing class
    container.classList.remove('verse-changing');
  }, 250);
}

function startSpiritualExperience() {
  isSpiritualHovering = true;
  // Set random starting verse
  currentSpiritualIndex = Math.floor(Math.random() * bibleVerses.length);
  const startVerse = bibleVerses[currentSpiritualIndex];

  const verseText = document.getElementById('spiritual-verse');
  const verseReference = document.getElementById('spiritual-reference');

  if (verseText && verseReference) {
    verseText.textContent = startVerse.text;
    verseReference.textContent = startVerse.reference;
  }

  // Start rotation every 4 seconds for immersive experience
  spiritualInterval = setInterval(rotateSpiritualVerse, 4000);
}

function stopSpiritualExperience() {
  isSpiritualHovering = false;
  if (spiritualInterval) {
    clearInterval(spiritualInterval);
    spiritualInterval = null;
  }
}

function initializeSpiritualWorld() {
  const heroSection = document.getElementById('hero-section');
  if (!heroSection) return;

  heroSection.addEventListener('mouseenter', startSpiritualExperience);
  heroSection.addEventListener('mouseleave', stopSpiritualExperience);

  // Set initial random verse for spiritual world
  const initialVerse = bibleVerses[Math.floor(Math.random() * bibleVerses.length)];
  const verseText = document.getElementById('spiritual-verse');
  const verseReference = document.getElementById('spiritual-reference');

  if (verseText && verseReference) {
    verseText.textContent = initialVerse.text;
    verseReference.textContent = initialVerse.reference;
  }
}
// ✨ IMMERSIVE SPIRITUAL WORLD FEATURE END ✨

// === PAGE INIT ===
// Theme handling
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

function toggleTheme() {
  const currentTheme = localStorage.getItem("theme") || "light";
  const newTheme = currentTheme === "light" ? "dark" : "light";
  setTheme(newTheme);
}

document.addEventListener("DOMContentLoaded", () => {
  // Initialize highlight.js
  if (typeof hljs !== 'undefined') {
    hljs.configure({
      languages: ['javascript', 'python', 'java', 'cpp', 'c', 'html', 'css', 'json', 'xml', 'bash', 'shell', 'sql', 'php', 'ruby', 'go', 'rust', 'typescript', 'markdown', 'yaml', 'dockerfile']
    });
  }

  // Set initial theme
  const savedTheme = localStorage.getItem("theme") || "dark";
  setTheme(savedTheme);

  // NEW: Initialize website cards functionality
  initializeWebsiteCards();

  // ✨ Initialize immersive spiritual world experience
  initializeSpiritualWorld();

  // Enhanced character counter
  const promptInput = document.getElementById("prompt-input");
  const charCounter = document.getElementById("char-counter");

  if (promptInput && charCounter) {
    promptInput.addEventListener("input", () => {
      const count = promptInput.value.length;
      charCounter.textContent = `${count}/1000`;

      // Enhanced visual feedback for character count
      if (count > 1000) {
        charCounter.style.color = "#ef4444";
        charCounter.style.fontWeight = "600";
      } else if (count > 800) {
        charCounter.style.color = "#f59e0b";
        charCounter.style.fontWeight = "500";
      } else {
        charCounter.style.color = "var(--text-muted)";
        charCounter.style.fontWeight = "400";
      }

      // Auto-resize textarea
      promptInput.style.height = "auto";
      promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + "px";
    });

    // Add Enter key handling with Shift+Enter for new lines
    promptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const prompt = promptInput.value.trim();
        if (prompt) {
          submitPrompt(prompt);
        }
      }
    });
  }

  // Update UI to show threads
  updateUI();

  // Check if current conversation has messages and hide header/quick-chat if needed
  const currentThread = threads.find((t) => t.id === currentThreadId);
  if (currentThread && currentThread.conversation.length > 1) {
    document.querySelector("header")?.classList.add("fade-out");
    document.querySelector(".quick-chat")?.classList.add("fade-out");
    document.querySelector(".workspace")?.classList.add("no-quick-chat");
  }

  // Re-display saved conversation
  const outputBox = document.getElementById("output-box");
  const historyList = document.getElementById("history-list");

  if (outputBox) {
    outputBox.innerHTML = "";
  }
  if (historyList) {
    historyList.innerHTML = "";
  }

  conversation.forEach((msg) => {
    if (msg.role === "user") {
      addMessage(msg.content, "user");
      const item = document.createElement("li");
      item.textContent = msg.content;
      if (historyList) {
        historyList.prepend(item);
      }
    } else if (msg.role === "assistant") {
      addMessage(msg.content, "gpt");
    }
  });

  if (conversation.length > 1) {
    document.querySelector("header").classList.add("fade-out");
    document.querySelector(".quick-chat").classList.add("fade-out");
    document.querySelector(".workspace").classList.add("no-quick-chat");
  }

  setupTrainingEditor();

  // Add enhanced typing indicator styles
  const style = document.createElement('style');
  style.textContent = `
    .typing-indicator {
      padding: 16px 20px !important;
      background: var(--bg-secondary) !important;
      border: 1px solid var(--border-color) !important;
    }

    .typing-dots {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .typing-dots span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-muted);
      animation: typing 1.4s infinite;
    }

    .typing-dots span:nth-child(2) {
      animation-delay: 0.2s;
    }

    .typing-dots span:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes typing {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: 0.4;
      }
      30% {
        transform: translateY(-10px);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  document.getElementById("submit-btn").addEventListener("click", () => {
    const prompt = document.getElementById("prompt-input").value;
    submitPrompt(prompt);
  });

  document.querySelectorAll(".quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const question = btn.textContent;
      submitPrompt(question);
    });
  });

  document.getElementById("clear-chat")?.addEventListener("click", newChat);
});