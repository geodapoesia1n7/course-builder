import {env} from '@/env.mjs'
import z from 'zod'
import {inngest} from '@/inngest/inngest.server'
import {TRANSCRIPT_READY_EVENT} from '@/inngest/events/transcript-requested'
import {MUX_SRT_READY_EVENT} from '@/inngest/events/mux-add-srt-to-asset'
import {sanityMutation, sanityQuery} from '@/server/sanity.server'

export const VideoResourceSchema = z.object({
  _id: z.string(),
  muxPlaybackId: z.string().optional(),
  muxAssetId: z.string().optional(),
  transcript: z.string().optional(),
  srt: z.string().optional(),
  state: z.enum(['new', 'processing', 'preparing', 'ready', 'errored']),
})

export type VideoResource = z.infer<typeof VideoResourceSchema>

export const transcriptReady = inngest.createFunction(
  {id: `transcript-ready`, name: 'Transcript Ready'},
  {event: TRANSCRIPT_READY_EVENT},
  async ({event, step}) => {
    const videoResource = await step.run(
      'get the video resource from Sanity',
      async () => {
        const resourceTemp = VideoResourceSchema.safeParse(
          await sanityQuery(
            `*[_type == "videoResource" && _id == "${event.data.videoResourceId}"][0]`,
          ),
        )
        return resourceTemp.success ? resourceTemp.data : null
      },
    )

    if (videoResource) {
      await step.run('update the video resource in Sanity', async () => {
        return await sanityMutation([
          {
            patch: {
              id: videoResource._id,
              set: {
                srt: event.data.srt,
                transcript: event.data.transcript,
                state: `ready`,
              },
            },
          },
        ])
      })

      await step.sendEvent('announce that srt is ready', {
        name: MUX_SRT_READY_EVENT,
        data: {
          videoResourceId: videoResource._id,
          moduleSlug: event.data.moduleSlug,
          srt: event.data.srt,
        },
      })
    }

    await step.run('send the transcript to the party', async () => {
      await fetch(
        `${env.NEXT_PUBLIC_PARTY_KIT_URL}/party/${env.NEXT_PUBLIC_PARTYKIT_ROOM_NAME}`,
        {
          method: 'POST',
          body: JSON.stringify({
            body: event.data.transcript,
            requestId: event.data.videoResourceId,
            name: 'transcript.ready',
          }),
        },
      ).catch((e) => {
        console.error(e)
      })
    })

    return event.data
  },
)
