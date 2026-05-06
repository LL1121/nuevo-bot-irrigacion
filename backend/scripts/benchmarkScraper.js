#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const {
  obtenerDeudaYBoleto,
  obtenerSoloBoleto,
  obtenerDeudaPadron,
  obtenerBoletoPadron,
  obtenerLinkPagoBoleto
} = require('../src/services/debtScraperService');
const browserPool = require('../src/services/browserPool');

function parseArgs(argv) {
  const options = {
    iterations: 3,
    warmup: 1,
    timeoutMs: 90000,
    scenarios: ['dni-deuda'],
    out: null,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--iterations' || arg === '-n') {
      options.iterations = Number(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--warmup' || arg === '-w') {
      options.warmup = Number(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--timeout-ms') {
      options.timeoutMs = Number(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--scenarios' || arg === '-s') {
      options.scenarios = String(argv[i + 1] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      i += 1;
      continue;
    }

    if (arg === '--out') {
      options.out = argv[i + 1] || null;
      i += 1;
      continue;
    }
  }

  if (!Number.isFinite(options.iterations) || options.iterations < 1) {
    throw new Error('`--iterations` debe ser un entero >= 1');
  }

  if (!Number.isFinite(options.warmup) || options.warmup < 0) {
    throw new Error('`--warmup` debe ser un entero >= 0');
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1000) {
    throw new Error('`--timeout-ms` debe ser un número >= 1000');
  }

  if (!options.scenarios.length) {
    throw new Error('Debe indicar al menos un escenario en `--scenarios`');
  }

  return options;
}

function formatMs(ms) {
  return `${Math.round(ms)}ms`;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function buildScenarios() {
  const dni = process.env.BENCH_DNI;
  const cuota = (process.env.BENCH_CUOTA || 'anual').toLowerCase();
  const superficial = {
    codigoCauce: process.env.BENCH_SUPERFICIAL_CAUCE,
    numeroPadron: process.env.BENCH_SUPERFICIAL_PADRON
  };
  const subterraneo = {
    codigoDepartamento: process.env.BENCH_SUBTERRANEO_DEPTO,
    numeroPozo: process.env.BENCH_SUBTERRANEO_POZO
  };
  const contaminacion = {
    numeroContaminacion: process.env.BENCH_CONTAMINACION_NUMERO
  };

  return {
    'dni-deuda': {
      description: 'Consulta deuda por DNI',
      enabled: Boolean(dni),
      missing: ['BENCH_DNI'].filter((k) => !process.env[k]),
      run: () => obtenerDeudaYBoleto(dni)
    },
    'dni-boleto': {
      description: `Descarga boleto por DNI (${cuota})`,
      enabled: Boolean(dni),
      missing: ['BENCH_DNI'].filter((k) => !process.env[k]),
      run: () => obtenerSoloBoleto(dni, cuota === 'bimestral' ? 'bimestral' : 'anual')
    },
    'padron-superficial-deuda': {
      description: 'Consulta deuda padrón superficial',
      enabled: Boolean(superficial.codigoCauce && superficial.numeroPadron),
      missing: ['BENCH_SUPERFICIAL_CAUCE', 'BENCH_SUPERFICIAL_PADRON'].filter((k) => !process.env[k]),
      run: () => obtenerDeudaPadron('superficial', superficial, 'deuda')
    },
    'padron-superficial-boleto': {
      description: `Descarga boleto padrón superficial (${cuota})`,
      enabled: Boolean(superficial.codigoCauce && superficial.numeroPadron),
      missing: ['BENCH_SUPERFICIAL_CAUCE', 'BENCH_SUPERFICIAL_PADRON'].filter((k) => !process.env[k]),
      run: () => obtenerBoletoPadron('superficial', { ...superficial, tipoCuota: cuota }, cuota)
    },
    'padron-subterraneo-deuda': {
      description: 'Consulta deuda padrón subterráneo',
      enabled: Boolean(subterraneo.codigoDepartamento && subterraneo.numeroPozo),
      missing: ['BENCH_SUBTERRANEO_DEPTO', 'BENCH_SUBTERRANEO_POZO'].filter((k) => !process.env[k]),
      run: () => obtenerDeudaPadron('subterraneo', subterraneo, 'deuda')
    },
    'padron-contaminacion-deuda': {
      description: 'Consulta deuda padrón contaminación',
      enabled: Boolean(contaminacion.numeroContaminacion),
      missing: ['BENCH_CONTAMINACION_NUMERO'].filter((k) => !process.env[k]),
      run: () => obtenerDeudaPadron('contaminacion', contaminacion, 'deuda')
    },
    'link-pago-superficial': {
      description: `Captura link de pago padrón superficial (${cuota})`,
      enabled: Boolean(superficial.codigoCauce && superficial.numeroPadron),
      missing: ['BENCH_SUPERFICIAL_CAUCE', 'BENCH_SUPERFICIAL_PADRON'].filter((k) => !process.env[k]),
      run: () => obtenerLinkPagoBoleto('superficial', superficial, cuota)
    }
  };
}

function withTimeout(promiseFactory, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout de ${timeoutMs}ms`)), timeoutMs);

    promiseFactory()
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function runScenario(name, scenario, iterations, warmup, timeoutMs) {
  const runs = [];

  for (let i = 0; i < warmup; i += 1) {
    process.stdout.write(`🔥 Warmup ${name} ${i + 1}/${warmup}\r`);
    try {
      await withTimeout(() => scenario.run(), timeoutMs);
    } catch (_) {
      // Ignorar errores de warmup para no frenar benchmark real
    }
  }
  if (warmup > 0) process.stdout.write('\n');

  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    let ok = false;
    let errMessage = null;

    try {
      const result = await withTimeout(() => scenario.run(), timeoutMs);
      ok = !(result && result.success === false);
      if (!ok) {
        errMessage = result?.error || 'Respuesta con success=false';
      }
    } catch (err) {
      ok = false;
      errMessage = err.message || 'Error desconocido';
    }

    const durationMs = performance.now() - start;
    runs.push({
      iteration: i + 1,
      ok,
      durationMs,
      error: errMessage
    });

    const status = ok ? 'OK' : 'FAIL';
    console.log(`  ${name} #${i + 1}/${iterations} -> ${status} en ${formatMs(durationMs)}${ok ? '' : ` | ${errMessage}`}`);
  }

  const durations = runs.map((r) => r.durationMs);
  const okRuns = runs.filter((r) => r.ok).length;
  const failRuns = runs.length - okRuns;

  return {
    scenario: name,
    description: scenario.description,
    iterations,
    warmup,
    successCount: okRuns,
    failCount: failRuns,
    successRate: Number(((okRuns / runs.length) * 100).toFixed(2)),
    avgMs: Number((durations.reduce((acc, d) => acc + d, 0) / durations.length).toFixed(2)),
    minMs: Number(Math.min(...durations).toFixed(2)),
    maxMs: Number(Math.max(...durations).toFixed(2)),
    p50Ms: Number(percentile(durations, 50).toFixed(2)),
    p95Ms: Number(percentile(durations, 95).toFixed(2)),
    p99Ms: Number(percentile(durations, 99).toFixed(2)),
    errors: runs.filter((r) => !r.ok).map((r) => ({ iteration: r.iteration, error: r.error })),
    runs
  };
}

function printHelp() {
  console.log('Benchmark de scraping');
  console.log('');
  console.log('Uso:');
  console.log('  node scripts/benchmarkScraper.js [opciones]');
  console.log('');
  console.log('Opciones:');
  console.log('  -n, --iterations <n>   Iteraciones medidas por escenario (default: 3)');
  console.log('  -w, --warmup <n>       Iteraciones warmup por escenario (default: 1)');
  console.log('  --timeout-ms <n>       Timeout por iteración en ms (default: 90000)');
  console.log('  -s, --scenarios <a,b>  Lista de escenarios separados por coma');
  console.log('  --out <file>           Guarda resultados en JSON');
  console.log('  -h, --help             Mostrar ayuda');
  console.log('');
  console.log('Escenarios disponibles:');
  console.log('  dni-deuda');
  console.log('  dni-boleto');
  console.log('  padron-superficial-deuda');
  console.log('  padron-superficial-boleto');
  console.log('  padron-subterraneo-deuda');
  console.log('  padron-contaminacion-deuda');
  console.log('  link-pago-superficial');
  console.log('');
  console.log('Variables de entorno típicas:');
  console.log('  BENCH_DNI');
  console.log('  BENCH_CUOTA=anual|bimestral');
  console.log('  BENCH_SUPERFICIAL_CAUCE, BENCH_SUPERFICIAL_PADRON');
  console.log('  BENCH_SUBTERRANEO_DEPTO, BENCH_SUBTERRANEO_POZO');
  console.log('  BENCH_CONTAMINACION_NUMERO');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const allScenarios = buildScenarios();
  const selected = options.scenarios
    .map((name) => ({ name, scenario: allScenarios[name] }))
    .filter(({ scenario }) => scenario);

  const unknown = options.scenarios.filter((name) => !allScenarios[name]);
  if (unknown.length) {
    throw new Error(`Escenarios desconocidos: ${unknown.join(', ')}`);
  }

  const runnable = selected.filter(({ scenario }) => scenario.enabled);
  const skipped = selected.filter(({ scenario }) => !scenario.enabled);

  console.log('='.repeat(72));
  console.log('🏁 BENCHMARK SCRAPER');
  console.log('='.repeat(72));
  console.log(`Escenarios solicitados: ${options.scenarios.join(', ')}`);
  console.log(`Iteraciones: ${options.iterations} | Warmup: ${options.warmup} | Timeout: ${options.timeoutMs}ms`);

  if (skipped.length) {
    console.log('\n⚠️ Escenarios omitidos por variables faltantes:');
    for (const { name, scenario } of skipped) {
      console.log(`  - ${name}: faltan ${scenario.missing.join(', ')}`);
    }
  }

  if (!runnable.length) {
    throw new Error('No hay escenarios ejecutables. Configurá variables BENCH_* en .env');
  }

  const startedAt = new Date().toISOString();
  const scenarioResults = [];

  for (const { name, scenario } of runnable) {
    console.log(`\n▶ Ejecutando: ${name} (${scenario.description})`);
    const result = await runScenario(name, scenario, options.iterations, options.warmup, options.timeoutMs);
    scenarioResults.push(result);
  }

  const totalRuns = scenarioResults.reduce((acc, r) => acc + r.iterations, 0);
  const totalSuccess = scenarioResults.reduce((acc, r) => acc + r.successCount, 0);
  const totalFailures = totalRuns - totalSuccess;
  const allDurations = scenarioResults.flatMap((r) => r.runs.map((run) => run.durationMs));

  const summary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    options,
    totalScenarios: scenarioResults.length,
    totalRuns,
    totalSuccess,
    totalFailures,
    overallSuccessRate: Number(((totalSuccess / totalRuns) * 100).toFixed(2)),
    overallAvgMs: Number((allDurations.reduce((acc, d) => acc + d, 0) / allDurations.length).toFixed(2)),
    overallP50Ms: Number(percentile(allDurations, 50).toFixed(2)),
    overallP95Ms: Number(percentile(allDurations, 95).toFixed(2)),
    overallP99Ms: Number(percentile(allDurations, 99).toFixed(2))
  };

  console.log('\n' + '='.repeat(72));
  console.log('📊 RESUMEN');
  console.log('='.repeat(72));

  for (const item of scenarioResults) {
    console.log(`\n${item.scenario}`);
    console.log(`  success: ${item.successCount}/${item.iterations} (${item.successRate}%)`);
    console.log(`  avg: ${formatMs(item.avgMs)} | p50: ${formatMs(item.p50Ms)} | p95: ${formatMs(item.p95Ms)} | p99: ${formatMs(item.p99Ms)}`);
    console.log(`  min: ${formatMs(item.minMs)} | max: ${formatMs(item.maxMs)}`);
    if (item.errors.length) {
      console.log(`  errores: ${item.errors.map((e) => `#${e.iteration} ${e.error}`).join(' | ')}`);
    }
  }

  console.log('\nGLOBAL');
  console.log(`  success: ${summary.totalSuccess}/${summary.totalRuns} (${summary.overallSuccessRate}%)`);
  console.log(`  avg: ${formatMs(summary.overallAvgMs)} | p50: ${formatMs(summary.overallP50Ms)} | p95: ${formatMs(summary.overallP95Ms)} | p99: ${formatMs(summary.overallP99Ms)}`);

  const output = {
    summary,
    scenarios: scenarioResults
  };

  if (options.out) {
    const outputPath = path.resolve(process.cwd(), options.out);
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`\n💾 Resultado JSON guardado en: ${outputPath}`);
  }
}

main()
  .catch((err) => {
    console.error(`\n❌ Benchmark falló: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await browserPool.closeAll();
    } catch (_) {
      // noop
    }
  });
