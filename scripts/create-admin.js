// scripts/create-admin.js
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdmin() {
  console.log('🔐 Creating admin user...');
  
  try {
    // Create user
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'admin@school.com',
      password: 'admin123',
      email_confirm: true,
      user_metadata: {
        name: 'Administrator'
      }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        console.log('✅ User already exists');
        return;
      }
      console.error('❌ Error:', error.message);
      return;
    }

    console.log('✅ User created:', data.user?.email);

    // Create profile
    if (data.user) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: data.user.id,
          email: 'admin@school.com',
          name: 'Administrator',
          role: 'admin'
        });

      if (profileError) {
        console.error('❌ Profile error:', profileError.message);
      } else {
        console.log('✅ Admin profile created');
      }
    }

    console.log('\n📋 Credentials:');
    console.log('  Email: admin@school.com');
    console.log('  Password: admin123');
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

createAdmin();