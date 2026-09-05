<template>
  <main class="superadmin-dashboard">
    <section class="dashboard-hero">
      <div>
        <p class="eyebrow">SYSTEM ADMINISTRATION</p>
        <h1>Superadmin Dashboard</h1>
        <p>Keep your user directory secure and your account approvals moving.</p>
      </div><i class="fi fi-rr-shield-check hero-icon"></i>
    </section>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <section class="stats">
      <article v-for="card in cards" :key="card.label" class="card"><i
          :class="['stat-icon', card.color, card.icon]"></i><span>{{ card.label }}</span><strong>{{ card.value
          }}</strong><router-link to="/superadmin/registrations" v-if="card.requests">Review requests
          →</router-link><router-link to="/superadmin/users" v-else>Manage users →</router-link></article>
    </section>
    <section class="lower">
      <div class="panel">
        <p class="eyebrow">CONTROL CENTER</p>
        <h2>Everything in one place.</h2>
        <p>Oversee accounts, approve registrations, and resolve deletion requests.</p>
        <div class="actions"><router-link to="/superadmin/users"><i class="fi fi-rr-user-gear"></i><span><b>User
                management</b><small>Search, edit, and manage accounts</small></span>→</router-link><router-link
            to="/superadmin/registrations"><i class="fi fi-rr-clipboard-check"></i><span><b>Approvals &
                requests</b><small>Review registrations and deletions</small></span>→</router-link></div>
      </div>
      <aside class="security">
        <div class="security-heading">
          <div class="top">
            <i class="fi fi-rr-lock"></i>
            <h3>Security First</h3>
          </div><span class="status-badge">Protected</span></div>

        <p>Account changes are restricted to authorized superadmin actions.</p>
        <ul class="security-list"><li><i class="fi fi-rr-check"></i><span><b>Role-based access</b><small>Only approved roles can access admin tools</small></span></li><li><i class="fi fi-rr-check"></i><span><b>Approval workflow</b><small>Registration and deletion requests require review</small></span></li><li><i class="fi fi-rr-check"></i><span><b>Protected actions</b><small>Sensitive changes require confirmation</small></span></li></ul>
      </aside>
    </section>
  </main>
</template>
<script>
import { supabase } from '@/utils/supabase.js';
export default { name: 'SuperadminDashboard', data: () => ({ stats: { users: '—', registrations: '—', deletions: '—' }, errorMessage: '' }), computed: { cards() { return [{ label: 'Total users', value: this.stats.users, icon: 'fi-rr-users', color: 'blue' }, { label: 'Pending registrations', value: this.stats.registrations, icon: 'fi-rr-time-fast', color: 'amber', requests: true }, { label: 'Deletion requests', value: this.stats.deletions, icon: 'fi-rr-trash', color: 'red', requests: true }] } }, async mounted() { const [u, r, d] = await Promise.all([supabase.rpc('get_all_users'), supabase.rpc('get_pending_registrations'), supabase.rpc('get_delete_requests')]); if (u.error || r.error || d.error) this.errorMessage = 'Unable to load the system overview.'; else this.stats = { users: u.data?.length || 0, registrations: r.data?.length || 0, deletions: d.data?.length || 0 }; } };
</script>
<style src="@/assets/CSS/superadmin-dashboard.css"></style>
