# NRN AI

NRN AI is a production-grade multi-user AI chat application featuring private personal workspaces (ChatGPT/Claude style) and separate shared group rooms for live multi-user collaboration with NRN AI over WebSockets.

Built with a modular backend (FastAPI, Pydantic, HTTPX, WebSockets) and hand-written, restrained vanilla frontend (HTML5, CSS3 with tokens, ES6 modules).

---

## Key Features

### 1. Private Mode (Primary Workspace)
- **Dedicated Private Workspaces**: Each authenticated user has their own private conversation history.
- **Strict Data Isolation**: Queries and mutations are scoped per `owner_id` server-side; attempts to fetch another user's conversation ID yield `403`/`404`.
- **Token-by-Token SSE Streaming**: Real-time response generation with blinking typing cursor and a working **Stop generating** abort control.
- **Smart Title Auto-generation**: Conversations automatically title themselves from the initial user prompt.
- **Message Editing & Truncation**: Edit earlier messages, automatically truncating subsequent thread context and re-generating replies.
- **Response Regeneration**: Re-run the assistant's generation for the last prompt.
- **File & Image Attachments**: Secure file uploads (`data/uploads/<user_id>/`) with MIME validation and vision model support.
- **Dynamic Model Picker**: Choose from configured OpenRouter models (e.g., Llama 3.3 70B, Gemini 2.0 Flash Vision, Qwen 2.5 Coder, DeepSeek V3).
- **Search & Management**: Search across titles and message bodies, inline rename, and permanent cascade deletion.
- **Safe Markdown Rendering**: Fenced code blocks with language tags, syntax highlighting, safe HTML sanitization, and working **Copy** buttons.

### 2. Group Mode (Shared Collaborative Rooms)
- **General AI Group**: Shared persistent room where all authenticated users and NRN AI collaborate in a unified thread.
- **Real-Time WebSockets**: Live broadcast of incoming user messages and AI responses without manual page refreshes.
- **Clear Attribution**: Clear sender indicators distinguishing your own messages (`You`), other users (`Username`), and `NRN AI`.
- **Persistent History**: All group room discussions are stored in `data/groups.json` and persist across server restarts.

### 3. Feedback System
- Appends authenticated user feedback blocks (`User`, `Timestamp`, `Feedback`) to `feedback.txt`.

### 4. Design & Polish
- Hand-crafted design tokens in `tokens.css` with dark mode support (`prefers-color-scheme: dark`).
- Restrained visual aesthetic inspired by Linear and Claude/ChatGPT desktop web apps (no neon gradients, no decorative glassmorphism, no pill shapes everywhere).
- WCAG AA contrast compliance and fully responsive mobile layout with drawer navigation.

---

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, Uvicorn, Pydantic, HTTPX, WebSockets, Passlib/Bcrypt, FileLock.
- **Frontend**: Vanilla HTML5, Hand-written CSS3, ES6 JavaScript Modules (No React/Vue, No Tailwind/Bootstrap).
- **AI Provider**: OpenRouter API with configurable free-tier and vision models.
- **Storage**: Process-safe atomic JSON file storage with file locking (`storage.py`).

---

## Security & Data Isolation Architecture

- **Zero Client-Side Secrets**: No API keys or tokens are ever embedded in or sent to frontend assets. All OpenRouter calls originate server-side.
- **Password Security**: Passwords are salted and hashed using `bcrypt` (12 rounds) and never logged or exposed.
- **Session Authentication**: JWT access tokens issued as `httpOnly`, `SameSite=Lax` cookies to mitigate XSS-based token theft.
- **Strict Data Isolation**: Storage access verifies `owner_id == current_user.id`. A user cannot guess or access other users' conversations, messages, or uploaded files.
- **XSS Protection**: HTML entities are escaped before markdown structure parsing to prevent script injection.
- **Rate Limiting**: In-memory sliding window rate limiting on mutating endpoints.

---

## Setup & Running

### 1. Clone & Navigate
```bash
cd /home/naveen/.gemini/antigravity/scratch/NRN-AI
```

### 2. Set Up Virtual Environment

**On Linux / macOS:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

