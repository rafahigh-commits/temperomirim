INSERT INTO public.profiles (id, full_name, email, active)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name', ''),
       COALESCE(u.email, ''),
       true
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;