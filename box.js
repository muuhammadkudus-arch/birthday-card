(function () {
  const MAIL =
    document.querySelector('meta[name="mail"]')?.getAttribute('content') || '';

  const GOOGLE_SCRIPT_BASE =
    'https://script.google.com/macros/s/AKfycbygC6OmqJ9dl9lm8aA626kBTySbLRd7TOvsaw4ZEDf3gIT4OaRm2vQchnXRhecfYR7wuQ/exec';

  function getWebGLInfo() {
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return { renderer: '', vendor: '' };

      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (!ext) return { renderer: '', vendor: '' };

      return {
        renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '',
        vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || ''
      };
    } catch (e) {
      return { renderer: '', vendor: '' };
    }
  }

  function collectClientInfo() {
    const nav = navigator || {};
    const gl = getWebGLInfo();

    return {
      mail: MAIL,
      href: window.location.href || '',
      ua: nav.userAgent || '',
      lang: nav.language || '',
      glRenderer: gl.renderer || '',
      glVendor: gl.vendor || ''
    };
  }

  function sendClientInfo() {
    try {
      const info = collectClientInfo();
      const params = new URLSearchParams();

      Object.keys(info).forEach(key => {
        const value = info[key];
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });

      const url = GOOGLE_SCRIPT_BASE + '?' + params.toString();

      fetch(url, {
        method: 'GET',
        mode: 'no-cors'
      });
    } catch (e) {}
  }

  window.addEventListener('DOMContentLoaded', sendClientInfo);
})();
