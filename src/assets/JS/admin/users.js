import { supabase } from '@/utils/supabase.js';
export default {
  data: () => ({ users: [], search: '', status: 'all', currentPage: 1, pageSize: 5, message: '', editing: null, editForm: {}, deleteTarget: null, deleteReason: '' }),
  computed: { filtered() { const q=this.search.toLowerCase().trim(); return this.users.filter(u => (!q || [u.id_number,u.username,u.email].some(v=>String(v||'').toLowerCase().includes(q))) && (this.status==='all'||this.userStatus(u)===this.status)); }, pageCount() { return Math.max(1, Math.ceil(this.filtered.length / this.pageSize)); }, paginatedUsers() { return this.filtered.slice((this.currentPage-1)*this.pageSize, this.currentPage*this.pageSize); }, pageNumbers() { return Array.from({length:this.pageCount},(_,i)=>i+1); }, pageStart() { return this.filtered.length ? (this.currentPage-1)*this.pageSize+1 : 0; }, pageEnd() { return Math.min(this.currentPage*this.pageSize,this.filtered.length); } },
  watch: { search() { this.currentPage=1; }, status() { this.currentPage=1; } },
  mounted() { this.load(); },
  methods: {
    async load() { const {data,error}=await supabase.rpc('get_admin_users'); if(error)this.message=error.message; else this.users=data||[]; },
    userStatus(u) { return u.registration_status==='pending'?'pending':(u.registration_status==='blocked'||u.is_locked_out?'blocked':'active'); },
    async setStatus(u,status) { const {error}=await supabase.rpc('admin_update_user_status',{p_user_id:u.user_id,p_status:status}); if(error)this.message=error.message; else await this.load(); },
    async edit(u) { const {data,error}=await supabase.rpc('get_user_for_admin_edit',{p_user_id:u.user_id}); if(error)this.message=error.message; else { this.editing=u; this.editForm={...data}; } },
    async saveEdit() { const {error}=await supabase.rpc('admin_update_user_profile',{p_user_id:this.editing.user_id,p_id_number:this.editForm.id_number,p_username:this.editForm.username,p_email:this.editForm.email}); if(error)this.message=error.message; else {this.editing=null; await this.load();} },
    requestDelete(u) { this.deleteTarget=u; this.deleteReason=''; },
    async submitDelete() { const {error}=await supabase.rpc('create_delete_request',{p_user_id:this.deleteTarget.user_id,p_reason:this.deleteReason.trim()}); if(error)this.message=error.message; else this.message='Deletion request sent to the Superadmin.'; this.deleteTarget=null; }
  }
};
