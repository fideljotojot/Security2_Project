import { supabase } from '@/utils/supabase.js';

export default {
  name: 'SuperadminRegistrations',
  data: () => ({ registrations: [], isLoading: false, isUpdating: false, errorMessage: '' }),
  mounted() { this.fetchRegistrations(); },
  methods: {
    async fetchRegistrations() {
      this.isLoading = true;
      const { data, error } = await supabase.rpc('get_pending_registrations');
      this.isLoading = false;
      if (error) this.errorMessage = error.message || 'Unable to load registrations.';
      else { this.errorMessage = ''; this.registrations = data || []; }
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
    formatDate(value) { return value ? new Date(value).toLocaleDateString() : '—'; }
  }
};
