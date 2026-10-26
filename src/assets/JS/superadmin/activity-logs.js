import { supabase } from '@/utils/supabase.js';
import { LOG_CATEGORIES, actorName, browserAndOS, localDateBounds, logDescription } from '@/utils/log-display.js';

const emptyFilters = () => ({ search: '', action: '', role: '', from: '', to: '' });

export default {
  name: 'ActivityLogs',
  data: () => ({
    logs: [], category: 'all', categories: LOG_CATEGORIES, draft: emptyFilters(), applied: emptyFilters(),
    currentPage: 1, pageSize: 8, total: 0, options: { actions: [], roles: [] },
    loading: false, errorMessage: '', validationMessage: '', requestId: 0, searchTimer: null,
  }),
  computed: {
    categoryLabel() { return this.categories.find(category => category.value === this.category)?.label || 'Logs'; },
    pageCount() { return Math.max(1, Math.ceil(this.total / this.pageSize)); },
    pageStart() { return this.total ? (this.currentPage - 1) * this.pageSize + 1 : 0; },
    pageEnd() { return Math.min(this.currentPage * this.pageSize, this.total); },
    visiblePages() {
      return [...new Set([1, this.currentPage - 1, this.currentPage, this.currentPage + 1, this.pageCount])]
        .filter(page => page > 0 && page <= this.pageCount).sort((a, b) => a - b);
    },
  },
  mounted() { this.loadLogs(); },
  beforeUnmount() { this.cancelSearch(); this.requestId++; },
  methods: {
    actorName, browserAndOS, logDescription,
    categoryName(value) { return this.categories.find(category => category.value === value)?.label || 'Unknown'; },
    formatDate(value) { return value ? new Date(value).toLocaleString() : '—'; },
    actionClass(action) {
      if (/\b(timeout|logout|logged out|failed|blocked|rejected|deleted)\b/i.test(action)) return 'log-badge-danger';
      if (/login|logged in|approved|unblocked/i.test(action)) return 'log-badge-success';
      return 'log-badge-neutral';
    },
    async loadLogs() {
      const requestId = ++this.requestId;
      this.loading = true;
      this.errorMessage = '';
      try {
        const dates = localDateBounds(this.applied.from, this.applied.to);
        const { data, error } = await supabase.rpc('get_activity_log_page', {
          p_category: this.category, p_search: this.applied.search.trim(), p_actor: null,
          p_action: this.applied.action || null, p_role: this.applied.role || null,
          p_from: dates.from, p_to: dates.to, p_page: this.currentPage, p_page_size: this.pageSize,
        });
        if (requestId !== this.requestId) return;
        if (error) throw error;
        this.logs = data?.rows || [];
        this.total = Number(data?.total || 0);
        this.options = { actions: data?.actions || [], roles: data?.roles || [] };
        if (this.currentPage > this.pageCount) {
          this.currentPage = this.pageCount;
          await this.loadLogs();
        }
      } catch (error) {
        if (requestId === this.requestId) this.errorMessage = error.message || 'Unable to load logs. Please try again.';
      } finally {
        if (requestId === this.requestId) this.loading = false;
      }
    },
    cancelSearch() {
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
      this.searchTimer = null;
    },
    scheduleSearch() {
      this.cancelSearch();
      this.searchTimer = setTimeout(() => this.applyFilters(), 300);
    },
    applyFilters() {
      this.cancelSearch();
      try { localDateBounds(this.draft.from, this.draft.to); }
      catch (error) { this.validationMessage = error.message; return; }
      this.validationMessage = '';
      this.applied = { ...this.draft };
      this.currentPage = 1;
      this.loadLogs();
    },
    clearFilters() {
      this.cancelSearch();
      this.draft = emptyFilters();
      this.applied = emptyFilters();
      this.validationMessage = '';
      this.currentPage = 1;
      this.loadLogs();
    },
    changeCategory() { this.options = { actions: [], roles: [] }; this.clearFilters(); },
    goToPage(page) {
      if (this.loading || page < 1 || page > this.pageCount || page === this.currentPage) return;
      this.currentPage = page;
      this.loadLogs();
    },
  },
};
