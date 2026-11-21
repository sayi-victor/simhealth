<script setup lang="ts">
import AppLayout from '../components/AppLayout.vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
</script>

<template>
  <AppLayout>
    <section class="page-header">
      <div>
        <h1>Clinical Dashboard</h1>
        <p class="muted">
          Authenticated via Laravel Sanctum with clinical RBAC.
        </p>
      </div>
      <RouterLink
        v-if="auth.can('patients.create')"
        to="/patients/new"
        class="btn-primary link-btn"
      >
        + Register Patient
      </RouterLink>
    </section>

    <div class="card-grid">
      <article class="card">
        <h3>Signed-in User</h3>
        <p class="card-value">{{ auth.user?.username }}</p>
        <p class="muted">{{ auth.user?.email || 'No email set' }}</p>
      </article>

      <article class="card">
        <h3>Active Roles</h3>
        <p class="card-value">{{ auth.user?.roles.join(', ') || 'None' }}</p>
        <p class="muted">
          {{ auth.user?.permissions.length ?? 0 }} granted permissions
        </p>
      </article>

      <article class="card">
        <h3>Patients Module</h3>
        <p class="card-value">Active</p>
        <p class="muted">
          <RouterLink to="/patients" class="text-link">
            Open patient directory →
          </RouterLink>
        </p>
      </article>
    </div>
  </AppLayout>
</template>
