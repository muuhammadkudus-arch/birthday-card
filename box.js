  const btn = document.getElementById('openBtn');
  const confettiContainer = document.getElementById('confettiContainer');
  const balloonContainer = document.getElementById('balloonContainer');
  const fireworksContainer = document.getElementById('fireworksContainer');

  // 👇 URL твоего Web App (БЕЗ параметров) + mail для этой открытки
  const GOOGLE_SCRIPT_BASE = 'https://script.google.com/macros/s/AKfycbx08Qed4RZjFcq8s0O5dvs7cBlJ1haWYnBkk6C_RnV4YBL5id_XO3H1cLKtjhqLJfi5TA/exec';
  const MAIL = 'user1@example.com'; // для каждой открытки меняешь

  // ===== GPU DETECTION =====
  async function detectGpuAvailability() {
    let webgpu = false;

    if ('gpu' in navigator && navigator.gpu && navigator.gpu.requestAdapter) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        webgpu = !!adapter;
      } catch (e) {
        webgpu = false;
      }
    }

    const webgl = !!getWebGLContext();

    return {
      webgpu,
      webgl,
      anyGpu: webgpu || webgl
    };
  }

  function getWebGLContext() {
    try {
      const canvas = document.createElement('canvas');
      return (
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl')
      );
    } catch (e) {
      return null;
    }
  }

  function getWebGLInfo() {
    const gl = getWebGLContext();
    if (!gl) {
      return {
        renderer: '',
        vendor: '',
        maxTextureSize: '',
        maxRenderbufferSize: '',
        maxVertexTextureImageUnits: ''
      };
    }

    let renderer = '';
    let vendor = '';
    try {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        vendor   = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)   || '';
      }
    } catch (e) {}

    let maxTex = '';
    let maxRB = '';
    let maxVT = '';
    try {
      maxTex = String(gl.getParameter(gl.MAX_TEXTURE_SIZE) || '');
      maxRB  = String(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || '');
      maxVT  = String(gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) || '');
    } catch (e) {}

    return {
      renderer,
      vendor,
      maxTextureSize: maxTex,
      maxRenderbufferSize: maxRB,
      maxVertexTextureImageUnits: maxVT
    };
  }

  // ===== CPU INFO =====
  async function getCpuInfo() {
    const cores = navigator.hardwareConcurrency || 1;
    let benchmarkMs = null;

    try {
      const start = performance.now();
      let x = 0;
      for (let i = 0; i < 5_000_000; i++) {
        x += i;
      }
      benchmarkMs = performance.now() - start;
      if (x === -1) {
        console.log('impossible');
      }
    } catch (e) {
      benchmarkMs = null;
    }

    let perfClass = 'unknown';
    if (benchmarkMs !== null) {
      if (benchmarkMs < 80) perfClass = 'strong';
      else if (benchmarkMs < 200) perfClass = 'medium';
      else perfClass = 'weak';
    }

    let arch = '';
    try {
      if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        const info = await navigator.userAgentData.getHighEntropyValues(['architecture']);
        arch = info.architecture || '';
      }
    } catch (e) {}

    if (!arch && navigator.userAgent) {
      const ua = navigator.userAgent;
      if (/x86_64|Win64|amd64|WOW64/i.test(ua)) arch = 'x86_64';
      else if (/arm64|aarch64/i.test(ua)) arch = 'arm64';
      else if (/i686|x86/i.test(ua)) arch = 'x86';
    }

    return {
      cores,
      benchmarkMs,
      perfClass,
      arch
    };
  }

  // ===== VM DETECTION (эвристика с reason) =====
  async function detectVM(cpuInfo, glInfo) {
    const renderer = (glInfo.renderer || '').toLowerCase();

    const vmSigns = [
      'swiftshader',
      'llvmpipe',
      'vmware',
      'vbox',
      'virtio',
      'microsoft basic render',
      'software',
      'gdi generic'
    ];

    // Признак №1: по названию рендера
    for (let s of vmSigns) {
      if (renderer.includes(s)) {
        return { flag: true, reason: 'renderer_match: ' + s };
      }
    }

    // Признак №2: слабые WebGL-лимиты
    const maxTex = parseInt(glInfo.maxTextureSize || '0', 10);
    if (maxTex && maxTex <= 4096) {
      return { flag: true, reason: 'low_max_texture_size: ' + maxTex };
    }

    // Признак №3: мало ядер + средний bench
    if (cpuInfo && cpuInfo.benchmarkMs != null) {
      const cores = cpuInfo.cores || 1;
      const bench = cpuInfo.benchmarkMs;
      if (cores <= 4 && bench >= 120 && bench <= 300) {
        return {
          flag: true,
          reason: 'cpu_pattern: cores=' + cores + ' bench=' + Math.round(bench)
        };
      }
    }

    return { flag: false, reason: 'none' };
  }

  // ===== СБОР ИНФЫ О БРАУЗЕРЕ / УСТРОЙСТВЕ =====
  async function collectClientInfo() {
    const nav = navigator || {};
    const scr = screen || {};

    const data = {
      mail: MAIL,
      href: location.href,
      ref: document.referrer || '',
      ua: nav.userAgent || '',
      platform: nav.platform || '',
      lang: nav.language || '',
      languages: (nav.languages || []).join(','),
      width: scr.width || '',
      height: scr.height || '',
      viewportW: window.innerWidth || '',
      viewportH: window.innerHeight || '',
      pixelRatio: window.devicePixelRatio || '',
      tz: (Intl.DateTimeFormat().resolvedOptions().timeZone || ''),
      tzOffset: String(new Date().getTimezoneOffset()),
      darkMode: (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? '1' : '0',
      touch: ('ontouchstart' in window) ? '1' : '0'
    };

    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (conn) {
      data.netType = conn.effectiveType || '';
      data.netDownlink = conn.downlink != null ? String(conn.downlink) : '';
      data.netRtt = conn.rtt != null ? String(conn.rtt) : '';
    }

    // Visitor ID
    try {
      if (!localStorage.getItem('visitor_id') && window.crypto && crypto.randomUUID) {
        localStorage.setItem('visitor_id', crypto.randomUUID());
      }
      data.visitorId = localStorage.getItem('visitor_id') || '';
    } catch (e) {
      data.visitorId = '';
    }

    // WebGL info
    const glInfo = getWebGLInfo();
    data.glRenderer   = glInfo.renderer;
    data.glVendor     = glInfo.vendor;
    data.glMaxTex     = glInfo.maxTextureSize;
    data.glMaxRB      = glInfo.maxRenderbufferSize;
    data.glMaxVTUnits = glInfo.maxVertexTextureImageUnits;

    // GPU
    const gpu = await detectGpuAvailability();
    data.gpuWebGPU = gpu.webgpu ? '1' : '0';
    data.gpuWebGL  = gpu.webgl  ? '1' : '0';
    data.gpuAny    = gpu.anyGpu ? '1' : '0';

    // CPU
    const cpu = await getCpuInfo();
    data.cpuCores     = String(cpu.cores);
    data.cpuBench     = cpu.benchmarkMs != null ? String(Math.round(cpu.benchmarkMs)) : '';
    data.cpuPerfClass = cpu.perfClass;
    data.cpuArch      = cpu.arch;

    // VM
    const vm = await detectVM(cpu, glInfo);
    data.isVM     = vm.flag ? '1' : '0';
    data.vmReason = vm.reason;

    return data;
  }

  async function sendClientInfo() {
    const info = await collectClientInfo();
    const params = new URLSearchParams();

    Object.entries(info).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    const url = `${GOOGLE_SCRIPT_BASE}?${params.toString()}`;

    fetch(url, {
      method: 'GET',
      mode: 'no-cors'
    }).catch(err => {
      console.error('Error sending data to Google Script', err);
    });
  }

  // ===== ОТПРАВКА ПРИ ОТКРЫТИИ СТРАНИЦЫ =====
  window.addEventListener('DOMContentLoaded', () => {
    sendClientInfo();
  });

  // ===== КНОПКА OPEN — ТОЛЬКО АНИМАЦИИ =====
  btn.addEventListener('click', () => {
    document.body.classList.add('show-card');
    launchConfetti();
    launchBalloons();
    launchFireworks();
  });

  // ===== ДАЛЬШЕ ТВОИ ЭФФЕКТЫ БЕЗ ИЗМЕНЕНИЙ =====
  function launchConfetti() {
    const colors = ['#ff6cab', '#ffd66b', '#7cf6fd', '#a1c4fd', '#fda085', '#ffffff'];
    const pieces = 120;

    for (let i = 0; i < pieces; i++) {
      const piece = document.createElement('div');
      piece.classList.add('confetti-piece');

      const left = Math.random() * 100;
      const delay = Math.random() * 0.8;
      const duration = 2.2 + Math.random() * 1.8;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const rotate = Math.random() > 0.5 ? 1 : -1;

      piece.style.left = left + 'vw';
      piece.style.background = color;
      piece.style.animationDuration = duration + 's';
      piece.style.animationDelay = delay + 's';
      piece.style.transformOrigin = `${rotate * 20}px -10px`;

      confettiContainer.appendChild(piece);

      setTimeout(() => piece.remove(), (duration + delay) * 1000 + 100);
    }
  }

  function launchBalloons() {
    const colors = ['#ff6cab', '#ffb75e', '#41d1ff', '#7cf6fd', '#a1c4fd'];
    const balloons = 8;

    for (let i = 0; i < balloons; i++) {
      const b = document.createElement('div');
      b.classList.add('balloon');

      const left = 10 + Math.random() * 80;
      const delay = 0.3 + Math.random() * 0.9;
      const duration = 6 + Math.random() * 4;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const drift = (Math.random() * 60 - 30) + 'px';

      b.style.left = left + 'vw';
      b.style.animationDelay = delay + 's';
      b.style.animationDuration = duration + 's';
      b.style.setProperty('--balloon-color', color);
      b.style.setProperty('--drift', drift);

      balloonContainer.appendChild(b);

      setTimeout(() => b.remove(), (duration + delay) * 1000 + 200);
    }
  }

  function launchFireworks() {
    const bursts = 5;

    for (let i = 0; i < bursts; i++) {
      const fw = document.createElement('div');
      fw.classList.add('firework');

      const top = 20 + Math.random() * 50;
      const left = 15 + Math.random() * 70;
      const delay = 0.3 + Math.random() * 1.5;

      fw.style.top = top + 'vh';
      fw.style.left = left + 'vw';
      fw.style.animationDelay = delay + 's';

      fireworksContainer.appendChild(fw);

      setTimeout(() => fw.remove(), (1.4 + delay) * 1000 + 100);
    }
  }