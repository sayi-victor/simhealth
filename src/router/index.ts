import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/patients',
      name: 'patients.index',
      component: () => import('../views/PatientsListView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/patients/new',
      name: 'patients.create',
      component: () => import('../views/PatientFormView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/patients/:id',
      name: 'patients.show',
      component: () => import('../views/PatientDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/patients/:id/edit',
      name: 'patients.edit',
      component: () => import('../views/PatientFormView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/encounters',
      name: 'encounters.index',
      component: () => import('../views/EncountersListView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/encounters/new',
      name: 'encounters.create',
      component: () => import('../views/EncounterCreateView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/encounters/:id',
      name: 'encounters.show',
      component: () => import('../views/EncounterWorkspaceView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/calendar',
      name: 'calendar.index',
      component: () => import('../views/CalendarView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/pharmacy',
      name: 'pharmacy.index',
      component: () => import('../views/PharmacyView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/orders',
      name: 'orders.index',
      component: () => import('../views/OrdersView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/clinical',
      name: 'clinical.index',
      component: () => import('../views/ClinicalModulesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/billing',
      name: 'billing.index',
      component: () => import('../views/BillingView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/inventory',
      name: 'inventory.index',
      component: () => import('../views/InventoryView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/reports',
      name: 'reports.index',
      component: () => import('../views/ReportsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin',
      name: 'admin.index',
      component: () => import('../views/AdminView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.initialized) {
    await auth.fetchMe()
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' }
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }
})

export default router
