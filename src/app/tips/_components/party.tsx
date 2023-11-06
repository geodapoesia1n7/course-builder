"use client"

import {useSocket} from "@/hooks/use-socket";
import {api} from "@/trpc/react";
import {useRouter} from "next/navigation";

export function Party() {
  const utils = api.useUtils()
  const router = useRouter()
  useSocket({
    onMessage: async (messageEvent) => {
      const data = JSON.parse(messageEvent.data)
      const invalidateOn = ['videoResource.created', 'video.asset.ready', 'transcript.ready', 'ai.tip.draft.completed']

      if(invalidateOn.includes(data.name)) {
        await utils.module.getBySlug.invalidate({slug: 'tips'})
        router.refresh()
      }
    }
  })

  return null
}