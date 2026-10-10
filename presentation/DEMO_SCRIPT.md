# Presentation Demo Script (7-10 Minutes)

## Pre-requisites
Ensure the backend server (`uvicorn`) is running locally and `index.html` is open in a fresh Chrome tab.

---

### Step 1: Application Startup & UX (1 min)
- **Action**: Open the browser. Highlight the dark-themed UI, the robot mascot standing idle, and the clean "New Chat" sidebar interface.
- **Talking Point**: *"This is ChatBot-2. It’s running entirely locally on this laptop. No data leaves the machine."*

### Step 2: Normal Chat & Streaming (1 min)
- **Action**: Type: *"Explain the concept of quantum entanglement in simple terms."*
- **Observation**: Point out the sub-second response time (TTFT < 200ms).
- **Observation**: Highlight the Avatar actively animating/glowing while tokens are streaming in via SSE, then returning to idle upon completion.

### Step 3: Multi-turn Memory (1 min)
- **Action**: Type: *"Can you summarize that in 3 bullet points?"*
- **Observation**: Verify the LLM remembers the previous context and successfully summarizes its own answer.

### Step 4: Conversation Isolation (1.5 min)
- **Action**: Start a New Chat (Chat B). 
- **Action**: Type: *"My secret project codename is OMEGA. Remember this."*
- **Action**: Switch back to Chat A. Ask: *"What is my secret project codename?"*
- **Observation**: Chat A will state it does not know. 
- **Talking Point**: *"Our SQLite ContextManager perfectly isolates memory states between threads."*

### Step 5: PDF Upload & RAG (2 min)
- **Action**: Stay in Chat A. Upload `test_report.pdf` (or similar simple fact document).
- **Action**: Ask: *"Based on the document, what is the Q3 revenue figure?"*
- **Observation**: The system extracts the vector, searches ChromaDB, and returns the exact figure.
- **Action**: Ask: *"Who is the CEO mentioned in the document?"* (Assuming this fact is NOT in the document).
- **Observation**: The system correctly refuses to hallucinate, stating the information isn't present.

### Step 6: Browser Refresh & Persistence (1 min)
- **Action**: Hard refresh the browser (`F5`).
- **Observation**: The UI instantly repopulates the conversation list and the active chat history.
- **Talking Point**: *"Because we use a transactional SQLite database, no work is lost on accidental disconnects."*

### Step 7: Backend Restart (1 min)
- **Action**: Go to the terminal. Kill the Uvicorn server (`Ctrl+C`). Restart it.
- **Action**: Go back to the browser and send a message.
- **Observation**: The system seamlessly picks up exactly where it left off, successfully querying the LLM using the recovered context.
