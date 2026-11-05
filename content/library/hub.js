(() => {
  const grid = document.querySelector('#work-grid');
  const search = document.querySelector('#search');
  const buttons = [...document.querySelectorAll('[data-category]')];
  const params = new URLSearchParams(location.search);
  let category = buttons.some(b => b.dataset.category === params.get('category')) ? params.get('category') : 'all';
  search.value = params.get('q') || '';
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(updateURL = false) {
    const q = search.value.trim().toLocaleLowerCase();
    const works = window.GARY_WORKS.filter(w => (category === 'all' || w.categories.includes(category)) && `${w.title} ${w.subtitle} ${w.description} ${w.keywords}`.toLocaleLowerCase().includes(q));
    grid.innerHTML = works.map(w => `<article class="work-card"><a class="work-cover" href="${escape(w.url)}" aria-label="${escape(w.type === '视频' ? '观看' : '打开')}：${escape(w.title)}"><img src="${escape(w.cover)}" alt="${escape(w.title)}预览" width="960" height="540"><span class="cover-label">${escape(w.label)}</span><span class="open-icon" aria-hidden="true">${w.type === '视频' ? '▶' : '↗'}</span></a><div class="card-meta"><span>${escape(w.detail)}</span><span>${escape(w.dateLabel)}</span></div><h3><a href="${escape(w.url)}">${escape(w.title)}<span aria-hidden="true">↗</span></a></h3><p class="card-subtitle" lang="en">${escape(w.subtitle)}</p><p class="card-description">${escape(w.description)}</p></article>`).join('');
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.category === category)));
    document.querySelector('#work-count').textContent = String(works.length).padStart(2, '0');
    document.querySelector('#empty-state').hidden = works.length !== 0;
    document.querySelector('#filter-status').textContent = `找到 ${works.length} 个作品`;
    if (updateURL) {
      const next = new URL(location.href);
      if (category === 'all') next.searchParams.delete('category'); else next.searchParams.set('category', category);
      if (q) next.searchParams.set('q', search.value.trim()); else next.searchParams.delete('q');
      history.replaceState(null, '', next);
    }
  }
  buttons.forEach(b => b.addEventListener('click', () => { category = b.dataset.category; render(true); }));
  search.addEventListener('input', () => render(true));
  render();
})();
