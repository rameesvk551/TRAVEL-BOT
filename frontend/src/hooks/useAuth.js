// FILE: /frontend/src/hooks/useAuth.js

import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { useAuthStore } from '../store/authStore';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data) => authApi.login(data),
    onSuccess: (result) => {
      setAuth(result.data);
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
