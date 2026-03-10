import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You write short, plain-English retirement vision statements.
Rules:
- Use everyday words. Never use words like "envision", "curate", "tapestry", "rootedness", "embark", "journey", "intentional", "meaningful", or similar abstract filler.
- Write like a real person talking to a friend — warm and direct, not like a brochure.
- Short sentences. No jargon.
- Split the response into 2–3 short paragraphs, each on a new line.
- No bullet points, no headings, no sign-off.`;

export async function POST(req: NextRequest) {
  const { aspirations, mode } = await req.json();

  const aspirationList = (aspirations as string[]).length > 0
    ? (aspirations as string[]).join(', ')
    : 'enjoying later life';

  const prompt = mode === 'couple'
    ? `Write a life vision statement for a couple planning retirement. Their priorities are: ${aspirationList}. Use "we" and "us". Keep it real and personal — 2 to 3 short paragraphs.`
    : `Write a life vision statement for someone planning retirement. Their priorities are: ${aspirationList}. Keep it real and personal — 2 to 3 short paragraphs.`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const anthropicStream = client.messages.stream({
        model: 'claude-haiku-4-5',
        max_tokens: 250,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      for await (const event of anthropicStream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(event.delta.text));
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
