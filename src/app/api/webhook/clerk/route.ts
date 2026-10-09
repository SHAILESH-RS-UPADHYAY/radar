import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { createServerClient } from '@/lib/supabase/client';
import { serverError } from '@/lib/api';

// Clerk → Supabase user sync. Clerk retries failed deliveries for hours, so every branch is
// idempotent, and a 5xx is returned only when a retry could help.
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let evt: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    evt = await verifyWebhook(req);
  } catch (error) {
    console.error('[WEBHOOK] Verification failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 });
  }

  const supabase = createServerClient();

  if (evt.type === 'user.created' || evt.type === 'user.updated') {
    const { id, email_addresses, first_name, last_name, phone_numbers } = evt.data;
    // Identity only. Preferences belong to onboarding, and a late retry must never reset them;
    // a brand-new row takes the table defaults for everything else.
    const { error } = await supabase.from('user_profiles').upsert(
      {
        id,
        email: email_addresses?.[0]?.email_address || null,
        phone: phone_numbers?.[0]?.phone_number || null,
        full_name: [first_name, last_name].filter(Boolean).join(' ') || null,
      },
      { onConflict: 'id' },
    );
    if (error) {
      console.error('[WEBHOOK]', evt.type, 'failed:', error.message);
      return serverError('API /webhook/clerk', error);
    }
    return NextResponse.json({ success: true });
  }

  if (evt.type === 'user.deleted') {
    // Removes the resume and preferences; dream companies and matches go with it (ON DELETE CASCADE).
    if (evt.data.id) {
      const { error } = await supabase.from('user_profiles').delete().eq('id', evt.data.id);
      if (error) {
        console.error('[WEBHOOK] user.deleted failed:', error.message);
        return serverError('API /webhook/clerk', error);
      }
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ received: true });
}
