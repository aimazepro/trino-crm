// Media storage for WhatsApp attachments.
//
// Supabase Storage today; the whole surface is these two functions plus a
// bucket name, so moving to R2 later is one file. Objects live at
// "<workspace owner uid>/<conversation id>/<uuid>.<ext>" — the leading folder
// is what the storage RLS policy checks.

import type { SupabaseClient } from "@supabase/supabase-js";

export const MEDIA_BUCKET = "whatsapp-media";

/** Signed URLs are minted on read; nothing in this bucket is public. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function putMedia(
  admin: SupabaseClient,
  params: {
    ownerId: string;
    conversationId: string;
    data: Buffer;
    mimetype: string;
    filename: string;
  },
): Promise<string> {
  const extension = params.filename.includes(".")
    ? params.filename.split(".").pop()!.slice(0, 8)
    : "bin";
  const path = `${params.ownerId}/${params.conversationId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await admin.storage.from(MEDIA_BUCKET).upload(path, params.data, {
    contentType: params.mimetype,
    upsert: false,
  });
  if (error) throw new Error(`media upload failed: ${error.message}`);

  return path;
}

export async function getMediaSignedUrl(
  client: SupabaseClient,
  path: string,
): Promise<string | null> {
  const { data, error } = await client.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data?.signedUrl ?? null;
}
