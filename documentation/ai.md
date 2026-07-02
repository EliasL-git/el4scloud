## AI Chat

OpenAI-compatible streaming chat completions powered by DigitalOcean's Serverless Inference API. Restricted to Hack Club students.

### List models

```
GET /api/ai/v1/models
```

#### Response

```json
{
  "object": "list",
  "data": [
    { "id": "deepseek-4-flash", "object": "model", "created": 1746211200, "owned_by": "DeepSeek" },
    { "id": "alibaba-qwen3-32b", "object": "model", "created": 1746211200, "owned_by": "Alibaba" }
  ]
}
```

---

### Chat completions

```
POST /api/ai/v1/chat/completions
Authorization: Bearer <api-key>
Content-Type: application/json
```

#### Request body

| Field | Type | Default | Description |
|---|---|---|---|
| `model` | string | `deepseek-4-flash` | Model ID |
| `messages` | `{ role, content }[]` | — | Chat history |
| `stream` | boolean | `true` | Stream tokens via SSE |
| `max_tokens` | number | `2048` | Max completion tokens |
| `temperature` | number | `0.7` | Sampling temperature |

#### Models

| ID | Name |
|---|---|
| `deepseek-4-flash` | DeepSeek V4 Flash |
| `alibaba-qwen3-32b` | Qwen3 32B |

On 429 (model overloaded), falls back to the next model in the list automatically.

#### Streaming response (`stream: true`)

Returns SSE (`text/event-stream`). Each event is a JSON line prefixed with `data: `:

```
data: {"id":"...","object":"chat.completion.chunk","choices":[{"delta":{"role":"assistant"},"index":0}]}
data: {"id":"...","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hello"},"index":0}]}
data: {"id":"...","object":"chat.completion.chunk","choices":[{"delta":{"content":"!"},"index":0}]}
```

Before `[DONE]`, a metadata event is sent:

```json
data: {"_meta":true,"_cost":0.000168,"_usedToday":0.000168,"_limit":2.50,"_fallback":false,"_model":"deepseek-4-flash"}
```

The stream ends with:

```
data: [DONE]
```

#### Non-streaming response (`stream: false`)

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1746211200,
  "model": "deepseek-4-flash",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "Hello!" },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15
  },
  "_cost": 0.000168,
  "_usedToday": 0.000168,
  "_limit": 2.50
}
```

#### Reading the stream (JavaScript)

```js
const res = await fetch('https://cloud.el4s.dev/api/ai/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sk_4f1e...' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Hello!' }],
    model: 'deepseek-4-flash',
    stream: true,
  }),
})

const reader = res.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  const text = decoder.decode(value, { stream: true })
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const data = line.slice(6)
    if (data === '[DONE]') break
    const parsed = JSON.parse(data)
    if (parsed._meta) {
      console.log(`Charged $${parsed._cost}, daily: $${parsed._usedToday}/$${parsed._limit}`)
      continue
    }
    const content = parsed.choices?.[0]?.delta?.content
    if (content) process.stdout.write(content)
  }
}
```

#### Using the OpenAI JS SDK

```js
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'https://cloud.el4s.dev/api/ai/v1',
  apiKey: 'sk_4f1e...',
})

const stream = await client.chat.completions.create({
  model: 'deepseek-4-flash',
  messages: [{ role: 'user', content: 'Hello!' }],
  stream: true,
})

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '')
}
```

#### Errors

| Status | Meaning |
|---|---|
| `401` | Missing or invalid auth |
| `403` | Not a Hack Club student |
| `429` | Daily budget exhausted |

Non-streaming errors return a JSON body:

```json
{ "error": "Only Hack Club students can access AI features." }
```
