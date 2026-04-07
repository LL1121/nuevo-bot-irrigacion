# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chat-load-and-burst.spec.ts >> renderiza mensaje entrante vacio con fallback visible en chat principal
- Location: e2e/chat-load-and-burst.spec.ts:314:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('[data-index="0"]').first()

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

# Test source

```ts
  226 |         const node = current as HTMLElement;
  227 |         const style = window.getComputedStyle(node);
  228 |         if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
  229 |           return node;
  230 |         }
  231 |         current = current.parentElement;
  232 |       }
  233 |       return null;
  234 |     };
  235 | 
  236 |     return await new Promise<number>((resolve, reject) => {
  237 |       const startedAt = performance.now();
  238 | 
  239 |       const done = () => {
  240 |         const bodyText = document.body.textContent || '';
  241 |         if (!bodyText.includes(marker)) return false;
  242 | 
  243 |         observer.disconnect();
  244 |         clearTimeout(timeout);
  245 |         resolve(performance.now() - startedAt);
  246 |         return true;
  247 |       };
  248 | 
  249 |       const observer = new MutationObserver(() => {
  250 |         done();
  251 |       });
  252 | 
  253 |       observer.observe(document.body, {
  254 |         childList: true,
  255 |         subtree: true,
  256 |         characterData: true,
  257 |       });
  258 | 
  259 |       const timeout = window.setTimeout(() => {
  260 |         observer.disconnect();
  261 |         reject(new Error('Timeout esperando render del ultimo mensaje con interacciones concurrentes'));
  262 |       }, 20_000);
  263 | 
  264 |       const firstRow = document.querySelector('[data-index="0"]');
  265 |       const conversationsScroller = findScrollableAncestor(firstRow);
  266 | 
  267 |       const dispatchNext = (i: number) => {
  268 |         if (i >= count) {
  269 |           done();
  270 |           return;
  271 |         }
  272 | 
  273 |         const event = new CustomEvent('e2e:nuevo_mensaje', {
  274 |           detail: {
  275 |             id: `burst-interact-${i}`,
  276 |             telefono: phone,
  277 |             mensaje: `BURST-INTERACT-${i}`,
  278 |             tipo: 'text',
  279 |             emisor: 'usuario',
  280 |             timestamp: new Date(Date.now() + i).toISOString(),
  281 |             nombre: 'Cliente Interaccion',
  282 |           },
  283 |         });
  284 |         window.dispatchEvent(event);
  285 | 
  286 |         // Simular actividad del operador durante la ráfaga.
  287 |         if (i % 25 === 0) {
  288 |           if (conversationsScroller) {
  289 |             conversationsScroller.scrollTop = conversationsScroller.scrollTop + 420;
  290 |           }
  291 | 
  292 |           const rows = Array.from(document.querySelectorAll('[data-index]')) as HTMLElement[];
  293 |           const candidate = rows[Math.min(6, rows.length - 1)];
  294 |           candidate?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  295 |         }
  296 | 
  297 |         window.setTimeout(() => dispatchNext(i + 1), 2);
  298 |       };
  299 | 
  300 |       dispatchNext(0);
  301 |     });
  302 |   }, { count: burstCount });
  303 | 
  304 |   test.info().annotations.push({
  305 |     type: 'metric',
  306 |     description: `burst_interaction_latency_ms=${latencyWithInteractionMs.toFixed(2)} burst_count=${burstCount} chat_count=${chatCount}`,
  307 |   });
  308 |   console.log(`[E2E_METRIC] burst_interaction_latency_ms=${latencyWithInteractionMs.toFixed(2)} burst_count=${burstCount} chat_count=${chatCount}`);
  309 | 
  310 |   expect(latencyWithInteractionMs).toBeLessThan(burstInteractionThresholdMs);
  311 |   await expect(page.getByText(`BURST-INTERACT-${burstCount - 1}`).first()).toBeVisible();
  312 | });
  313 | 
  314 | test('renderiza mensaje entrante vacio con fallback visible en chat principal', async ({ page }) => {
  315 |   await mockApi(page);
  316 | 
  317 |   await page.addInitScript((token) => {
  318 |     localStorage.setItem('token', token);
  319 |   }, e2eToken);
  320 | 
  321 |   await page.goto('/');
  322 |   await expect(page.getByPlaceholder('Buscar conversación...')).toBeVisible();
  323 | 
  324 |   // Abrir primer chat visible para validar panel principal.
  325 |   const firstVisibleRow = page.locator('[data-index="0"]').first();
> 326 |   await firstVisibleRow.click();
      |                         ^ Error: locator.click: Test timeout of 60000ms exceeded.
  327 | 
  328 |   await page.evaluate(() => {
  329 |     const event = new CustomEvent('e2e:nuevo_mensaje', {
  330 |       detail: {
  331 |         id: 'empty-visible-regression',
  332 |         telefono: '5492604000001',
  333 |         mensaje: '',
  334 |         tipo: 'text',
  335 |         emisor: 'usuario',
  336 |       },
  337 |     });
  338 |     window.dispatchEvent(event);
  339 |   });
  340 | 
  341 |   await expect(page.getByText('[Mensaje sin contenido]').first()).toBeVisible();
  342 | });
  343 | 
```