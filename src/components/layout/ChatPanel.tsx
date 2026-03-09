"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { ChatMessage } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  currentMonth: string;
}

export default function ChatPanel({ open, onClose, currentMonth }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, currentMonth }),
      });
      if (!res.ok) throw new Error(`Chat API error: ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let assistantText = "";
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            assistantText += parsed.text;
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: "assistant", content: assistantText };
              return updated;
            });
          } catch { /* skip partial */ }
        }
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}. Make sure ANTHROPIC_API_KEY is set.` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "How did the team do this month?",
    "Who are the top performers?",
    "Compare squads this month",
    "Who needs to improve AI adoption?",
    "Show me the bug breakdown",
    "On-call highlights this month",
  ];

  return (
    <div
      className={`fixed top-0 right-0 h-full w-full sm:w-[440px] bg-[var(--background)] border-l border-[var(--border)] z-40 transform transition-transform duration-300 ease-out ${
        open ? "translate-x-0" : "translate-x-full"
      } flex flex-col`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
        <div className="w-9 h-9 rounded-xl bg-[var(--accent)] flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-[var(--foreground)]">Performance Agent</div>
          <div className="text-[10px] text-[var(--muted)]">Ask anything about team performance</div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-white hover:border-[var(--border-light)] transition-colors">
          &times;
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-4 mt-4">
            <p className="text-sm text-[var(--muted)] text-center">
              I can analyze performance data, compare developers, find trends, and answer questions about the team.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => { setInput(s); }}
                  className="text-left text-[11px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border-light)] hover:bg-[var(--surface-hover)] transition-all leading-snug"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm ${
              msg.role === "user"
                ? "bg-[var(--accent)] text-white rounded-br-md"
                : "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-bl-md"
            }`}>
              {msg.role === "assistant" ? (
                <div className="chat-markdown prose prose-invert prose-sm max-w-none leading-relaxed">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
              <span className="w-2 h-2 bg-[var(--muted)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-[var(--muted)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-[var(--muted)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--border)] px-5 py-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask about performance..."
            className="flex-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] placeholder:text-[var(--muted-dim)] transition-colors"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm text-white font-medium disabled:opacity-40 hover:opacity-90 transition-colors shadow-lg shadow-[var(--accent)]/20"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
