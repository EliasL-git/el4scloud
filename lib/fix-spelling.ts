export async function fixSpelling(text: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return text

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'You fix spelling and grammar mistakes in the given text. Return ONLY the corrected text with no explanation, no quotes, no prefix.',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 2048,
      temperature: 0.1,
    }),
  })

  if (!res.ok) {
    console.error('[fixSpelling] Groq API error:', await res.text())
    return text
  }

  const data = await res.json()
  return (data.choices?.[0]?.message?.content ?? text).trim()
}
