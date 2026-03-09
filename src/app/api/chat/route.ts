import { NextRequest } from "next/server";
import { loadPerformanceData } from "@/lib/data";
import { processMessage } from "@/lib/chat-engine";

// ── Rule-based chat (no API key needed) ──
// To swap to Claude-powered chat later, uncomment the Claude section below
// and set ANTHROPIC_API_KEY in .env.local.

const USE_CLAUDE = false; // flip to true + add API key to enable Claude

export async function POST(request: NextRequest) {
  const { messages, currentMonth } = await request.json();

  const data = await loadPerformanceData();
  const lastMessage = messages[messages.length - 1]?.content || "";

  if (USE_CLAUDE) {
    return claudeResponse(messages, data, currentMonth);
  }

  // Rule-based response
  const answer = processMessage(lastMessage, data, currentMonth || "2026-02");

  // Stream it in chunks to match the existing UI contract
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      // Send in small chunks to simulate streaming feel
      const chunkSize = 40;
      for (let i = 0; i < answer.length; i += chunkSize) {
        const chunk = answer.slice(i, i + chunkSize);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ── Claude-powered chat (activate later) ──
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
async function claudeResponse(messages: any[], data: any, currentMonth: string) {
  // Lazy import so it doesn't fail when no API key is set
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const { buildSystemPrompt, TOOL_DEFINITIONS, executeTool } = await import("@/lib/claude");

  const anthropic = new Anthropic();
  const systemPrompt = buildSystemPrompt(data, currentMonth || "2026-02");

  const MODEL = "claude-sonnet-4-20250514";
  const MAX_TOKENS = 2048;
  const MAX_TOOL_ROUNDS = 5;

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const apiMessages = messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const response = await anthropic.messages.create({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: systemPrompt,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tools: TOOL_DEFINITIONS as any[],
            messages: apiMessages,
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const assistantContent: any[] = [];
          const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];
          let hasToolUse = false;

          for (const block of response.content) {
            if (block.type === "text") {
              assistantContent.push(block);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: block.text })}\n\n`));
            } else if (block.type === "tool_use") {
              hasToolUse = true;
              assistantContent.push(block);
              const result = executeTool(block.name, block.input as Record<string, unknown>, data);
              toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
            }
          }

          apiMessages.push({ role: "assistant" as const, content: assistantContent } as never);

          if (!hasToolUse) break;
          apiMessages.push({ role: "user" as const, content: toolResults } as never);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Internal error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: `\n\nError: ${msg}` })}\n\n`));
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
