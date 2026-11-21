<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useThemeStore } from '../stores/theme'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const theme = useThemeStore()

const drawerOpen = ref(false)

function closeDrawer() {
  drawerOpen.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && drawerOpen.value) {
    closeDrawer()
  }
}

watch(() => route.fullPath, closeDrawer)

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))

async function handleLogout() {
  closeDrawer()
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="app-shell">
    <div
      v-if="drawerOpen"
      class="drawer-backdrop"
      aria-hidden="true"
      @click="closeDrawer"
    />

    <aside class="sidebar" :class="{ open: drawerOpen }" aria-label="Main navigation">
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <div class="brand-mark sm">HMS</div>
          <span class="sidebar-title">HMS v2</span>
        </div>
        <button
          type="button"
          class="icon-btn mobile-only sidebar-close"
          aria-label="Close navigation menu"
          @click="closeDrawer"
        >
          ✕
        </button>
      </div>

      <nav class="sidebar-nav">
        <RouterLink
          to="/"
          class="nav-item"
          :class="{ active: route.name === 'dashboard' }"
        >
          Dashboard
        </RouterLink>

        <span class="nav-section">Clinical</span>
        <RouterLink
          v-if="auth.can('patients.view')"
          to="/patients"
          class="nav-item"
          :class="{ active: String(route.name || '').startsWith('patients') }"
        >
          Patients
        </RouterLink>
        <RouterLink
          v-if="auth.can('encounters.view')"
          to="/encounters"
          class="nav-item"
          :class="{ active: String(route.name || '').startsWith('encounters') }"
        >
          Encounters
        </RouterLink>
        <RouterLink
          v-if="auth.can('calendar.view')"
          to="/calendar"
          class="nav-item"
          :class="{ active: String(route.name || '').startsWith('calendar') }"
        >
          Calendar
        </RouterLink>
        <RouterLink
          v-if="auth.can('prescriptions.view')"
          to="/pharmacy"
          class="nav-item"
          :class="{ active: String(route.name || '').startsWith('pharmacy') }"
        >
          Pharmacy
        </RouterLink>
        <RouterLink
          v-if="auth.can('orders.view')"
          to="/orders"
          class="nav-item"
          :class="{ active: String(route.name || '').startsWith('orders') }"
        >
          Orders &amp; Lab
        </RouterLink>
        <RouterLink
          v-if="auth.can('encounters.view')"
          to="/clinical"
          class="nav-item"
          :class="{ active: String(route.name || '').startsWith('clinical') }"
        >
          Inpatient &amp; Surgery
        </RouterLink>

        <span class="nav-section">Operations</span>
        <RouterLink
          v-if="auth.can('billing.view')"
          to="/billing"
          class="nav-item"
          :class="{ active: String(route.name || '').startsWith('billing') }"
        >
          Billing &amp; Claims
        </RouterLink>
        <RouterLink
          v-if="auth.can('inventory.view')"
          to="/inventory"
          class="nav-item"
          :class="{ active: String(route.name || '').startsWith('inventory') }"
        >
          Inventory
        </RouterLink>
        <RouterLink
          v-if="auth.can('reports.view')"
          to="/reports"
          class="nav-item"
          :class="{ active: String(route.name || '').startsWith('reports') }"
        >
          Reports
        </RouterLink>
        <RouterLink
          v-if="auth.can('users.view') || auth.can('audit.view')"
          to="/admin"
          class="nav-item"
          :class="{ active: String(route.name || '').startsWith('admin') }"
        >
          Admin
        </RouterLink>
      </nav>
    </aside>

    <div class="main-area">
      <header class="topbar">
        <div class="topbar-left">
          <button
            type="button"
            class="icon-btn mobile-only"
            aria-label="Open navigation menu"
            :aria-expanded="drawerOpen"
            @click="drawerOpen = !drawerOpen"
          >
            ☰
          </button>
          <strong class="facility-name">{{ auth.user?.facility?.name ?? 'Default Facility' }}</strong>
        </div>
        <div class="topbar-user">
          <button
            type="button"
            class="icon-btn"
            :aria-label="theme.resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
            :title="theme.resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
            @click="theme.toggle()"
          >
            {{ theme.resolved === 'dark' ? '☀️' : '🌙' }}
          </button>
          <span class="user-name desktop-only">{{ auth.user?.full_name }}</span>
          <span v-for="role in auth.user?.roles" :key="role" class="badge desktop-only">
            {{ role }}
          </span>
          <button class="btn-ghost btn-sm" type="button" @click="handleLogout">
            Sign out
          </button>
        </div>
      </header>

      <main class="content">
        <slot />
      </main>
    </div>
  </div>
</template>
