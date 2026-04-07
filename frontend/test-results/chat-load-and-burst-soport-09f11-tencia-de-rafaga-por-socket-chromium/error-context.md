# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chat-load-and-burst.spec.ts >> soporta muchas conversaciones y mide latencia de rafaga por socket
- Location: e2e/chat-load-and-burst.spec.ts:121:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-index="0"]').first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
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
  33  | 
  34  | const buildChats = (): RawChat[] => {
  35  |   const now = Date.now();
  36  |   return Array.from({ length: chatCount }, (_, i) => {
  37  |     const idx = i + 1;
  38  |     const ts = new Date(now - i * 1000).toISOString();
  39  |     return {
  40  |       id: idx,
  41  |       telefono: `5492604${String(idx).padStart(6, '0')}`,
  42  |       nombre_whatsapp: `Cliente ${String(idx).padStart(4, '0')}`,
  43  |       ultimo_mensaje: { cuerpo: `Ultimo mensaje ${idx}`, created_at: ts },
  44  |       ultimo_mensaje_fecha: ts,
  45  |       mensajes_no_leidos: idx % 4,
  46  |     };
  47  |   });
  48  | };
  49  | 
  50  | const buildHistory = (phone: string): RawMessage[] => {
  51  |   const now = Date.now();
  52  |   return Array.from({ length: historyCount }, (_, i) => ({
  53  |     id: `${phone}-hist-${i}`,
  54  |     contenido: `Hist ${i}`,
  55  |     emisor: i % 2 === 0 ? 'usuario' : 'operador',
  56  |     tipo: 'text',
  57  |     created_at: new Date(now - (historyCount - i) * 2000).toISOString(),
  58  |   }));
  59  | };
  60  | 
  61  | const mockApi = async (page: import('@playwright/test').Page) => {
  62  |   const chats = buildChats();
  63  | 
  64  |   await page.route('**/*', async (route) => {
  65  |     const requestUrl = route.request().url();
  66  |     const url = new URL(requestUrl);
  67  |     const path = url.pathname;
  68  | 
  69  |     if (route.request().method() === 'OPTIONS') {
  70  |       await route.fulfill({
  71  |         status: 204,
  72  |         headers: {
  73  |           'access-control-allow-origin': '*',
  74  |           'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  75  |           'access-control-allow-headers': '*',
  76  |         },
  77  |       });
  78  |       return;
  79  |     }
  80  | 
  81  |     if (requestUrl.includes('/api/auth/login') || requestUrl.includes('/auth/login')) {
  82  |       await route.fulfill({
  83  |         status: 200,
  84  |         contentType: 'application/json',
  85  |         body: JSON.stringify({
  86  |           success: true,
  87  |           token: 'e2e-token',
  88  |           refreshToken: 'e2e-refresh',
  89  |           operador: { nombre: 'E2E Operador', email: 'e2e@bot.local' },
  90  |         }),
  91  |       });
  92  |       return;
  93  |     }
  94  | 
  95  |     if (requestUrl.includes('/api/chats') || requestUrl.includes('/chats')) {
  96  |       await route.fulfill({
  97  |         status: 200,
  98  |         contentType: 'application/json',
  99  |         body: JSON.stringify({ success: true, total: chats.length, data: chats }),
  100 |       });
  101 |       return;
  102 |     }
  103 | 
  104 |     if (requestUrl.includes('/api/messages/') || requestUrl.includes('/messages/')) {
  105 |       const parts = path.split('/');
  106 |       const phone = parts[parts.length - 1] || 'unknown';
  107 |       const messages = buildHistory(phone);
  108 | 
  109 |       await route.fulfill({
  110 |         status: 200,
  111 |         contentType: 'application/json',
  112 |         body: JSON.stringify({ success: true, total: messages.length, mensajes: messages }),
  113 |       });
  114 |       return;
  115 |     }
  116 | 
  117 |     await route.continue();
  118 |   });
  119 | };
  120 | 
  121 | test('soporta muchas conversaciones y mide latencia de rafaga por socket', async ({ page }) => {
  122 |   await mockApi(page);
  123 | 
  124 |   await page.addInitScript((token) => {
  125 |     localStorage.setItem('token', token);
  126 |   }, e2eToken);
  127 | 
  128 |   await page.goto('/');
  129 | 
  130 |   await expect(page.getByPlaceholder('Buscar conversación...')).toBeVisible();
  131 | 
  132 |   const firstVisibleRow = page.locator('[data-index="0"]').first();
> 133 |   await expect(firstVisibleRow).toBeVisible();
      |                                 ^ Error: expect(locator).toBeVisible() failed
  134 | 
  135 |   const renderedRows = await page.locator('[data-index]').count();
  136 |   expect(renderedRows).toBeGreaterThan(0);
  137 |   // With massive chat lists, virtualization should avoid rendering the entire dataset.
  138 |   expect(renderedRows).toBeLessThan(chatCount);
  139 | 
  140 |   const searchInput = page.getByPlaceholder('Buscar conversación...');
  141 |   await searchInput.fill('Cliente 0420');
  142 |   await expect(searchInput).toHaveValue('Cliente 0420');
  143 | 
  144 |   await searchInput.fill('');
  145 | 
  146 |   const latencyMs = await page.evaluate(async ({ count }) => {
  147 |     const phone = '5492999000000';
  148 |     const marker = `BURST-${count - 1}`;
  149 | 
  150 |     return await new Promise<number>((resolve, reject) => {
  151 |       const startedAt = performance.now();
  152 | 
  153 |       const done = () => {
  154 |         const bodyText = document.body.textContent || '';
  155 |         if (!bodyText.includes(marker)) return false;
  156 | 
  157 |         observer.disconnect();
  158 |         clearTimeout(timeout);
  159 |         resolve(performance.now() - startedAt);
  160 |         return true;
  161 |       };
  162 | 
  163 |       const observer = new MutationObserver(() => {
  164 |         done();
  165 |       });
  166 | 
  167 |       observer.observe(document.body, {
  168 |         childList: true,
  169 |         subtree: true,
  170 |         characterData: true,
  171 |       });
  172 | 
  173 |       const timeout = window.setTimeout(() => {
  174 |         observer.disconnect();
  175 |         reject(new Error('Timeout esperando render del ultimo mensaje de rafaga'));
  176 |       }, 15_000);
  177 | 
  178 |       for (let i = 0; i < count; i++) {
  179 |         const event = new CustomEvent('e2e:nuevo_mensaje', {
  180 |           detail: {
  181 |             id: `burst-${i}`,
  182 |             telefono: phone,
  183 |             mensaje: `BURST-${i}`,
  184 |             tipo: 'text',
  185 |             emisor: 'usuario',
  186 |             timestamp: new Date(Date.now() + i).toISOString(),
  187 |             nombre: 'Cliente 0001',
  188 |           },
  189 |         });
  190 |         window.dispatchEvent(event);
  191 |       }
  192 | 
  193 |       done();
  194 |     });
  195 |   }, { count: burstCount });
  196 | 
  197 |   test.info().annotations.push({
  198 |     type: 'metric',
  199 |     description: `burst_latency_ms=${latencyMs.toFixed(2)} burst_count=${burstCount} chat_count=${chatCount}`,
  200 |   });
  201 |   console.log(`[E2E_METRIC] burst_latency_ms=${latencyMs.toFixed(2)} burst_count=${burstCount} chat_count=${chatCount}`);
  202 | 
  203 |   expect(latencyMs).toBeLessThan(burstLatencyThresholdMs);
  204 |   await expect(page.getByText(`BURST-${burstCount - 1}`).first()).toBeVisible();
  205 | });
  206 | 
  207 | test('mantiene respuesta bajo rafaga mientras el operador interactua (scroll + cambio de chat)', async ({ page }) => {
  208 |   await mockApi(page);
  209 | 
  210 |   await page.addInitScript((token) => {
  211 |     localStorage.setItem('token', token);
  212 |   }, e2eToken);
  213 | 
  214 |   await page.goto('/');
  215 | 
  216 |   const searchInput = page.getByPlaceholder('Buscar conversación...');
  217 |   await expect(searchInput).toBeVisible();
  218 | 
  219 |   const latencyWithInteractionMs = await page.evaluate(async ({ count }) => {
  220 |     const phone = '5492888000000';
  221 |     const marker = `BURST-INTERACT-${count - 1}`;
  222 | 
  223 |     const findScrollableAncestor = (element: Element | null): HTMLElement | null => {
  224 |       let current: Element | null = element;
  225 |       while (current) {
  226 |         const node = current as HTMLElement;
  227 |         const style = window.getComputedStyle(node);
  228 |         if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
  229 |           return node;
  230 |         }
  231 |         current = current.parentElement;
  232 |       }
  233 |       return null;
```