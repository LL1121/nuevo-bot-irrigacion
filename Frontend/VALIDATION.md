# Data Validation con Zod

Sistema completo de validación runtime con Zod para type safety garantizado.

## 📋 Overview

**Problema**: TypeScript solo valida en compile-time. Si el backend envía datos incorrectos, tu app crashea.

**Solución**: Zod valida datos en runtime y genera tipos automáticamente.

## 🏗️ Estructura

```
src/
├── schemas/
│   ├── api.ts              # Schemas para API responses
│   ├── forms.ts            # Schemas para formularios
│   └── index.ts            # Export point
├── api/
│   └── validator.ts        # Validador wrapper
└── hooks/
    └── useValidation.ts    # Hook de validación
```

## 🎯 Schemas de API

### User Schema

```typescript
import { UserSchema } from '@/schemas/api';

// Valida respuesta del backend
const response = await fetch('/api/users/123');
const data = await response.json();
const user = UserSchema.parse(data); // ✅ Validado y tipado

// Si el backend envía datos incorrectos, lanza error descriptivo
```

### Tipos Disponibles

- `UserSchema` - Usuario con email, name, role
- `AuthTokenSchema` - JWT tokens con Bearer type
- `MessageSchema` - Mensajes con attachments opcionales
- `ChatSchema` - Chats con stats y tags
- `ApiResponseSchema(T)` - Wrapper genérico para responses
- `PaginatedResponseSchema(T)` - Respuestas paginadas

### Transformaciones Automáticas

```typescript
// Convierte strings ISO a Date objects
const user = UserSchema.parse({
  createdAt: '2024-01-01T00:00:00Z', // string
});
console.log(user.createdAt); // Date object

// Provee defaults para campos opcionales
const message = MessageSchema.parse({
  id: '...',
  content: 'Hello',
  // attachments no provisto
});
console.log(message.attachments); // [] (array vacío)
```

## 📝 Schemas de Formularios

### Login Form

```typescript
import { LoginFormSchema } from '@/schemas/forms';

const formData = {
  email: '  TEST@EXAMPLE.COM  ',
  password: 'password123',
  rememberMe: true,
};

const validated = LoginFormSchema.parse(formData);
// ✅ email: 'test@example.com' (lowercase + trimmed)
// ✅ rememberMe: true
```

### Registro con Validación de Contraseñas

```typescript
import { RegisterFormSchema } from '@/schemas/forms';

const data = {
  name: 'John Doe',
  email: 'john@example.com',
  password: 'Password123', // Debe tener mayúscula, minúscula y número
  confirmPassword: 'Password123',
  acceptTerms: true,
};

const validated = RegisterFormSchema.parse(data);
// ✅ Passwords match
// ✅ Password strength validated
// ✅ Terms accepted
```

### Mensajes en Español

Todos los errores están en español:

```typescript
{
  email: 'Email inválido',
  password: 'La contraseña debe tener al menos 8 caracteres...',
  confirmPassword: 'Las contraseñas no coinciden',
  acceptTerms: 'Debes aceptar los términos y condiciones'
}
```

### Formularios Disponibles

- `LoginFormSchema` - Email, password, rememberMe
- `RegisterFormSchema` - Name, email, password (con validación de fuerza), confirmPassword, acceptTerms
- `ProfileFormSchema` - Name, email, avatar (URL), phone, bio
- `ChangePasswordFormSchema` - Current, new, confirm (verifica que sean diferentes)
- `MessageFormSchema` - Content (max 5000 chars), attachments (max 5)
- `SettingsFormSchema` - Notificaciones, theme, language, autoSave, dataRetention
- `SearchFormSchema` - Query, filters, sortBy, sortOrder

## 🔧 API Validator

### Validación Básica

```typescript
import { validateResponse } from '@/api/validator';
import { UserSchema } from '@/schemas/api';

const response = await fetch('/api/users/123');
const data = await response.json();

try {
  const user = validateResponse(data, UserSchema);
  console.log(user); // ✅ Validado
} catch (error) {
  console.error('Datos inválidos del backend:', error);
}
```

### Wrapper para API Calls

```typescript
import { withValidation } from '@/api/validator';
import { ChatSchema } from '@/schemas/api';

const getChat = async (id: string) => {
  return withValidation(
    () => fetch(`/api/chats/${id}`).then(r => r.json()),
    ChatSchema
  );
};

const chat = await getChat('123'); // ✅ Validado automáticamente
```

