<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { useThemeStore } from '../stores/theme'

const router = useRouter()
const auth = useAuthStore()
const theme = useThemeStore()

const username = ref('')
const password = ref('')
const errorMessage = ref('')

async function handleSubmit() {
  errorMessage.value = ''
  try {
    await auth.login(username.value.trim(), password.value)
    await router.push({ name: 'dashboard' })
  } catch (err) {
    if (err instanceof ApiError) {
      errorMessage.value = err.message
    } else {
      errorMessage.value = 'Unable to connect to the HMS server.'
    }
  }
}
</script>

<template>
  <main class="login-page">
    <button
      type="button"
      class="icon-btn login-theme-toggle"
      :aria-label="theme.resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
      @click="theme.toggle()"
    >
      {{ theme.resolved === 'dark' ? '☀️' : '🌙' }}
    </button>

    <section class="login-card">
      <div class="login-brand">
        <div class="brand-mark">HMS</div>
        <div>
          <h1>Health Management System</h1>
          <p class="muted">Clinical Staff Portal</p>
        </div>
      </div>

      <form class="login-form" @submit.prevent="handleSubmit">
        <div v-if="errorMessage" class="alert-error" role="alert">
          {{ errorMessage }}
        </div>

        <label class="field">
          <span>Username</span>
          <input
            v-model="username"
            type="text"
            autocomplete="username"
            required
            placeholder="e.g. admin"
          />
        </label>

        <label class="field">
          <span>Password</span>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            placeholder="Enter your password"
          />
        </label>

        <button class="btn-primary" type="submit" :disabled="auth.loading">
          {{ auth.loading ? 'Signing in...' : 'Sign in' }}
        </button>
      </form>
    </section>
  </main>
</template>
