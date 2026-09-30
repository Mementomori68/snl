// Подключение к Supabase
const SUPABASE_URL = 'https://mwnanyuukoidlabekeft.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5VPoVOjqVFGxqE9bzm6Dyw_Tu-URxXU';

// Клиент Supabase
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);