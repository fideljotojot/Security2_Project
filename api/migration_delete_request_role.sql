-- Add target role to deletion requests for filtering in the superadmin UI.
DROP FUNCTION IF EXISTS public.get_delete_requests();
CREATE FUNCTION public.get_delete_requests()
RETURNS TABLE(request_id BIGINT,user_id UUID,id_number VARCHAR,username VARCHAR,email VARCHAR,role VARCHAR,first_name VARCHAR,middle_initial VARCHAR,last_name VARCHAR,suffix VARCHAR,birthdate DATE,age INT,sex VARCHAR,purok VARCHAR,barangay VARCHAR,city VARCHAR,province VARCHAR,country VARCHAR,zip VARCHAR,reason TEXT,requested_by UUID,created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users AS viewer WHERE viewer.id=auth.uid() AND viewer.role='superadmin') THEN RAISE EXCEPTION 'Only superadmins can view deletion requests'; END IF;
  RETURN QUERY SELECT d.id,u.id,u.id_number,u.username,u.email,u.role,p.first_name,p.middle_initial,p.last_name,p.suffix,p.birthdate,p.age,p.sex,a.purok,a.barangay,a.city,a.province,a.country,a.zip,d.reason,d.requested_by,d.created_at
  FROM public.delete_requests d JOIN public.users u ON u.id=d.user_id LEFT JOIN public.profiles p ON p.user_id=u.id LEFT JOIN public.addresses a ON a.user_id=u.id WHERE d.status='pending' ORDER BY d.created_at;
END; $$;
