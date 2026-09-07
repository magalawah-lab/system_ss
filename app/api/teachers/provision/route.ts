import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '../../../lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

type ProvisionTeacherRequest = {
  email?: string;
  name?: string;
  password?: string;
};

export async function POST(request: Request) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Teacher login provisioning is not configured.' }, { status: 503 });
  }

  // Only school administrators may create or reset teacher credentials.
  const sessionClient = await createServerClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to manage teacher logins.' }, { status: 401 });
  }

  const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile } = await adminClient
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Only administrators can manage teacher logins.' }, { status: 403 });
  }

  let body: ProvisionTeacherRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();
  const password = body.password?.trim() || 'password123';
  if (!email || !name) {
    return NextResponse.json({ error: 'A teacher name and email are required for login.' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'The password must be at least 6 characters.' }, { status: 400 });
  }

  const { data: users, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const existingUser = users.users.find((candidate) => candidate.email?.toLowerCase() === email);
  let authUser = existingUser;

  if (authUser) {
    const { data, error } = await adminClient.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: { ...authUser.user_metadata, name },
    });
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message || 'Could not update the teacher login.' }, { status: 400 });
    }
    authUser = data.user;
  } else {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message || 'Could not create the teacher login.' }, { status: 400 });
    }
    authUser = data.user;
  }

  const { error: profileError } = await adminClient.from('user_profiles').upsert({
    id: authUser.id,
    email,
    name,
    role: 'teacher',
  }, { onConflict: 'id' });
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
