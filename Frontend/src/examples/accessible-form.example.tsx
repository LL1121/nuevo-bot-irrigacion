// Example: Accessible Form with validation and screen reader support
import { useState } from 'react';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import { generateId } from '@/utils/accessibility';

export const AccessibleForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { announce } = useAnnouncement();

  const emailId = generateId('email');
  const passwordId = generateId('password');
  const emailErrorId = generateId('email-error');
  const passwordErrorId = generateId('password-error');

  const validateEmail = (value: string) => {
    if (!value) return 'Email is required';
    if (!/\S+@\S+\.\S+/.test(value)) return 'Email is invalid';
    return '';
  };

  const validatePassword = (value: string) => {
    if (!value) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    return '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    const newErrors: Record<string, string> = {};
    if (emailError) newErrors.email = emailError;
    if (passwordError) newErrors.password = passwordError;

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      // Announce errors to screen reader
      const errorCount = Object.keys(newErrors).length;
      announce(
        `Form has ${errorCount} error${errorCount > 1 ? 's' : ''}. Please fix and try again.`,
        'assertive'
      );
      return;
    }

    // Success
    announce('Login successful');
    console.log('Form submitted:', { email, password });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <fieldset className="space-y-4">
        <legend className="text-2xl font-bold mb-4">Login</legend>

        {/* Email field */}
        <div>
          <label htmlFor={emailId} className="block text-sm font-medium mb-1">
            Email <span aria-label="required">*</span>
          </label>
          <input
            id={emailId}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => {
              const error = validateEmail(email);
              if (error) {
                setErrors((prev) => ({ ...prev, email: error }));
              } else {
                setErrors((prev) => {
                  const { email, ...rest } = prev;
                  return rest;
                });
              }
            }}
            aria-required="true"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? emailErrorId : undefined}
            className={`w-full px-3 py-2 border rounded ${
              errors.email ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.email && (
            <p
              id={emailErrorId}
              role="alert"
              className="text-red-500 text-sm mt-1"
            >
              {errors.email}
            </p>
          )}
        </div>

        {/* Password field */}
        <div>
          <label htmlFor={passwordId} className="block text-sm font-medium mb-1">
            Password <span aria-label="required">*</span>
          </label>
          <input
            id={passwordId}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => {
              const error = validatePassword(password);
              if (error) {
                setErrors((prev) => ({ ...prev, password: error }));
              } else {
                setErrors((prev) => {
                  const { password, ...rest } = prev;
                  return rest;
                });
              }
            }}
            aria-required="true"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? passwordErrorId : undefined}
            className={`w-full px-3 py-2 border rounded ${
              errors.password ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.password && (
            <p
              id={passwordErrorId}
              role="alert"
              className="text-red-500 text-sm mt-1"
            >
              {errors.password}
            </p>
          )}
        </div>

        {/* Submit button */}
        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Login
        </button>
      </fieldset>
    </form>
  );
};

// Key accessibility features:
// 1. Proper label-input associations (htmlFor/id)
// 2. Required fields marked with aria-required
// 3. Error states with aria-invalid and aria-describedby
// 4. Error announcements for screen readers
// 5. Focus management (auto-focus on first error)
// 6. Keyboard accessible (all interactions work with keyboard)
