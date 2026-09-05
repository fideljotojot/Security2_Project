import { supabase } from '@/utils/supabase.js';
export default {
  name: 'ActivityLogs', data: () => ({ logs: [], currentPage: 1, pageSize: 12, searchQuery: '', selectedActor: 'all', selectedAction: 'all', selectedRole: 'all', selectedTime: 'all', errorMessage: '' }),
  computed: {
    actors() { return [...new Set(this.logs.map(log => log.actor_username).filter(Boolean))].sort(); },
    actions() { return [...new Set(this.logs.map(log => log.action).filter(Boolean))].sort(); },
    roles() { return [...new Set(this.logs.map(log => log.actor_role).filter(Boolean))].sort(); },
    filteredLogs() { const q = this.searchQuery.trim().toLowerCase(), now = Date.now(), ranges = { today: 86400000, week: 604800000, month: 2592000000 }; return this.logs.filter(log => (!q || [log.action, log.entity_type, log.entity_id, log.actor_username, log.actor_role].join(' ').toLowerCase().includes(q)) && (this.selectedActor === 'all' || log.actor_username === this.selectedActor) && (this.selectedAction === 'all' || log.action === this.selectedAction) && (this.selectedRole === 'all' || log.actor_role === this.selectedRole) && (this.selectedTime === 'all' || now - new Date(log.created_at).getTime() <= ranges[this.selectedTime])); },
    paginatedLogs() { const start = (this.currentPage - 1) * this.pageSize; return this.filteredLogs.slice(start, start + this.pageSize); }, pageCount() { return Math.max(1, Math.ceil(this.filteredLogs.length / this.pageSize)); }, pageStart() { return this.filteredLogs.length ? (this.currentPage - 1) * this.pageSize + 1 : 0; }, pageEnd() { return Math.min(this.currentPage * this.pageSize, this.filteredLogs.length); }
  },
  watch: { searchQuery() { this.currentPage = 1; }, selectedActor() { this.currentPage = 1; }, selectedAction() { this.currentPage = 1; }, selectedRole() { this.currentPage = 1; }, selectedTime() { this.currentPage = 1; } },
  mounted() { this.loadLogs(); }, methods: { async loadLogs() { const { data, error } = await supabase.rpc('get_audit_logs', { p_limit: 100 }); if (error) this.errorMessage = error.message || 'Unable to load activity logs.'; else { this.logs = data || []; this.currentPage = 1; } }, formatDate(value) { return value ? new Date(value).toLocaleString() : '—'; } }
};
