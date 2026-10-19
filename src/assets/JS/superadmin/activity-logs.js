import { supabase } from '@/utils/supabase.js';
export default {
  name: 'ActivityLogs', data: () => ({ logs: [], currentPage: 1, pageSize: 9, searchQuery: '', selectedActor: 'all', selectedAction: 'all', selectedRole: 'all', selectedTime: 'all', errorMessage: '' }),
  computed: {
    actors() {
      const actors = new Map();
      for (const log of this.logs) {
        const id = log.actor_id || 'system';
        if (!actors.has(id)) actors.set(id, { id, name: this.actorName(log), username: log.actor_username });
      }
      const names = new Map();
      for (const actor of actors.values()) names.set(actor.name, (names.get(actor.name) || 0) + 1);
      return [...actors.values()].map(actor => ({
        id: actor.id,
        label: names.get(actor.name) > 1 ? actor.name + ' (' + (actor.username || actor.id) + ')' : actor.name,
      })).sort((a, b) => a.label.localeCompare(b.label));
    },
    actions() { return [...new Set(this.logs.map(log => log.action).filter(Boolean))].sort(); },
    roles() { return [...new Set(this.logs.map(log => log.actor_role).filter(Boolean))].sort(); },
    filteredLogs() { const q = this.searchQuery.trim().toLowerCase(), now = Date.now(), ranges = { today: 86400000, week: 604800000, month: 2592000000 }; return this.logs.filter(log => (!q || [log.action, log.entity_type, log.entity_id, log.actor_full_name, log.actor_username, log.actor_role, log.ip_address].join(' ').toLowerCase().includes(q)) && (this.selectedActor === 'all' || (log.actor_id || 'system') === this.selectedActor) && (this.selectedAction === 'all' || log.action === this.selectedAction) && (this.selectedRole === 'all' || log.actor_role === this.selectedRole) && (this.selectedTime === 'all' || now - new Date(log.created_at).getTime() <= ranges[this.selectedTime])); },
    paginatedLogs() { const start = (this.currentPage - 1) * this.pageSize; return this.filteredLogs.slice(start, start + this.pageSize); }, pageCount() { return Math.max(1, Math.ceil(this.filteredLogs.length / this.pageSize)); }, pageStart() { return this.filteredLogs.length ? (this.currentPage - 1) * this.pageSize + 1 : 0; }, pageEnd() { return Math.min(this.currentPage * this.pageSize, this.filteredLogs.length); }
  },
  watch: { searchQuery() { this.currentPage = 1; }, selectedActor() { this.currentPage = 1; }, selectedAction() { this.currentPage = 1; }, selectedRole() { this.currentPage = 1; }, selectedTime() { this.currentPage = 1; } },
  mounted() { this.loadLogs(); }, methods: { actorName(log) { return log.actor_full_name?.trim() || log.actor_username?.trim() || 'System'; }, async loadLogs() { const { data, error } = await supabase.rpc('get_audit_logs', { p_limit: 100 }); if (error) this.errorMessage = error.message || 'Unable to load activity logs.'; else { this.logs = data || []; this.currentPage = 1; } }, formatDate(value) { return value ? new Date(value).toLocaleString() : '—'; } }
};
