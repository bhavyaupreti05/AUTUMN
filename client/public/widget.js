(function() {
    // Autumn widget script
    const scriptTag = document.currentScript;
    const botKey = scriptTag.getAttribute("data-bot-key");
    const apiBase = scriptTag.getAttribute("data-api-base") || "http://localhost:8000";

    if (!botKey) {
        console.error("Autumn Widget: data-bot-key is required on the script tag.");
        return;
    }

    let config = null;
    let conversationId = null;

    // Create UI Elements
    const container = document.createElement("div");
    container.id = "autumn-widget-container";
    container.style.position = "fixed";
    container.style.bottom = "20px";
    container.style.right = "20px";
    container.style.zIndex = "999999";
    container.style.fontFamily = "sans-serif";

    // Bubble Button
    const bubble = document.createElement("div");
    bubble.style.width = "60px";
    bubble.style.height = "60px";
    bubble.style.borderRadius = "50%";
    bubble.style.backgroundColor = "#3b82f6"; // Default
    bubble.style.color = "#fff";
    bubble.style.display = "flex";
    bubble.style.alignItems = "center";
    bubble.style.justifyContent = "center";
    bubble.style.cursor = "pointer";
    bubble.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
    bubble.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`;

    // Chat Window
    const chatWindow = document.createElement("div");
    chatWindow.style.display = "none";
    chatWindow.style.width = "350px";
    chatWindow.style.height = "500px";
    chatWindow.style.backgroundColor = "#fff";
    chatWindow.style.border = "1px solid #e5e7eb";
    chatWindow.style.borderRadius = "12px";
    chatWindow.style.boxShadow = "0 10px 15px -3px rgba(0,0,0,0.1)";
    chatWindow.style.flexDirection = "column";
    chatWindow.style.overflow = "hidden";
    chatWindow.style.position = "absolute";
    chatWindow.style.bottom = "80px";
    chatWindow.style.right = "0";

    // Header
    const header = document.createElement("div");
    header.style.padding = "16px";
    header.style.backgroundColor = "#3b82f6"; // Default
    header.style.color = "#fff";
    header.style.fontWeight = "bold";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.innerHTML = `<span id="autumn-title">Chat</span> <span id="autumn-close" style="cursor:pointer">&times;</span>`;

    // Messages Area
    const messagesArea = document.createElement("div");
    messagesArea.style.flex = "1";
    messagesArea.style.padding = "16px";
    messagesArea.style.overflowY = "auto";
    messagesArea.style.display = "flex";
    messagesArea.style.flexDirection = "column";
    messagesArea.style.gap = "8px";
    messagesArea.style.backgroundColor = "#f9fafb";

    // Input Area
    const inputArea = document.createElement("div");
    inputArea.style.padding = "16px";
    inputArea.style.borderTop = "1px solid #e5e7eb";
    inputArea.style.display = "flex";
    inputArea.style.gap = "8px";

    const inputField = document.createElement("input");
    inputField.type = "text";
    inputField.placeholder = "Type your message...";
    inputField.style.flex = "1";
    inputField.style.padding = "8px 12px";
    inputField.style.border = "1px solid #d1d5db";
    inputField.style.borderRadius = "6px";
    inputField.style.outline = "none";

    const sendBtn = document.createElement("button");
    sendBtn.innerText = "Send";
    sendBtn.style.padding = "8px 16px";
    sendBtn.style.backgroundColor = "#3b82f6";
    sendBtn.style.color = "#fff";
    sendBtn.style.border = "none";
    sendBtn.style.borderRadius = "6px";
    sendBtn.style.cursor = "pointer";

    inputArea.appendChild(inputField);
    inputArea.appendChild(sendBtn);

    chatWindow.appendChild(header);
    chatWindow.appendChild(messagesArea);
    chatWindow.appendChild(inputArea);

    container.appendChild(chatWindow);
    container.appendChild(bubble);
    document.body.appendChild(container);

    // Logic
    let isOpen = false;

    bubble.onclick = () => {
        isOpen = !isOpen;
        chatWindow.style.display = isOpen ? "flex" : "none";
        if (isOpen && !config) {
            initBot();
        }
    };

    header.querySelector("#autumn-close").onclick = () => {
        isOpen = false;
        chatWindow.style.display = "none";
    };

    function addMessage(text, isUser = false) {
        const msgDiv = document.createElement("div");
        msgDiv.style.maxWidth = "85%";
        msgDiv.style.padding = "10px 14px";
        msgDiv.style.borderRadius = "8px";
        msgDiv.style.fontSize = "14px";
        msgDiv.style.lineHeight = "1.4";
        msgDiv.style.wordBreak = "break-word";
        
        if (isUser) {
            msgDiv.style.backgroundColor = config ? config.accent : "#3b82f6";
            msgDiv.style.color = "#fff";
            msgDiv.style.alignSelf = "flex-end";
            msgDiv.style.borderBottomRightRadius = "2px";
        } else {
            msgDiv.style.backgroundColor = "#fff";
            msgDiv.style.color = "#111827";
            msgDiv.style.border = "1px solid #e5e7eb";
            msgDiv.style.alignSelf = "flex-start";
            msgDiv.style.borderBottomLeftRadius = "2px";
        }
        
        // Very basic markdown handling for widget
        msgDiv.innerHTML = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br/>');

        messagesArea.appendChild(msgDiv);
        messagesArea.scrollTop = messagesArea.scrollHeight;
        return msgDiv;
    }

    async function initBot() {
        try {
            const res = await fetch(`${apiBase}/api/public/bots/${botKey}/init`);
            if (res.ok) {
                config = await res.json();
                header.querySelector("#autumn-title").innerText = config.name;
                
                const accent = config.accent.startsWith("var") ? "#3b82f6" : config.accent;
                bubble.style.backgroundColor = accent;
                header.style.backgroundColor = accent;
                sendBtn.style.backgroundColor = accent;

                if (config.starter_questions && config.starter_questions.length > 0) {
                    addMessage("Hi there! How can I help you today? You can ask me things like:");
                    const sqContainer = document.createElement("div");
                    sqContainer.style.display = "flex";
                    sqContainer.style.flexWrap = "wrap";
                    sqContainer.style.gap = "6px";
                    sqContainer.style.marginTop = "8px";
                    
                    config.starter_questions.forEach(sq => {
                        const btn = document.createElement("button");
                        btn.innerText = sq;
                        btn.style.padding = "6px 12px";
                        btn.style.borderRadius = "16px";
                        btn.style.border = `1px solid ${accent}`;
                        btn.style.backgroundColor = "#fff";
                        btn.style.color = accent;
                        btn.style.cursor = "pointer";
                        btn.style.fontSize = "12px";
                        btn.onclick = () => {
                            inputField.value = sq;
                            sendMessage();
                        };
                        sqContainer.appendChild(btn);
                    });
                    messagesArea.appendChild(sqContainer);
                } else {
                    addMessage("Hi there! How can I help you today?");
                }
            } else {
                addMessage("Error initializing bot. Please check integration settings.", false);
            }
        } catch (e) {
            console.error(e);
            addMessage("Network error. Could not reach server.", false);
        }
    }

    async function sendMessage() {
        const text = inputField.value.trim();
        if (!text) return;
        
        inputField.value = "";
        addMessage(text, true);

        const replyDiv = addMessage("typing...", false);
        let fullReply = "";

        try {
            const res = await fetch(`${apiBase}/api/public/bots/${botKey}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, conversation_id: conversationId })
            });

            if (!res.ok) {
                replyDiv.innerText = "Error: Failed to fetch response.";
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder("utf-8");
            replyDiv.innerHTML = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunkStr = decoder.decode(value, { stream: true });
                const lines = chunkStr.split("\n");
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const dataStr = line.replace("data: ", "").trim();
                        if (dataStr === "[DONE]") break;
                        if (!dataStr) continue;
                        
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.conversation_id) conversationId = data.conversation_id;
                            if (data.chunk) {
                                fullReply += data.chunk;
                                replyDiv.innerHTML = fullReply
                                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                    .replace(/\n/g, '<br/>');
                                messagesArea.scrollTop = messagesArea.scrollHeight;
                            }
                        } catch (e) {}
                    }
                }
            }
        } catch (e) {
            console.error(e);
            replyDiv.innerText = "Error sending message.";
        }
    }

    sendBtn.onclick = sendMessage;
    inputField.onkeypress = (e) => {
        if (e.key === "Enter") sendMessage();
    };
})();
