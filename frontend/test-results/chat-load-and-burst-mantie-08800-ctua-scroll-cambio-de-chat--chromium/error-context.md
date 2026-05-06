# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chat-load-and-burst.spec.ts >> mantiene respuesta bajo rafaga mientras el operador interactua (scroll + cambio de chat)
- Location: e2e/chat-load-and-burst.spec.ts:207:1

# Error details

```
Error: page.evaluate: Error: Timeout esperando render del ultimo mensaje con interacciones concurrentes
    at eval (eval at evaluate (:302:30), <anonymous>:38:16)
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e7]:
    - img "Irrigación" [ref=e9]
    - generic [ref=e10]:
      - generic [ref=e11]:
        - generic [ref=e12]: Usuario
        - textbox "Usuario" [ref=e13]:
          - /placeholder: admin
      - generic [ref=e14]:
        - generic [ref=e15]: Contraseña
        - generic [ref=e16]:
          - textbox "Contraseña" [ref=e17]:
            - /placeholder: ••••••••
          - button [ref=e18] [cursor=pointer]:
            - img [ref=e19]
      - button "Iniciar Sesión" [disabled] [ref=e22]
    - generic [ref=e23]:
      - text: ¿Olvidaste tu contraseña?
      - link "Recuperar acceso" [ref=e24] [cursor=pointer]:
        - /url: "#"
  - generic [ref=e25]: v1.0.0 - Sistema de Mensajería WhatsApp
  - generic [ref=e27]:
    - generic [ref=e28]: Sentry Test
    - generic [ref=e29]:
      - button "Enviar Error" [ref=e30] [cursor=pointer]
      - button "Enviar Mensaje" [ref=e31] [cursor=pointer]
    - generic [ref=e32]: Solo visible en dev / con logging/Sentry habilitado.
```