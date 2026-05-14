// ============================
// RADAR — Clerk Webhook Handler
// ============================
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType = body.type;

    if (eventType === 'user.created') {
      const { id, email_addresses, first_name, last_name, phone_numbers } = body.data;
      const supabase = createServerClient();
      const email = email_addresses?.[0]?.email_address || null;
      const phone = phone_numbers?.[0]?.phone_number || null;
      const fullName = [first_name, last_name].filter(Boolean).join(' ') || null;

      const { error } = await supabase.from('user_profiles').upsert({
        id, email, phone, full_name: fullName,
        is_fresher: true, experience_years: 0, skills: [], country: 'India', tier: 'free',
      }, { onConflict: 'id' });

      if (error) {
        console.error('[WEBHOOK] Error creating user profile:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      console.log('[WEBHOOK] Created profile for', email);
      return NextResponse.json({ success: true, userId: id });
    }

    if (eventType === 'user.updated') {
      const { id, email_addresses, first_name, last_name } = body.data;
      const supabase = createServerClient();
      await supabase.from('user_profiles').update({
        email: email_addresses?.[0]?.email_address || null,
        full_name: [first_name, last_name].filter(Boolean).join(' ') || null,
      }).eq('id', id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[WEBHOOK] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
