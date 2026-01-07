import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import axios from 'axios';

interface LoginProps {
  onLoginSuccess: () => void;
  theme: string;
  darkMode: boolean;
}

const themeTokens: Record<string, { hex: string; gradient: string; lightBg: string }> = {
  emerald: { hex: '#10b981', gradient: 'from-emerald-500 to-teal-500', lightBg: 'from-emerald-50 via-teal-50 to-cyan-50' },
  blue: { hex: '#3b82f6', gradient: 'from-blue-500 to-cyan-500', lightBg: 'from-sky-50 via-blue-50 to-cyan-50' },
  violet: { hex: '#7c3aed', gradient: 'from-violet-500 to-purple-500', lightBg: 'from-violet-50 via-purple-50 to-fuchsia-50' },
  amber: { hex: '#d97706', gradient: 'from-amber-500 to-orange-500', lightBg: 'from-amber-50 via-orange-50 to-yellow-50' }
};

export default function Login({ onLoginSuccess, theme, darkMode }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:3000/api/auth/login', {
        email,
        password
      });

      if (response.data.token) {
        localStorage.setItem('authToken', response.data.token);
        if (response.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error('Error de login:', err);
      setError(err.response?.data?.message || 'Error al iniciar sesión. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const tokens = themeTokens[theme] || themeTokens.emerald;
  const bgGradient = darkMode ? 'from-gray-900 via-slate-900 to-gray-950' : tokens.lightBg;
  const cardBg = darkMode ? 'bg-gray-900 border border-white/10 text-gray-100' : 'bg-white text-gray-900';
  const inputBg = darkMode ? 'bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500';
  const focusRing = darkMode ? 'focus:ring-2 focus:ring-white/40 focus:border-transparent' : 'focus:ring-2 focus:ring-emerald-500 focus:border-transparent';
  const errorBg = darkMode ? 'bg-red-900/40 border-red-700 text-red-100' : 'bg-red-50 border-red-200 text-red-700';

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgGradient} flex items-center justify-center p-4 relative overflow-hidden`}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 20px 20px, ${tokens.hex} 2px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Login card */}
      <div className="relative w-full max-w-md">
        {/* Decorative blur circles */}
        <div className={`absolute -top-20 -left-20 w-40 h-40 ${darkMode ? 'bg-white/5' : 'bg-emerald-300'} rounded-full filter blur-3xl opacity-30 animate-pulse`} />
        <div className={`absolute -bottom-20 -right-20 w-40 h-40 ${darkMode ? 'bg-white/5' : 'bg-teal-300'} rounded-full filter blur-3xl opacity-30 animate-pulse`} style={{ animationDelay: '1s' }} />

        <div className={`relative rounded-2xl shadow-2xl p-8 space-y-6 ${cardBg}`}>
          {/* Logo/Header */}
          <div className="text-center">
            <img
              src="/Marca-IRRIGACIÓN-negro.png"
              alt="Irrigación"
              className="mx-auto h-24 sm:h-28 w-auto drop-shadow-lg"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className={`${errorBg} px-4 py-3 rounded-lg text-sm`}>
              {error}
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email input */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`w-full px-4 py-3 border rounded-lg transition-all outline-none ${inputBg} ${focusRing}`}
                placeholder="tu@email.com"
                disabled={loading}
                autoComplete="email"
              />
            </div>

            {/* Password input */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={`w-full px-4 py-3 border rounded-lg transition-all outline-none pr-12 ${inputBg} ${focusRing}`}
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Iniciando sesión...
                </span>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="text-center text-sm text-gray-500 pt-4 border-t border-gray-100">
            ¿Olvidaste tu contraseña?{' '}
            <a href="#" className="text-emerald-600 hover:text-emerald-700 font-medium">
              Recuperar acceso
            </a>
          </div>
        </div>

        {/* Version info */}
        <div className="text-center mt-6 text-sm text-gray-500">
          v1.0.0 - Sistema de Mensajería WhatsApp
        </div>
      </div>
    </div>
  );
}
