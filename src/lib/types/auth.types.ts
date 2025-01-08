export interface LoginFormData {
  email: string;
  password: string;
  confirmPassword?: string;
}

export interface AuthError {
  code: string;
  message: string;
}

export interface FormState {
  isLoading: boolean;
  error: AuthError | null;
  isRegisterMode: boolean;
}

export interface FirebaseAuthError {
    code: string;
    message: string;
} 