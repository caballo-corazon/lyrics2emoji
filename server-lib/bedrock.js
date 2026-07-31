import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { getSystemPrompt, buildUserPrompt } from './prompt.js'

const AWS_REGION = process.env.AWS_REGION ?? 'eu-west-1'
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'eu.amazon.nova-micro-v1:0'

const bedrock = new BedrockRuntimeClient({ region: AWS_REGION })

export async function translateWithBedrock(text) {
  const { systemPrompt } = getSystemPrompt()
  const t0 = Date.now()
  console.log(`[bedrock] → "${text}"`)

  const res = await bedrock.send(new ConverseCommand({
    modelId: BEDROCK_MODEL_ID,
    system: [{ text: systemPrompt }],
    messages: [{ role: 'user', content: [{ text: buildUserPrompt(text) }] }],
    inferenceConfig: { maxTokens: 20 },
  }))

  const emojis = res.output.message.content[0].text.trim().split('\n')[0].trim()
  console.log(`[bedrock] ← "${text}" → ${emojis}  (${Date.now() - t0}ms)`)
  return emojis
}
