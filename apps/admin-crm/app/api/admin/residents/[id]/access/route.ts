import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminSessionCookieName, getActiveSignedAdminSession } from '@/lib/admin-session';
import { rejectCrossOriginMutation } from '@/lib/request-security';
export async function PATCH(request: NextRequest, context: {
    params: Promise<{
        id: string;
    }>;
}) {
    const originError = rejectCrossOriginMutation(request);
    if (originError)
        return originError;
    const session = await getActiveSignedAdminSession(request.cookies.get(adminSessionCookieName)?.value ?? '');
    if (!session || session.role !== 'admin')
        return NextResponse.json({ message: 'Only active administrators can change resident access.' }, { status: 403 });
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
        return NextResponse.json({ message: 'Invalid resident id.' }, { status: 400 });
    const payload = await request.json().catch(() => null) as {
        expectedState?: unknown;
        nextState?: unknown;
        reason?: unknown;
    } | null;
    if (!payload || !['active', 'suspended'].includes(String(payload.expectedState)) || !['active', 'suspended'].includes(String(payload.nextState)) || typeof payload.reason !== 'string' || !payload.reason.trim() || payload.reason.trim().length > 500)
        return NextResponse.json({ message: 'Choose an access state and provide a reason (1–500 characters).' }, { status: 400 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
        return NextResponse.json({ message: 'Missing server configuration.' }, { status: 500 });
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: resident, error: residentError } = await client.from('residents').select('user_id,id').eq('id', id).maybeSingle();
    if (residentError || !resident)
        return NextResponse.json({ message: 'Resident account not found.' }, { status: 404 });
    const { error } = await client.rpc('set_resident_account_access', {
        p_user_id: resident.user_id || resident.id, p_actor_id: session.userId,
        p_expected_state: payload.expectedState, p_next_state: payload.nextState, p_reason: payload.reason.trim(),
    });
    if (error)
        return NextResponse.json({ message: error.code === 'PGRST202' ? 'Apply the account-management migration in the test project first.' : error.message }, { status: error.code === '40001' ? 409 : 400 });
    return NextResponse.json({ updated: true });
}
