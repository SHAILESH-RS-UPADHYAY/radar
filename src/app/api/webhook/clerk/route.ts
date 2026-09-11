import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { createServerClient } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req);
    const eventType = evt.type;
    const supabase = createServerClient();

    if (eventType === 'user.created') {
      const { id, email_addresses, first_name, last_name, phone_numbers } = evt.data;
      const email = email_addresses?.[0]?.email_address || null;
      const phone = phone_numbers?.[0]?.phone_number || null;
      const fullName = [first_name, last_name].filter(Boolean).join(' ') || null;

      const { error } = await supabase.from('user_profiles').upsert(
        {
          id,
          email,
          phone,
          full_name: fullName,
          is_fresher: true,
          experience_years: 0,
          skills: [],
          country: 'India',
          tier: 'free',
        },
        { onConflict: 'id' },
      );

      if (error) {
        console.error('[WEBHOOK] Error creating user profile:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, userId: id });
    }

    if (eventType === 'user.updated') {
      const { id, email_addresses, first_name, last_name } = evt.data;
      await supabase
        .from('user_profiles')
        .update({
          email: email_addresses?.[0]?.email_address || null,
          full_name: [first_name, last_name].filter(Boolean).join(' ') || null,
        })
        .eq('id', id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[WEBHOOK] Error:', error);
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 });
  }
}
