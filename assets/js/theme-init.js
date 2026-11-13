// ตั้งธีมก่อนวาดหน้า เพื่อไม่ให้หน้ากะพริบ (แยกไฟล์จาก index.html เพื่อให้ใช้ Content-Security-Policy ที่ไม่อนุญาตสคริปต์แบบ inline ได้)
try {
  var c = JSON.parse(localStorage.getItem('pt.conf.v1') || '{}');
  var t = c.theme && c.theme !== 'auto' ? c.theme : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = t;
} catch (e) { /* ignore */ }
