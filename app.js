const { createApp } = Vue;
const requestedTheme = new URLSearchParams(location.search).get('theme');
const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.dataset.theme = requestedTheme === 'dark' || (requestedTheme === 'system' && systemDark) ? 'dark' : 'light';

createApp({
  data() {
    return { results: [], loading: true, error: '', hovered: null, tooltipStyle: { left: '0px', top: '0px' } };
  },
  computed: {
    total() { return this.results.length; },
    finishers() { return this.results.filter(d => d.status === 'OK' && /^\d+:\d{2}:\d{2}$/.test(d.finish_time)); },
    genderCounts() { return d3.rollup(this.results, v => v.length, d => d.gender); },
    ageRange() { const values = this.results.map(d => d.age); return [d3.min(values), d3.max(values)]; },
    topCountries() {
      const counts = d3.rollup(this.results, v => v.length, d => d.country);
      return [...counts].sort((a,b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name: this.countryName(name), count, percent: Math.round(count / this.total * 100) }));
    },
    otherCountries() { return Math.max(0, new Set(this.results.map(d => d.country)).size - this.topCountries.length); },
    podium() {
      const valid = this.results.filter(d => d.status === 'OK' && d.place !== '-');
      return { M: valid.filter(d => d.gender === 'M').sort((a,b) => +a.place - +b.place).slice(0, 3), F: valid.filter(d => d.gender === 'F').sort((a,b) => +a.place - +b.place).slice(0, 3) };
    }
  },
  async mounted() {
    try { this.results = window.MM_RESULTS || await d3.json('data/results.json'); this.loading = false; this.$nextTick(() => { this.drawAgeChart(); this.drawFinishChart(); }); }
    catch (error) { this.error = error.message; this.loading = false; }
    window.addEventListener('resize', () => { if (this.results.length) { this.drawAgeChart(); this.drawFinishChart(); } });
  },
  methods: {
    formatNumber(value) { return new Intl.NumberFormat('ru-RU').format(value); },
    genderCount(gender) { return this.genderCounts.get(gender) || 0; },
    genderPercent(gender) { return Math.round(this.genderCount(gender) / this.total * 100); },
    countryName(name) { return name === 'Russian Federation' ? 'Россия' : name; },
    setHovered(event, runner, bounds) {
      this.hovered = runner;
      this.tooltipStyle = { left: `${event.clientX - bounds.left}px`, top: `${event.clientY - bounds.top}px` };
    },
    drawAgeChart() {
      const node = this.$refs.ageSvg; const width = node.clientWidth || 320; const height = 360;
      const svg = d3.select(node); svg.selectAll('*').remove(); svg.attr('viewBox', `0 0 ${width} ${height}`);
      const margin = { top: 16, right: 38, bottom: 12, left: 8 }; const ages = d3.range(this.ageRange[0], this.ageRange[1] + 1);
      const counts = d3.rollup(this.results, v => v.length, d => d.age, d => d.gender); const max = d3.max(ages, age => Math.max(counts.get(age)?.get('M') || 0, counts.get(age)?.get('F') || 0));
      const x = d3.scaleLinear().domain([-max, max]).range([margin.left, width - margin.right]); const y = d3.scaleBand().domain(ages).range([margin.top, height - margin.bottom]).padding(.16);
      const g = svg.append('g'); g.selectAll('.grid').data([0, Math.round(max * .5), max]).join('line').attr('x1', d => x(d)).attr('x2', d => x(d)).attr('y1', margin.top).attr('y2', height - margin.bottom).attr('stroke', '#e5e5e5');
      g.selectAll('.men').data(ages).join('rect').attr('x', d => x(-(counts.get(d)?.get('M') || 0))).attr('y', d => y(d)).attr('width', d => x(0) - x(-(counts.get(d)?.get('M') || 0))).attr('height', y.bandwidth()).attr('fill', '#74b7f1');
      g.selectAll('.women').data(ages).join('rect').attr('x', x(0)).attr('y', d => y(d)).attr('width', d => x(counts.get(d)?.get('F') || 0) - x(0)).attr('height', y.bandwidth()).attr('fill', '#ef9aaa');
      g.selectAll('.age-label').data(ages.filter(age => age % 5 === 0 || age === ages[0])).join('text').attr('x', width - 7).attr('y', d => y(d) + y.bandwidth() / 2 + 4).attr('fill', '#999').attr('font-size', 12).text(d => d);
    },
    drawFinishChart() {
      const container = this.$refs.finishChart; const width = container.clientWidth; const height = width < 600 ? 340 : 400; const margin = { top: 10, right: 18, bottom: 38, left: 8 }; const svg = d3.select(container).selectAll('svg').data([null]).join('svg').attr('viewBox', `0 0 ${width} ${height}`); svg.selectAll('*').remove();
      const parsed = this.finishers.map(d => ({ ...d, seconds: d.finish_time.split(':').map(Number).reduce((total, value) => total * 60 + value, 0) })); const domain = d3.extent(parsed, d => d.seconds); const x = d3.scaleLinear().domain(domain).range([margin.left, width - margin.right]);
      const bins = d3.bin().value(d => d.seconds).domain(domain).thresholds(Math.min(420, Math.max(180, Math.floor(width / 3))))(parsed); const y = d3.scaleLinear().domain([0, d3.max(bins, d => d.length)]).range([height - margin.bottom, margin.top]);
      const binWidth = Math.max(1.7, x(bins[0].x1) - x(bins[0].x0) - .6); const pixels = []; bins.forEach(bin => bin.forEach((runner, index) => pixels.push({ runner, x: x((bin.x0 + bin.x1) / 2), y: y(0) - (index + 1) * Math.max(1.5, (y(0) - y(1)) * .72), w: binWidth })));
      svg.append('g').attr('class', 'grid').selectAll('line').data([.25,.5,.75]).join('line').attr('x1', margin.left).attr('x2', width - margin.right).attr('y1', d => margin.top + (height - margin.top - margin.bottom) * d).attr('y2', d => margin.top + (height - margin.top - margin.bottom) * d);
      const bounds = container.getBoundingClientRect(); svg.append('g').selectAll('rect').data(pixels).join('rect').attr('class', 'pixel').attr('x', d => d.x - d.w / 2).attr('y', d => d.y).attr('width', d => d.w).attr('height', 2.3).attr('fill', d => d.runner.gender === 'M' ? (d.runner.class === 'elite' ? '#287de0' : '#69aef0') : (d.runner.class === 'elite' ? '#df7189' : '#ef9aaa')).on('mouseenter', (event, d) => this.setHovered(event, d.runner, bounds)).on('mousemove', (event, d) => this.setHovered(event, d.runner, bounds)).on('mouseleave', () => { this.hovered = null; });
      const axis = d3.axisBottom(x).ticks(width < 600 ? 4 : 8).tickFormat(seconds => new Date(seconds * 1000).toISOString().slice(11, 19)); svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${height - margin.bottom})`).call(axis);
    }
  }
}).mount('#app');
