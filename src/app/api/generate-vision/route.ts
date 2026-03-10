import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { aspirations, mode, existingVision } = await req.json();

  const aspirationList = aspirations.length > 0
    ? aspirations.join(', ')
    : 'general enjoyment of later life';

  const prompt = mode === 'couple'
    ? `Write a warm, personal 2–3 sentence life vision statement for a couple planning their retirement. Their chosen priorities are: ${aspirationList}.${existingVision ? ` They've started with: "${existingVision}".` : ''} Make it feel personal and inspiring, using "we" language. Do not use bullet points or headings — just flowing sentences.`
    : `Write a warm, personal 2–3 sentence life vision statement for someone planning their retirement. Their chosen priorities are: ${aspirationList}.${existingVision ? ` They've started with: "${existingVision}".` : ''} Make it feel personal and inspiring. Do not use bullet points or headings — just flowing sentences.`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const anthropicStream = client.messages.stream({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
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
