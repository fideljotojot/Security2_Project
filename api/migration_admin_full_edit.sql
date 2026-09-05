CREATE OR REPLACE FUNCTION public.get_full_user_for_admin_edit(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=auth.uid() AND role IN ('admin','superadmin')) THEN RAISE EXCEPTION 'Only administrators can edit users'; END IF;
  SELECT jsonb_build_object('user_id',u.id,'id_number',u.id_number,'username',u.username,'email',u.email,'role',u.role,'first_name',p.first_name,'middle_initial',p.middle_initial,'last_name',p.last_name,'suffix',p.suffix,'birthdate',p.birthdate,'age',p.age,'sex',p.sex,'purok',a.purok,'barangay',a.barangay,'city',a.city,'province',a.province,'country',a.country,'zip',a.zip) INTO result
  FROM public.users u JOIN public.profiles p ON p.user_id=u.id LEFT JOIN public.addresses a ON a.user_id=u.id WHERE u.id=p_user_id;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.update_full_user_by_admin(p_user_id UUID,p_id_number TEXT,p_username TEXT,p_email TEXT,p_first_name TEXT,p_middle_initial TEXT,p_last_name TEXT,p_suffix TEXT,p_birthdate DATE,p_age INT,p_sex TEXT,p_purok TEXT,p_barangay TEXT,p_city TEXT,p_province TEXT,p_country TEXT,p_zip TEXT,p_role TEXT,p_password TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=auth.uid() AND role IN ('admin','superadmin')) THEN RAISE EXCEPTION 'Only administrators can edit users'; END IF;
  IF p_role='superadmin' AND (SELECT role FROM public.users WHERE id=auth.uid())='admin' THEN RAISE EXCEPTION 'Administrators cannot assign the superadmin role'; END IF;
  IF p_role NOT IN ('user','admin','superadmin') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  UPDATE auth.users SET email=p_email, encrypted_password=CASE WHEN p_password IS NULL OR p_password='' THEN encrypted_password ELSE crypt(p_password,gen_salt('bf')) END WHERE id=p_user_id;
  UPDATE public.users SET id_number=p_id_number,username=p_username,email=p_email,role=p_role WHERE id=p_user_id;
  UPDATE public.profiles SET first_name=p_first_name,middle_initial=NULLIF(p_middle_initial,''),last_name=p_last_name,suffix=NULLIF(p_suffix,''),birthdate=p_birthdate,age=p_age,sex=p_sex WHERE user_id=p_user_id;
  UPDATE public.addresses SET purok=p_purok,barangay=p_barangay,city=p_city,province=p_province,country=p_country,zip=p_zip WHERE user_id=p_user_id;
  RETURN FOUND;
END; $$;
