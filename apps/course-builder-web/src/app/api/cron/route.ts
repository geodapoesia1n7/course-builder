export async function GET() {
  await fetch(`${process.env.NEXT_PUBLIC_URL}/api/inngest`, {
    method: 'PUT',
  })
  return new Response(null, {
    status: 200,
  })
}