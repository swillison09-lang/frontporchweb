// Online settings: the Front Porch Web Supabase project (same project and public key the
// site's blog embed uses). The publishable key can only do what the database rules allow;
// for Glass that is the live room messaging, plus uploads for a signed-in owner account.
// Leave both empty to run without Supabase (server.py on your Wi-Fi, or one browser).
window.GLASS_CONFIG = {
  supabaseUrl: 'https://hxxtsthfqwyvkyuwnnsu.supabase.co',
  supabaseAnonKey: 'sb_publishable_PfXE01_bSpA1CnTKg7nbHA_5w7_iJJR',
  bucket: 'glass',      // Storage bucket for photos and videos (see glass-setup.sql)
  maxUploadMB: 50,
};
