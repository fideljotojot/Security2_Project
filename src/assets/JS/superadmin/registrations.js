import { supabase } from '@/utils/supabase.js';

export default {
  name: 'SuperadminRegistrations',
  data: () => ({ registrations: [], deleteRequests: [], registrationPage: 1, deletePage: 1, registrationPageSize: 5, deletePageSize: 5, isLoading: false, isUpdating: false, errorMessage: '' }),
  computed: {
    paginatedRegistrations() { return this.paginate(this.registrations, this.registrationPage); },
    paginatedDeleteRequests() { return this.paginate(this.deleteRequests, this.deletePage); }
  },
  mounted() { this.fetchRegistrations(); this.fetchDeleteRequests(); },
  methods: {
    async fetchRegistrations() {
      this.isLoading = true;
      const { data, error } = await supabase.rpc('get_pending_registrations');
      this.isLoading = false;
      if (error) this.errorMessage = error.message || 'Unable to load registrations.';
      else { this.errorMessage = ''; this.registrations = data || []; this.registrationPage = 1; }
    },
    async updateStatus(registration, status) {
      this.isUpdating = true;
      const { error } = await supabase.rpc('update_registration_status', {
        p_user_id: registration.user_id, p_status: status
      });
      this.isUpdating = false;
      if (error) this.errorMessage = error.message || 'Unable to update registration.';
      else await this.fetchRegistrations();
    },
    async fetchDeleteRequests() { const { data, error } = await supabase.rpc('get_delete_requests'); if (error) this.errorMessage = error.message; else { this.deleteRequests = data || []; this.deletePage = 1; } },
    pageSize(items) { return items === this.deleteRequests ? this.deletePageSize : this.registrationPageSize; },
    paginate(items, page) { const size = this.pageSize(items); return items.slice((page - 1) * size, page * size); },
    pageCount(items) { return Math.max(1, Math.ceil(items.length / this.pageSize(items))); },
    pageNumbers(items) { return Array.from({ length: this.pageCount(items) }, (_, index) => index + 1); },
    pageStart(items) { const page = items === this.registrations ? this.registrationPage : this.deletePage; return items.length ? (page - 1) * this.pageSize(items) + 1 : 0; },
    pageEnd(items) { const page = items === this.registrations ? this.registrationPage : this.deletePage; return Math.min(items.length, page * this.pageSize(items)); },
    async reviewDelete(request, approve) { if (approve && !window.confirm(`Delete ${request.username} permanently?`)) return; const { error } = await supabase.rpc('review_delete_request', { p_request_id: request.request_id, p_approve: approve }); if (error) this.errorMessage = error.message; else await this.fetchDeleteRequests(); },
    formatDate(value) { return value ? new Date(value).toLocaleDateString() : '—'; }
  }
};
