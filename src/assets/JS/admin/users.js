import { supabase } from '@/utils/supabase.js';
import { confirmCurrentPassword } from '@/utils/confirm-password.js';
export default {
  data: () => ({ users: [], currentUserId: null, viewerPermissions: [], openActionsUserId: null, search: '', status: 'all', selectedRole: 'all', selectedPosition: 'all', sortOrder: '', currentPage: 1, pageSize: 10, message: '', notificationTitle: '', notificationType: 'success', notificationMessage: '', editing: null, viewing: false, editForm: {}, editStep: 'personal', deleteTarget: null, deleteReason: '', showPasswordModal: false, confirmationPassword: '', showConfirmationPassword: false, isConfirmingPassword: false }),
  computed: { filtered() { const q = this.search.toLowerCase().trim(); const result = this.users.filter(u => (!q || [u.id_number, u.username, u.email].some(v => String(v || '').toLowerCase().includes(q))) && (this.status === 'all' || this.userStatus(u) === this.status) && (this.selectedRole === 'all' || u.role === this.selectedRole)); if (!this.sortOrder) return result; const direction = this.sortOrder === 'descending' ? -1 : 1; return result.sort((a, b) => (Number(String(a.id_number || '').replace(/\D/g, '')) - Number(String(b.id_number || '').replace(/\D/g, ''))) * direction); }, pageCount() { return Math.max(1, Math.ceil(this.filtered.length / this.pageSize)); }, paginatedUsers() { return this.filtered.slice((this.currentPage - 1) * this.pageSize, this.currentPage * this.pageSize); }, pageNumbers() { return Array.from({ length: this.pageCount }, (_, i) => i + 1); }, pageStart() { return this.filtered.length ? (this.currentPage - 1) * this.pageSize + 1 : 0; }, pageEnd() { return Math.min(this.currentPage * this.pageSize, this.filtered.length); } },
  watch: { search() { this.currentPage = 1; }, status() { this.currentPage = 1; }, selectedRole() { this.currentPage = 1; }, sortOrder() { this.currentPage = 1; } },
  async mounted() { const { data: { user } } = await supabase.auth.getUser(); this.currentUserId = user?.id || null; if (user) { const { data: account } = await supabase.from('users').select('admin_permissions').eq('id', user.id).single(); this.viewerPermissions = Array.isArray(account?.admin_permissions) && account.admin_permissions.length ? account.admin_permissions : ['manage_account_info', 'block_accounts', 'reset_passwords', 'delete_accounts']; } this.load(); },
  beforeUnmount() { document.removeEventListener('click', this.closeActionsMenuOnOutside); document.removeEventListener('keydown', this.closeActionsMenuOnEscape); },
  methods: {
    isEditingSelf() { return Boolean(this.editing && this.editing.user_id === this.currentUserId); },
    toggleActionsMenu(userId) { this.openActionsUserId = this.openActionsUserId === userId ? null : userId; },
    runAction(action) { this.openActionsUserId = null; return action(); },
    closeActionsMenuOnOutside(event) { if (!event.target.closest('.actions-menu')) this.openActionsUserId = null; },
    closeActionsMenuOnEscape(event) { if (event.key === 'Escape') this.openActionsUserId = null; },
    async load() { const { data, error } = await supabase.rpc('get_admin_users'); if (error) this.message = error.message; else this.users = (data || []).filter(u => u.role !== 'superadmin'); },
    userStatus(u) { return u.registration_status === 'pending' ? 'pending' : (u.registration_status === 'incomplete' ? 'incomplete' : (u.registration_status === 'inactive' ? 'inactive' : (u.registration_status === 'blocked' || u.is_locked_out ? 'blocked' : 'active'))); },
    hasPermission(u, permission) { return u?.role !== 'superadmin' && this.viewerPermissions.includes(permission); },
    async setStatus(u, status) { if (!u || this.userStatus(u) === 'incomplete') return; if (!await confirmCurrentPassword('Enter your password to block or unblock this account:')) return; const { error } = await supabase.rpc('admin_update_user_status', { p_user_id: u.user_id, p_status: status }); if (error) this.message = error.message; else await this.load(); },
    async view(u) { const { data, error } = await supabase.rpc('get_full_user_for_admin_edit', { p_user_id: u.user_id }); if (error) this.message = error.message; else { this.editing = u; this.viewing = true; this.editForm = { ...data, password: '', repassword: '' }; this.editStep = 'personal'; } },
    async edit(u) { if (!u || u.role === 'superadmin' || ['incomplete', 'blocked'].includes(this.userStatus(u))) return; const { data, error } = await supabase.rpc('get_full_user_for_admin_edit', { p_user_id: u.user_id }); if (error) this.message = error.message; else { this.editing = u; this.viewing = false; this.editForm = { ...data, password: '', repassword: '' }; this.editStep = 'personal'; } },
    nextEditStep() { this.editStep = 'account'; },
    previousEditStep() { this.editStep = 'personal'; },
    normalizePosition() {
      if (this.isEditingSelf()) return;
      if (!arguments.length) return;
      this.editForm.position = this.editForm.role === 'user' ? 'Student' : 'Staff';
    },
    validatePosition(evt) {
      const value = String((evt?.target?.value ?? this.editForm.position ?? '')).trim();
      if (this.editForm.role === 'user' && !value) {
        this.message = 'Position is required for user accounts.';
      } else {
        this.message = '';
      }
    },
    async saveEdit() { const f = this.editForm; this.normalizePosition(); const canResetPassword = this.hasPermission(this.editing, 'reset_passwords'); if (f.role === 'user' && !String(f.position || '').trim()) { this.message = 'Position is required for user accounts.'; return; } if (!canResetPassword) { f.password = ''; f.repassword = ''; } if (f.password !== f.repassword) { this.message = 'Passwords do not match.'; return; } const { error } = await supabase.rpc('update_full_user_by_admin', { p_user_id: this.editing.user_id, p_id_number: f.id_number, p_username: f.username, p_email: f.email, p_first_name: f.first_name, p_middle_initial: f.middle_initial || '', p_last_name: f.last_name, p_suffix: f.suffix || '', p_birthdate: f.birthdate || null, p_age: f.age ? parseInt(f.age, 10) : null, p_sex: f.sex, p_purok: f.purok || '', p_barangay: f.barangay || '', p_city: f.city || '', p_province: f.province || '', p_country: f.country || '', p_zip: String(f.zip || ''), p_role: f.role, p_position: f.role === 'user' ? (f.position || '') : null, p_password: f.password || null }); if (error) this.message = error.message; else { this.editing = null; await this.load(); } },
    beginSaveEdit() { this.confirmationPassword = ''; this.showConfirmationPassword = false; this.showPasswordModal = true; },
    closePasswordModal() { if (!this.isConfirmingPassword) this.showPasswordModal = false; },
    async confirmSaveEdit() { if (!this.confirmationPassword || this.isConfirmingPassword) return; this.isConfirmingPassword = true; const { data: { user }, error: userError } = await supabase.auth.getUser(); const { error } = userError || !user?.email ? { error: userError || new Error('Unable to identify the signed-in user.') } : await supabase.auth.signInWithPassword({ email: user.email, password: this.confirmationPassword }); this.isConfirmingPassword = false; if (error) { this.message = 'Incorrect password. Changes were not saved.'; return; } this.showPasswordModal = false; await this.saveEdit(); },
    requestDelete(u) { if (!u || u.role === 'superadmin') return; this.deleteTarget = { ...u }; this.deleteReason = ''; },
    async submitDelete() { const target = this.deleteTarget; const reason = this.deleteReason.trim(); if (!target || target.role === 'superadmin') return; if (!reason) { this.notificationTitle = 'Reason Required'; this.notificationType = 'error'; this.notificationMessage = 'A deletion reason is required.'; return; } const { error } = await supabase.rpc('create_delete_request', { p_user_id: target.user_id, p_reason: reason }); if (error) this.message = error.message; else { this.notificationTitle = 'Request Sent'; this.notificationType = 'success'; this.notificationMessage = 'Deletion request sent to the Superadmin.'; } this.deleteTarget = null; }
  }
};
