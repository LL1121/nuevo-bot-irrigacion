import { expect, test } from '@playwright/test';

type RawChat = {
  id: number;
  telefono: string;
  nombre_whatsapp: string;
  ultimo_mensaje: { cuerpo: string; created_at: string };
  ultimo_mensaje_fecha: string;
  mensajes_no_leidos: number;
};

type RawMessage = {
  id: string;
  contenido: string;
  emisor: string;
  tipo: string;
  created_at: string;
};

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const chatCount = parsePositiveInt(process.env.E2E_CHAT_COUNT, 10_000);
const historyCount = parsePositiveInt(process.env.E2E_HISTORY_COUNT, 250);
const burstCount = parsePositiveInt(process.env.E2E_BURST_COUNT, 300);
const burstLatencyThresholdMs = parsePositiveInt(process.env.E2E_BURST_LATENCY_MAX_MS, 3000);
const burstInteractionThresholdMs = parsePositiveInt(process.env.E2E_BURST_INTERACTION_LATENCY_MAX_MS, 5000);
const e2eToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjQxMDI0NDQ4MDB9.signature';

const buildChats = (): RawChat[] => {
  const now = Date.now();
  return Array.from({ length: chatCount }, (_, i) => {
    const idx = i + 1;
    const ts = new Date(now - i * 1000).toISOString();
    return {
      id: idx,
      telefono: `5492604${String(idx).padStart(6, '0')}`,
      nombre_whatsapp: `Cliente ${String(idx).padStart(4, '0')}`,
      ultimo_mensaje: { cuerpo: `Ultimo mensaje ${idx}`, created_at: ts },
      ultimo_mensaje_fecha: ts,
      mensajes_no_leidos: idx % 4,
    };
  });
};

const buildHistory = (phone: string): RawMessage[] => {
  const now = Date.now();
  return Array.from({ length: historyCount }, (_, i) => ({
    id: `${phone}-hist-${i}`,
    contenido: `Hist ${i}`,
    emisor: i % 2 === 0 ? 'usuario' : 'operador',
    tipo: 'text',
    created_at: new Date(now - (historyCount - i) * 2000).toISOString(),
  }));
};

const mockApi = async (page: import('@playwright/test').Page) => {
  const chats = buildChats();

  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url();
    const url = new URL(requestUrl);
    const path = url.pathname;

    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'access-control-allow-headers': '*',
        },
      });
      return;
    }

    if (requestUrl.includes('/api/auth/login') || requestUrl.includes('/auth/login')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'e2e-token',
          refreshToken: 'e2e-refresh',
          operador: { nombre: 'E2E Operador', email: 'e2e@bot.local' },
        }),
      });
      return;
    }

    if (requestUrl.includes('/api/chats') || requestUrl.includes('/chats')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, total: chats.length, data: chats }),
      });
      return;
    }

    if (requestUrl.includes('/api/messages/') || requestUrl.includes('/messages/')) {
      const parts = path.split('/');
      const phone = parts[parts.length - 1] || 'unknown';
      const messages = buildHistory(phone);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, total: messages.length, mensajes: messages }),
      });
      return;
    }

    await route.continue();
  });
};

test('soporta muchas conversaciones y mide latencia de rafaga por socket', async ({ page }) => {
  await mockApi(page);

  await page.addInitScript((token) => {
    localStorage.setItem('token', token);
  }, e2eToken);

  await page.goto('/');

  await expect(page.getByPlaceholder('Buscar conversación...')).toBeVisible();

  const firstVisibleRow = page.locator('[data-index="0"]').first();
  await expect(firstVisibleRow).toBeVisible();

  const renderedRows = await page.locator('[data-index]').count();
  expect(renderedRows).toBeGreaterThan(0);
  // With massive chat lists, virtualization should avoid rendering the entire dataset.
  expect(renderedRows).toBeLessThan(chatCount);

  const searchInput = page.getByPlaceholder('Buscar conversación...');
  await searchInput.fill('Cliente 0420');
  await expect(searchInput).toHaveValue('Cliente 0420');

  await searchInput.fill('');

  const latencyMs = await page.evaluate(async ({ count }) => {
    const phone = '5492999000000';
    const marker = `BURST-${count - 1}`;

    return await new Promise<number>((resolve, reject) => {
      const startedAt = performance.now();

      const done = () => {
        const bodyText = document.body.textContent || '';
        if (!bodyText.includes(marker)) return false;

        observer.disconnect();
        clearTimeout(timeout);
        resolve(performance.now() - startedAt);
        return true;
      };

      const observer = new MutationObserver(() => {
        done();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      const timeout = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error('Timeout esperando render del ultimo mensaje de rafaga'));
      }, 15_000);

      for (let i = 0; i < count; i++) {
        const event = new CustomEvent('e2e:nuevo_mensaje', {
          detail: {
            id: `burst-${i}`,
            telefono: phone,
            mensaje: `BURST-${i}`,
            tipo: 'text',
            emisor: 'usuario',
            timestamp: new Date(Date.now() + i).toISOString(),
            nombre: 'Cliente 0001',
          },
        });
        window.dispatchEvent(event);
      }

      done();
    });
  }, { count: burstCount });

  test.info().annotations.push({
    type: 'metric',
    description: `burst_latency_ms=${latencyMs.toFixed(2)} burst_count=${burstCount} chat_count=${chatCount}`,
  });
  console.log(`[E2E_METRIC] burst_latency_ms=${latencyMs.toFixed(2)} burst_count=${burstCount} chat_count=${chatCount}`);

  expect(latencyMs).toBeLessThan(burstLatencyThresholdMs);
  await expect(page.getByText(`BURST-${burstCount - 1}`).first()).toBeVisible();
});

