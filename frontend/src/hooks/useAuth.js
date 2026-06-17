// FILE: /frontend/src/hooks/useAuth.js

import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { useAuthStore } from '../store/authStore';
import { useBrandingStore } from '../store/brandingStore';
import { applyBranding } from './useBranding';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setBranding = useBrandingStore((s) => s.setBranding);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data) => authApi.login(data),
    onSuccess: (result) => {
      setAuth(result.data);
      // Apply the agency's partner branding returned with the login response.
      if (result.data?.branding) {
        setBranding(result.data.branding);
        applyBranding(result.data.branding);
      }
      navigate('/');
    },
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data) => authApi.register(data),
    onSuccess: (result) => {
      setAuth(result.data);
      navigate('/');
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (data) => authApi.forgotPassword(data),
  });
}

export function useResetPassword() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data) => authApi.resetPassword(data),
    onSuccess: () => {
      navigate('/login?reset=success');
    },
  });
}

export function useLogout() {
  const { refreshToken, logout } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => authApi.logout(refreshToken),
    onSettled: () => {
      logout();
      navigate('/login');
    },
  });
}
