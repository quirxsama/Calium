'use client'

import type { ImageLoaderProps } from 'next/image'

const BYPASS_HOSTS = [
  'anizium.co',
  'anizium.com',
  'anizium.net',
  'anizium.org',
  'imgur.com',
]

function shouldBypass(src: string): boolean {
  try {
    const url = new URL(src)
    return BYPASS_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith('.' + host)
    )
  } catch {
    return false
  }
}

export default function safeImageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps): string {
  if (shouldBypass(src)) {
    return src
  }

  const params = new URLSearchParams()
  params.set('url', src)
  params.set('w', width.toString())
  params.set('q', String(quality ?? 75))
  return `/_next/image?${params.toString()}`
}