test('mantiene respuesta bajo rafaga mientras el operador interactua (scroll + cambio de chat)', async ({ page }) => {
  await mockApi(page);

  await page.addInitScript((token) => {
    localStorage.setItem('token', token);
  }, e2eToken);

  await page.goto('/');

  const searchInput = page.getByPlaceholder('Buscar conversación...');
  await expect(searchInput).toBeVisible();

  const latencyWithInteractionMs = await page.evaluate(async ({ count }) => {
    const phone = '5492888000000';
    const marker = `BURST-INTERACT-${count - 1}`;

    const findScrollableAncestor = (element: Element | null): HTMLElement | null => {
      let current: Element | null = element;
      while (current) {
        const node = current as HTMLElement;
        const style = window.getComputedStyle(node);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          return node;
        }
        current = current.parentElement;
      }
      return null;
    };

    return await new Promise<number>((resolve, reject) => {
      const startedAt = performance.now();

      const done = () => {
        const bodyText = document.body.textContent || '';
        if (!bodyText.includes(marker)) return false;

        observer.disconnect();
        clearTimeout(timeout);
        resolve(performance.now() - startedAt);
        return true;
      };

      const observer = new MutationObserver(() => {
        done();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      const timeout = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error('Timeout esperando render del ultimo mensaje con interacciones concurrentes'));
      }, 20_000);

      const firstRow = document.querySelector('[data-index="0"]');
      const conversationsScroller = findScrollableAncestor(firstRow);

      const dispatchNext = (i: number) => {
        if (i >= count) {
          done();
          return;
        }

        const event = new CustomEvent('e2e:nuevo_mensaje', {
          detail: {
            id: `burst-interact-${i}`,
            telefono: phone,
            mensaje: `BURST-INTERACT-${i}`,
            tipo: 'text',
            emisor: 'usuario',
            timestamp: new Date(Date.now() + i).toISOString(),
            nombre: 'Cliente Interaccion',
          },
        });
        window.dispatchEvent(event);

        // Simular actividad del operador durante la ráfaga.
        if (i % 25 === 0) {
          if (conversationsScroller) {
            conversationsScroller.scrollTop = conversationsScroller.scrollTop + 420;
          }

          const rows = Array.from(document.querySelectorAll('[data-index]')) as HTMLElement[];
          const candidate = rows[Math.min(6, rows.length - 1)];
          candidate?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }

        window.setTimeout(() => dispatchNext(i + 1), 2);
      };

      dispatchNext(0);
    });
  }, { count: burstCount });

  test.info().annotations.push({
    type: 'metric',
    description: `burst_interaction_latency_ms=${latencyWithInteractionMs.toFixed(2)} burst_count=${burstCount} chat_count=${chatCount}`,
  });
  console.log(`[E2E_METRIC] burst_interaction_latency_ms=${latencyWithInteractionMs.toFixed(2)} burst_count=${burstCount} chat_count=${chatCount}`);

  expect(latencyWithInteractionMs).toBeLessThan(burstInteractionThresholdMs);
  await expect(page.getByText(`BURST-INTERACT-${burstCount - 1}`).first()).toBeVisible();
});

test('renderiza mensaje entrante vacio con fallback visible en chat principal', async ({ page }) => {
  await mockApi(page);

  await page.addInitScript((token) => {
    localStorage.setItem('token', token);
  }, e2eToken);

  await page.goto('/');
  await expect(page.getByPlaceholder('Buscar conversación...')).toBeVisible();

  // Abrir primer chat visible para validar panel principal.
  const firstVisibleRow = page.locator('[data-index="0"]').first();
  await firstVisibleRow.click();

  await page.evaluate(() => {
    const event = new CustomEvent('e2e:nuevo_mensaje', {
      detail: {
        id: 'empty-visible-regression',
        telefono: '5492604000001',
        mensaje: '',
        tipo: 'text',
        emisor: 'usuario',
      },
    });
    window.dispatchEvent(event);
  });

  await expect(page.getByText('[Mensaje sin contenido]').first()).toBeVisible();
});
