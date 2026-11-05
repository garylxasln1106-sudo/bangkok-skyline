(() => {
  const video = document.querySelector('#training-video');
  const chapters = [...document.querySelectorAll('[data-time]')];
  chapters.forEach(button => button.addEventListener('click', () => {
    const time = Number(button.dataset.time);
    const seek = () => { video.currentTime = time; video.play().catch(() => {}); };
    if (video.readyState >= 1) seek(); else { video.addEventListener('loadedmetadata', seek, {once: true}); video.load(); }
  }));
  video.addEventListener('timeupdate', () => {
    let active = chapters[0];
    for (const c of chapters) if (video.currentTime >= Number(c.dataset.time)) active = c;
    chapters.forEach(c => { if (c === active) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current'); });
  });
  const share = async (url, label) => {
    const status = document.querySelector('#copy-status');
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = `${label}已复制`;
      document.querySelector('#copy-fallback').hidden = true;
    } catch {
      document.querySelector('#copy-fallback').hidden = false;
      const input = document.querySelector('#copy-link'); input.value = url; input.focus(); input.select();
      status.textContent = '请复制下方链接';
    }
  };
  document.querySelector('#copy-page').addEventListener('click', () => share(location.href.split('#')[0], '播放页链接'));
  document.querySelector('#copy-video').addEventListener('click', () => share(new URL('../../media/thailand-bd-two-hotels-one-month.mp4', location.href).href, 'MP4 直链'));
})();
