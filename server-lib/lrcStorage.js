import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { basename } from 'path'

const AWS_REGION = process.env.AWS_REGION ?? 'eu-west-1'
const BUCKET = process.env.LRC_BUCKET

const s3 = new S3Client({ region: AWS_REGION })

export function sanitizeLrcName(name) {
  const raw = String(name || '').trim()
  if (!raw) throw new Error('Nombre de archivo inválido')
  // reemplaza separadores de ruta (no los usa como límite: "AC/DC" no debe truncarse a "DC")
  const noSlashes = raw.replace(/[\\/]+/g, '-')
  const safe = basename(noSlashes).replace(/[^\w.\- ]+/g, '_')
  if (!safe) throw new Error('Nombre de archivo inválido')
  return /\.lrc$/i.test(safe) ? safe : `${safe}.lrc`
}

export async function listSavedLrc() {
  const { Contents } = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET }))
  return (Contents ?? [])
    .filter((o) => o.Key.endsWith('.lrc'))
    .sort((a, b) => b.LastModified - a.LastModified)
    .map((o) => o.Key)
}

export async function readLrc(name) {
  const safeName = sanitizeLrcName(name)
  try {
    const { Body } = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: safeName }))
    return await Body.transformToString('utf-8')
  } catch (e) {
    if (e.name === 'NoSuchKey') return null
    throw e
  }
}

export async function lrcExists(name) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: name }))
    return true
  } catch (e) {
    if (e.name === 'NotFound') return false
    throw e
  }
}

export async function writeLrc(name, content) {
  const safeName = sanitizeLrcName(name)
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: safeName,
    Body: content ?? '',
    ContentType: 'text/plain; charset=utf-8',
  }))
  return safeName
}
