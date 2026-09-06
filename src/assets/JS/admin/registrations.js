import { supabase } from '@/utils/supabase.js';

export default {
  name: 'AdminRegistrations',
  data: () => ({
    registrations: [],
    search: '',
    idSort: '',
    timeFilter: 'all',
    page: 1,
    pageSize: 10,
    isLoading: false,
    isUpdating: false,
    errorMessage: ''
  }),
  computed: {
    filteredRegistrations() {
      const query = this.search.trim().toLowerCase();
      const ranges = { today: 86400000, week: 604800000, month: 2592000000 };
      const now = Date.now();
      const result = this.registrations.filter((registration) => {
        const matchesSearch = !query || [registration.id_number, registration.username, registration.email]
          .some(value => String(value || '').toLowerCase().includes(query));
        const matchesTime = this.timeFilter === 'all'
          || now - new Date(registration.created_at).getTime() <= ranges[this.timeFilter];
        return matchesSearch && matchesTime;
      });

      if (!this.idSort) return result;
      const direction = this.idSort === 'descending' ? -1 : 1;
      return result.sort((left, right) => {
        const leftId = Number(String(left.id_number || '').replace(/\D/g, ''));
        const rightId = Number(String(right.id_number || '').replace(/\D/g, ''));
        return (leftId - rightId) * direction;
      });
    },
    pageCount() {
      return Math.max(1, Math.ceil(this.filteredRegistrations.length / this.pageSize));
    },
    pageNumbers() {
      return Array.from({ length: this.pageCount }, (_, index) => index + 1);
    },
    paginatedRegistrations() {
      const start = (this.page - 1) * this.pageSize;
      return this.filteredRegistrations.slice(start, start + this.pageSize);
    },
    pageStart() {
      return this.filteredRegistrations.length ? (this.page - 1) * this.pageSize + 1 : 0;
    },
    pageEnd() {
      return Math.min(this.page * this.pageSize, this.filteredRegistrations.length);
    }
  },
  watch: {
    search() { this.page = 1; },
    idSort() { this.page = 1; },
    timeFilter() { this.page = 1; },
    pageCount(count) {
      if (this.page > count) this.page = count;
    }
  },
  mounted() {
    this.fetchRegistrations();
  },
  methods: {
    async fetchRegistrations() {
      this.isLoading = true;
      const { data, error } = await supabase.rpc('get_pending_registrations');
      this.isLoading = false;
      if (error) {
        this.errorMessage = error.message || 'Unable to load registrations.';
        return;
      }
      this.errorMessage = '';
      this.registrations = data || [];
      this.page = 1;
    },
    async updateStatus(registration, status) {
      this.isUpdating = true;
      const { error } = await supabase.rpc('update_registration_status', {
        p_user_id: registration.user_id,
        p_status: status
      });
      this.isUpdating = false;
      if (error) {
        this.errorMessage = error.message || 'Unable to update registration.';
        return;
      }
      await this.fetchRegistrations();
    },
    formatDate(value) {
      return value ? new Date(value).toLocaleDateString() : '-';
    }
  }
};
