const { createApp } = Vue;

createApp({
  data() {
    return {
      runners: [],
      pageSize: 100,
      currentPage: 1,
      loading: true,
      error: '',
      tooltip: { visible: false, x: 0, y: 0, runner: {} },
    };
  },
  computed: {
    totalRunners() {
      return this.runners.length;
    },
    totalPages() {
      return Math.max(1, Math.ceil(this.totalRunners / this.pageSize));
    },
    firstVisible() {
      return (this.currentPage - 1) * this.pageSize;
    },
    lastVisible() {
      return Math.min(this.firstVisible + this.pageSize, this.totalRunners);
    },
    visibleRunners() {
      return this.runners.slice(this.firstVisible, this.lastVisible);
    },
    validRunners() {
      return this.runners.filter((runner) => this.timeToSeconds(runner.finish_time) !== null);
    },
    topCountries() {
      const counts = d3.rollup(this.runners, (values) => values.length, (runner) => runner.country);
      const countries = [...counts].sort((a, b) => d3.descending(a[1], b[1]));
      const total = this.totalRunners || 1;
      return countries.slice(0, 5).map(([name, count]) => ({ name, count, share: Math.round((count / total) * 100) }));
    },
    countryRemainderText() {
      const visible = new Set(this.topCountries.map((country) => country.name));
      const remainder = this.runners.filter((runner) => !visible.has(runner.country)).length;
      return remainder ? `Другие страны — ${this.formatNumber(remainder)} участников` : '';
    },
    topMen() {
      return this.fastestByGender('M');
    },
    topWomen() {
      return this.fastestByGender('F');
    },
  },
  methods: {
    formatNumber(value) {
      return d3.format(',')(value).replace(/,/g, ' ');
    },
    timeToSeconds(value) {
      if (!value || !/^\d{1,2}:\d{2}:\d{2}$/.test(value)) return null;
      const [hours, minutes, seconds] = value.split(':').map(Number);
      return hours * 3600 + minutes * 60 + seconds;
    },
    formatDuration(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainder = seconds % 60;
      return [hours, minutes, remainder].map((value) => String(value).padStart(2, '0')).join(':');
    },
    fastestByGender(gender) {
      return this.validRunners.filter((runner) => runner.gender === gender).sort((a, b) => this.timeToSeconds(a.finish_time) - this.timeToSeconds(b.finish_time)).slice(0, 3);
    },
    drawCharts() {
      this.drawAgeChart();
      this.drawFinishChart();
    },
    drawAgeChart() {
      const svg = d3.select(this.$refs.ageChart);
      const width = 430;
      const height = 260;
      const margin = { top: 8, right: 28, bottom: 8, left: 28 };
      const ages = d3.range(18, 82);
      const counts = (gender) => ages.map((age) => this.runners.filter((runner) => runner.gender === gender && runner.age === age).length);
      const men = counts('M');
      const women = counts('F');
      const max = d3.max([...men, ...women]) || 1;
      const x = d3.scaleLinear().domain([0, max]).range([0, (width - margin.left - margin.right) / 2 - 5]);
      const y = d3.scaleBand().domain(ages).range([margin.top, height - margin.bottom]).paddingInner(0.17);
      svg.attr('viewBox', `0 0 ${width} ${height}`).selectAll('*').remove();
      const chart = svg.append('g').attr('transform', `translate(${margin.left},0)`);
      chart.append('line').attr('x1', (width - margin.left - margin.right) / 2).attr('x2', (width - margin.left - margin.right) / 2).attr('y1', margin.top).attr('y2', height - margin.bottom).attr('stroke', '#d6d8d3');
      [men, women].forEach((values, side) => {
        chart.selectAll(`.age-bar-${side}`).data(values).join('rect').attr('class', `age-bar-${side}`).attr('x', (d) => side === 0 ? (width - margin.left - margin.right) / 2 - x(d) : (width - margin.left - margin.right) / 2 + 2).attr('y', (_, i) => y(ages[i])).attr('width', (d) => x(d)).attr('height', y.bandwidth()).attr('fill', side === 0 ? '#69aaf0' : '#f28d9b').attr('opacity', .9).append('title').text((d, i) => `${ages[i]} лет: ${d} человек`);
      });
      chart.selectAll('.age-label').data([19, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80]).join('text').attr('class', 'age-label').attr('x', (width - margin.left - margin.right) / 2 + 10).attr('y', (age) => y(age) + y.bandwidth()).text((age) => age).attr('fill', '#9a9d98').attr('font-size', 10).attr('font-family', 'DM Mono');
    },
    drawFinishChart() {
      const svg = d3.select(this.$refs.finishChart);
      const wrap = this.$refs.finishChartWrap;
      const width = Math.max(760, wrap.clientWidth || 900);
      const height = 310;
      const margin = { top: 10, right: 18, bottom: 34, left: 18 };
      const runners = this.validRunners.map((runner) => ({ ...runner, seconds: this.timeToSeconds(runner.finish_time) }));
      const grouped = d3.groups(runners, (runner) => Math.floor(runner.seconds / 60)).sort((a, b) => d3.ascending(a[0], b[0]));
      const maxCount = d3.max(grouped, ([, values]) => values.length) || 1;
      const x = d3.scaleLinear().domain(d3.extent(runners, (runner) => runner.seconds)).range([margin.left, width - margin.right]);
      const y = d3.scaleLinear().domain([0, maxCount]).range([height - margin.bottom, margin.top]);
      svg.attr('viewBox', `0 0 ${width} ${height}`).selectAll('*').remove();
      const chart = svg.append('g');
      chart.append('line').attr('class', 'finish-baseline').attr('x1', margin.left).attr('x2', width - margin.right).attr('y1', height - margin.bottom).attr('y2', height - margin.bottom);
      grouped.forEach(([minute, values]) => {
        values.sort((a, b) => d3.ascending(a.gender, b.gender) || d3.ascending(a.age, b.age));
        chart.selectAll(`.finish-${minute}`).data(values).join('rect').attr('class', 'finish-tick').attr('x', (runner) => x(runner.seconds) - 1).attr('y', (_, index) => y(index + 1)).attr('width', 2).attr('height', Math.max(2, (height - margin.bottom - margin.top) / maxCount * .92)).attr('fill', (runner) => runner.gender === 'M' ? '#60a9ed' : '#f18d9a').on('mouseenter', (event, runner) => { const bounds = wrap.getBoundingClientRect(); this.tooltip = { visible: true, x: event.clientX - bounds.left + 12, y: event.clientY - bounds.top - 20, runner }; }).on('mousemove', (event) => { const bounds = wrap.getBoundingClientRect(); this.tooltip.x = event.clientX - bounds.left + 12; this.tooltip.y = event.clientY - bounds.top - 20; }).on('mouseleave', () => { this.tooltip.visible = false; });
      });
      const ticks = d3.ticks(x.domain()[0], x.domain()[1], 8);
      chart.selectAll('.finish-tick-label').data(ticks).join('text').attr('class', 'finish-tick-label').attr('x', (value) => x(value)).attr('y', height - 9).attr('text-anchor', 'middle').text((value) => this.formatDuration(value).slice(0, 5)).attr('fill', '#7d807a').attr('font-size', 11).attr('font-family', 'DM Mono');
    },
  },
  async mounted() {
    try {
      const response = await fetch('results.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.runners = await response.json();
    } catch (error) {
      this.error = `Не удалось загрузить результаты: ${error.message}`;
      } finally {
        this.loading = false;
        this.$nextTick(() => this.drawCharts());
      }
    },
}).mount('#app');
