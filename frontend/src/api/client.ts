import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios"

import { useAuthStore } from "@/stores/auth"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000"

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
})

// Plain client for the refresh call itself -- must not go through the
// request/response interceptors below, or a failed refresh would recurse.
const refreshClient = axios.create({ baseURL: API_BASE_URL })

apiClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setTokens, clear } = useAuthStore.getState()
  if (!refreshToken) return null

  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post("/auth/refresh", null, { headers: { Authorization: `Bearer ${refreshToken}` } })
      .then((resp) => {
        const { access_token, refresh_token } = resp.data
        setTokens(access_token, refresh_token)
        return access_token as string
      })
      .catch(() => {
        clear()
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true
      const newAccessToken = await refreshAccessToken()
      if (newAccessToken) {
        originalRequest.headers = originalRequest.headers ?? {}
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return apiClient(originalRequest)
      }
    }

    return Promise.reject(error)
  }
)
