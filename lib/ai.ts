const DO_AI_BASE_URL = 'https://inference.do-ai.run/v1'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIChatRequest {
  model?: string
  nextModel?: string
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
}

export interface AIChatResponse {
  id: string
  model: string
  choices: {
    index: number
    message: ChatMessage
    finishReason: string
  }[]
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  fallback: boolean
}

async function tryModel(
  model: string,
  request: AIChatRequest,
  apiKey: string,
): Promise<{ ok: true; data: AIChatResponse } | { ok: false; status: number; body: string }> {
  const res = await fetch(`${DO_AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: request.messages,
      max_tokens: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.7,
    }),
  })

  if (!res.ok) {
    return { ok: false, status: res.status, body: await res.text() }
  }

  const data = await res.json()
  return {
    ok: true,
    data: {
      id: data.id,
      model: data.model,
      choices: data.choices.map((c: any) => ({
        index: c.index,
        message: c.message,
        finishReason: c.finish_reason,
      })),
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      fallback: false,
    },
  }
}

export async function chatCompletion(
  request: AIChatRequest,
): Promise<AIChatResponse> {
  const apiKey = process.env.DIGITALOCEAN_AI_API_KEY
  if (!apiKey) {
    throw new Error('AI API key not configured')
  }

  const primary = request.model ?? 'deepseek-4-flash'
  const fallback = request.nextModel

  const primaryResult = await tryModel(primary, request, apiKey)

  if (primaryResult.ok) {
    return primaryResult.data
  }

  if (primaryResult.status === 429 && fallback) {
    const fallbackResult = await tryModel(fallback, request, apiKey)
    if (fallbackResult.ok) {
      return { ...fallbackResult.data, fallback: true }
    }
    throw new Error(`AI API error (${fallbackResult.status}): ${fallbackResult.body}`)
  }

  throw new Error(`AI API error (${primaryResult.status}): ${primaryResult.body}`)
}

export const FREE_DAILY_USD_LIMIT = 2.50
export const MIN_CHARGE_PER_REQUEST = 0.0001

export const AI_MODELS = [
  {
    id: 'deepseek-4-flash',
    name: 'DeepSeek V4 Flash',
    provider: 'DeepSeek',
    inputPricePer1M: 0.112,
    outputPricePer1M: 0.224,
  },
  {
    id: 'alibaba-qwen3-32b',
    name: 'Qwen3 32B',
    provider: 'Alibaba',
    inputPricePer1M: 0.25,
    outputPricePer1M: 0.55,
  },
] as const

export function calculateCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const model = AI_MODELS.find((m) => m.id === modelId)
  if (!model) return 0.001
  const raw = (
    (promptTokens / 1_000_000) * model.inputPricePer1M +
    (completionTokens / 1_000_000) * model.outputPricePer1M
  )
  return Math.max(raw, MIN_CHARGE_PER_REQUEST)
}