### Validación por Lotes

```typescript
import { validateBatch } from '@/api/validator';
import { MessageSchema } from '@/schemas/api';

const messages = await fetch('/api/messages').then(r => r.json());

// Valida array completo, salta items inválidos
const validated = validateBatch(messages, MessageSchema);
console.log(`${validated.length} de ${messages.length} válidos`);
```

### Opciones de Validación

```typescript
validateResponse(data, schema, {
  logErrors: true,              // Log a consola
  trackValidationErrors: true,  // Track en analytics
  throwOnError: false,          // No lanzar error, retornar undefined
});
```

## ⚛️ Hook useValidation

### Uso Básico

```typescript
import { useValidation } from '@/hooks/useValidation';
import { LoginFormSchema } from '@/schemas/forms';

function LoginForm() {
  const {
    data,
    errors,
    touched,
    isValid,
    setValue,
    handleSubmit,
    getFieldProps,
  } = useValidation({
    schema: LoginFormSchema,
    mode: 'onChange', // Valida mientras escribes
  });

  return (
    <form onSubmit={handleSubmit(async (validData) => {
      await login(validData.email, validData.password);
    })}>
      <input {...getFieldProps('email')} />
      {errors.email && <span>{errors.email}</span>}
      
      <input {...getFieldProps('password')} type="password" />
      {errors.password && <span>{errors.password}</span>}
      
      <button type="submit" disabled={!isValid}>
        Login
      </button>
    </form>
  );
}
```

### Modos de Validación

```typescript
mode: 'onChange'    // Valida mientras escribes
mode: 'onBlur'      // Valida al salir del campo
mode: 'onSubmit'    // Solo valida al enviar (default)
```

### Métodos Disponibles

```typescript
const {
  // State
  data,           // Datos del formulario
  errors,         // Errores por campo
  touched,        // Campos tocados
  isValid,        // ¿Formulario válido?
  isValidating,   // ¿Validando?
  isDirty,        // ¿Modificado?
  
  // Methods
  setValue,       // Setear un campo
  setValues,      // Setear múltiples campos
  validate,       // Validar todo
  validateField,  // Validar un campo
  handleSubmit,   // Manejar submit
  reset,          // Resetear formulario
  getFieldProps,  // Props para input
  getError,       // Obtener error de campo
  hasError,       // ¿Campo tiene error?
} = useValidation({ schema });
```

### Valores por Defecto

```typescript
useValidation({
  schema: ProfileFormSchema,
  defaultValues: {
    name: 'John Doe',
    email: 'john@example.com',
  },
});
```

### Validación de Campo Individual

```typescript
import { useFieldValidation } from '@/hooks/useValidation';
import { z } from 'zod';

function EmailInput() {
  const emailSchema = z.string().email();
  
  const {
    value,
    error,
    setValue,
    setTouched,
    isValid,
  } = useFieldValidation(emailSchema);

  return (
    <div>
      <input
        value={value || ''}
        onChange={(e) => setValue(e.target.value)}
        onBlur={setTouched}
      />
      {error && <span>{error}</span>}
    </div>
  );
}
```

## 🎨 Ejemplo Completo

```typescript
import { useValidation } from '@/hooks/useValidation';
import { RegisterFormSchema } from '@/schemas/forms';
import { validateResponse } from '@/api/validator';
import { AuthTokenSchema } from '@/schemas/api';

function RegisterForm() {
  const {
    data,
    errors,
    isValid,
    isValidating,
    getFieldProps,
    handleSubmit,
  } = useValidation({
    schema: RegisterFormSchema,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const onSubmit = handleSubmit(async (formData) => {
    // Datos ya validados por el schema
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    
    const data = await response.json();
    
    // Valida response del backend
    const authToken = validateResponse(data, AuthTokenSchema);
    
    // ✅ 100% type safe
    localStorage.setItem('token', authToken.accessToken);
  });

  return (
    <form onSubmit={onSubmit}>
      <input {...getFieldProps('name')} placeholder="Nombre" />
      {errors.name && <span className="error">{errors.name}</span>}

      <input {...getFieldProps('email')} placeholder="Email" />
      {errors.email && <span className="error">{errors.email}</span>}

      <input
        {...getFieldProps('password')}
        type="password"
        placeholder="Contraseña"
      />
      {errors.password && <span className="error">{errors.password}</span>}

      <input
        {...getFieldProps('confirmPassword')}
        type="password"
        placeholder="Confirmar contraseña"
      />
      {errors.confirmPassword && (
        <span className="error">{errors.confirmPassword}</span>
      )}

      <label>
        <input
          type="checkbox"
          checked={data.acceptTerms || false}
          onChange={(e) => setValue('acceptTerms', e.target.checked)}
        />
        Acepto términos y condiciones
      </label>
      {errors.acceptTerms && (
        <span className="error">{errors.acceptTerms}</span>
      )}

      <button type="submit" disabled={!isValid || isValidating}>
        {isValidating ? 'Registrando...' : 'Registrarse'}
      </button>
    </form>
  );
}
```