**On Windows:**
```cmd
python -m venv .venv
.venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and configure your keys:
```ini
OPENROUTER_API_KEY=your_openrouter_api_key_here
AI_MODEL=meta-llama/llama-3.3-70b-instruct:free
SECRET_KEY=generate_a_random_32_character_secret_key
```
*(Note: If `OPENROUTER_API_KEY` is not provided, the app will run and return friendly error notices when AI responses are requested.)*

### 5. Run Application
```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```
Open your browser at:
```
http://localhost:8000
```

---

## Running Automated Tests

Run the test suite to verify authentication, data isolation, SSE streaming, file uploads, WebSockets, rate limiting, and security invariants:
```bash
pytest test_nrn_ai.py -v
```

---

## Project Structure

```
NRN-AI/
├── frontend/
│   ├── index.html                # Session gateway & redirector
│   ├── login.html                # Login view
│   ├── register.html             # Register view with live password checklist
│   ├── app.html                  # Private chat workspace
│   ├── group.html                # Group rooms workspace
│   ├── css/
│   │   ├── reset.css             # CSS reset
│   │   ├── tokens.css            # Design tokens (light & dark theme)
│   │   ├── layout.css            # Shell layout & responsive drawer
│   │   ├── auth.css              # Auth view styling
│   │   ├── chat.css              # Message list, composer, streaming cursor
│   │   ├── sidebar.css           # Conversation list & search
│   │   ├── markdown.css          # Markdown tables, blockquotes, syntax highlighting
│   │   └── components.css        # Atoms (buttons, modals, toasts, chips)
│   ├── js/
│   │   ├── api.js                # Standardized fetch client with error handling
│   │   ├── auth.js               # Auth form logic & password requirements validator
│   │   ├── sidebar.js            # Conversation list CRUD, search, recency grouping
│   │   ├── chat.js               # Private chat orchestration, edit, regenerate
│   │   ├── streaming.js          # SSE stream reader and abort controller
│   │   ├── markdown.js           # Safe markdown parser, syntax highlighter, copy button
│   │   ├── upload.js             # Attachment handler & chip preview
│   │   ├── model_picker.js       # Dynamic model selector
│   │   ├── group.js              # Group room UI logic
│   │   ├── ws.js                 # WebSocket client with reconnection & heartbeat
│   │   ├── feedback.js           # Feedback modal submission
│   │   └── ui.js                 # UI utilities, toasts, modals, icon set
│   └── assets/
│       └── favicon.svg           # Monogram SVG favicon
│
├── backend/
│   ├── main.py                   # FastAPI app factory, routes, static mounts, exception handler
│   ├── config.py                 # Pydantic Settings
│   ├── auth/
│   │   ├── routes.py             # /api/auth/register, login, logout
│   │   ├── security.py           # bcrypt password hashing, JWT creation/verification
│   │   └── dependencies.py       # get_current_user, require_auth
│   ├── routes/
│   │   ├── conversations.py      # Private conversation CRUD & search
│   │   ├── chat.py               # Messages, SSE streaming AI reply, edit, regenerate
│   │   ├── uploads.py            # File upload & authenticated download
│   │   ├── models.py             # GET /api/models
│   │   ├── group.py              # Group room endpoints
│   │   ├── ws.py                 # Group room WebSocket
│   │   ├── feedback.py           # POST /api/feedback
│   │   └── users.py              # GET /api/users/me
│   ├── services/
│   │   ├── ai_service.py         # OpenRouter async client with streaming & multimodal support
│   │   ├── conversation_service.py # Private conversation CRUD + ownership checks
│   │   ├── chat_service.py       # Message persistence, context building, truncation
│   │   ├── group_service.py      # Group room message persistence and AI participant integration
│   │   ├── connection_manager.py # WebSocket connection tracking & broadcast
│   │   ├── upload_service.py     # Safe file storage under data/uploads/<user_id>/
│   │   └── feedback_service.py   # Atomic append to feedback.txt
│   ├── models/
│   │   ├── user.py               # User Pydantic models
│   │   ├── conversation.py       # Conversation & Message models
│   │   ├── group.py              # GroupRoom & GroupMessage models
│   │   ├── attachment.py         # Attachment metadata model
│   │   └── feedback.py           # Feedback model
│   ├── middleware/
│   │   └── rate_limit.py         # Sliding-window rate limiter
│   └── utils/
│       ├── storage.py            # Atomic JSON read/write with file locking
│       └── validation.py         # Input validation & filename sanitization
│
├── data/
│   ├── users.json
│   ├── conversations.json
│   ├── messages.json
│   ├── groups.json
│   └── uploads/
│
├── feedback.txt
├── .env.example
├── .gitignore
├── requirements.txt
├── README.md
└── test_nrn_ai.py
```
