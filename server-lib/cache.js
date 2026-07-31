import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

const AWS_REGION = process.env.AWS_REGION ?? 'eu-west-1'
const TABLE_NAME = process.env.DYNAMODB_TABLE

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }))

export async function getCached(phrase) {
  const { Item } = await client.send(new GetCommand({ TableName: TABLE_NAME, Key: { phrase } }))
  return Item?.emojis ?? null
}

export async function setCached(phrase, emojis) {
  await client.send(new PutCommand({ TableName: TABLE_NAME, Item: { phrase, emojis } }))
}