## 🧪 Testing

Los schemas incluyen 50+ tests comprehensivos:

```bash
npm run test
```

**Tests incluidos:**
- ✅ 28 tests en `api.test.ts` (schemas de API)
- ✅ 31 tests en `forms.test.ts` (schemas de formularios)
- ✅ 15 tests en `validator.test.ts` (validador wrapper)

## 📊 Helpers de Validación

### Validación con Defaults

```typescript
import { validateWithDefaults } from '@/schemas/api';

const user = validateWithDefaults(data, UserSchema, {
  avatar: 'https://example.com/default.png',
  role: 'user',
});
```

### Validación Segura (no lanza error)

```typescript
import { safeValidateApiResponse } from '@/schemas/api';

const result = safeValidateApiResponse(data, UserSchema);

if (result.success) {
  console.log(result.data); // Usuario válido
} else {
  console.error(result.error); // ZodError con detalles
}
```

### Validación Parcial

```typescript
import { validatePartial } from '@/api/validator';

// Solo valida campos presentes
const partial = validatePartial({ name: 'John' }, UserSchema);
// ✅ name validado, otros campos opcionales
```

### Resumen de Errores

```typescript
import { getValidationSummary } from '@/api/validator';

try {
  schema.parse(data);
} catch (error) {
  if (error instanceof z.ZodError) {
    const summary = getValidationSummary(error);
    console.log(summary.totalErrors);       // Número total
    console.log(summary.errorsByField);     // Agrupados por campo
    console.log(summary.flatErrors);        // Array plano
  }
}
```

## 🚀 Best Practices

### 1. Siempre Valida API Responses

```typescript
// ❌ Malo
const user = await fetch('/api/users/1').then(r => r.json());
user.email.toLowerCase(); // Puede crashear si email es null

// ✅ Bueno
const data = await fetch('/api/users/1').then(r => r.json());
const user = UserSchema.parse(data);
user.email.toLowerCase(); // ✅ Garantizado que es string
```

### 2. Usa Transformaciones

```typescript
// ✅ Convierte y limpia datos automáticamente
const schema = z.object({
  email: z.string().email().toLowerCase().trim(),
  createdAt: z.string().transform(val => new Date(val)),
});
```

### 3. Valida en Tiempo Real

```typescript
// ✅ Feedback inmediato al usuario
useValidation({
  schema: LoginFormSchema,
  mode: 'onChange',
});
```

### 4. Maneja Errores Gracefully

```typescript
const result = schema.safeParse(data);

if (!result.success) {
  // Muestra errores al usuario
  result.error.errors.forEach(err => {
    showToast(`${err.path}: ${err.message}`);
  });
}
```

## ⚠️ Troubleshooting

### "Cannot read property of undefined"

**Problema**: Backend no envió un campo esperado

**Solución**: Usa `.optional()` o `.default()`

```typescript
z.object({
  tags: z.array(z.string()).default([]),  // ✅ Default
  bio: z.string().optional(),             // ✅ Opcional
});
```

### "Expected string, received number"

**Problema**: Backend envió tipo incorrecto

**Solución**: Usa `.transform()` para coerción

```typescript
z.string().transform(val => String(val))  // Convierte a string
```

### Performance con Arrays Grandes

**Problema**: Validar 10000+ items es lento

**Solución**: Usa `validateBatch` con chunks

```typescript
const chunks = chunkArray(data, 100);
const validated = chunks.flatMap(chunk => 
  validateBatch(chunk, schema)
);
```

## 📚 Recursos

- [Zod Documentation](https://zod.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Hook Form + Zod](https://react-hook-form.com/get-started#SchemaValidation)
