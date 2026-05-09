import { App, PostMessageTransport } from '@modelcontextprotocol/ext-apps'
import { Chart, registerables } from 'chart.js'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  GLEAN_CHART_PALETTE,
  GLEAN_PRIMARY_SOFT_FILL,
  gleanCartesianChartOptions,
  gleanRadialChartOptions,
  gleanSliceBorder,
} from './chart-theme.js'

Chart.register(...registerables)

const palette = GLEAN_CHART_PALETTE

/** Permissions Policy: programmatic downloads (e.g. jsPDF.save). Blocked in sandboxed iframes without allow-downloads. */
function isDownloadsFeatureAllowed() {
  try {
    const pp = document.permissionsPolicy
    if (pp && typeof pp.allowsFeature === 'function') {
      return pp.allowsFeature('downloads')
    }
  } catch {
    // Unsupported feature name or API
  }
  return true
}

const DOWNLOADS_ALLOWED = isDownloadsFeatureAllowed()

function sanitizeFilename(name) {
  const s = String(name ?? 'chart')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .trim()
  return s || 'chart'
}

function buildPdfTableData(payload) {
  if (!payload || !Array.isArray(payload.labels) || payload.labels.length === 0) {
    return { head: [['Label', 'Value']], body: [['—', '—']] }
  }
  const hasMultiSeries = payload.series && payload.series.length > 0
  if (hasMultiSeries) {
    const head = [['Label', ...payload.series.map((s) => String(s.name))]]
    const body = payload.labels.map((label, i) => [
      String(label),
      ...payload.series.map((s) => (s.data[i] != null ? String(s.data[i]) : '')),
    ])
    return { head, body }
  }
  const dataArr = Array.isArray(payload.data) ? payload.data : []
  return {
    head: [['Label', 'Value']],
    body: payload.labels.map((label, i) => [
      String(label),
      dataArr[i] != null ? String(dataArr[i]) : '',
    ]),
  }
}

function addLandscapeChartAndTablePage(pdf, imgData, canvasWidth, canvasHeight, title, payload) {
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 40
  const colGap = 14
  const titleLine = title != null ? String(title) : ''
  let contentTop = margin
  if (titleLine) {
    pdf.setFontSize(11)
    pdf.setTextColor(28, 28, 30)
    pdf.text(titleLine, margin, margin + 12)
    contentTop = margin + 26
  }
  const contentBottom = pageH - margin
  const availH = contentBottom - contentTop

  const splitX = pageW / 2
  const leftMaxW = splitX - colGap / 2 - margin
  const rightX = splitX + colGap / 2
  const rightMaxW = pageW - margin - rightX

  const cw = canvasWidth
  const ch = canvasHeight
  let imgW = leftMaxW
  let imgH = (ch / cw) * imgW
  if (imgH > availH) {
    imgH = availH
    imgW = (cw / ch) * imgH
  }
  const imgX = margin + (leftMaxW - imgW) / 2
  pdf.addImage(imgData, 'PNG', imgX, contentTop, imgW, imgH)

  const { head, body } = buildPdfTableData(payload)
  autoTable(pdf, {
    head,
    body,
    startY: contentTop,
    margin: { left: rightX, right: margin },
    tableWidth: rightMaxW,
    styles: {
      fontSize: 8,
      cellPadding: 3,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [236, 234, 228],
      textColor: [12, 12, 17],
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [252, 251, 248] },
    theme: 'striped',
    tableLineColor: [230, 226, 216],
    tableLineWidth: 0.2,
  })
}

function exportCanvasToPdf(canvas, { title, filenameBase, payload } = {}) {
  if (!canvas || canvas.width < 2 || canvas.height < 2) return
  const imgData = canvas.toDataURL('image/png', 1.0)
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  addLandscapeChartAndTablePage(pdf, imgData, canvas.width, canvas.height, title, payload)
  pdf.save(`${sanitizeFilename(filenameBase)}.pdf`)
}

/** Inline SVGs replace emoji for a calmer, product-aligned UI (Glean design language). */
const VIZ_ICONS = {
  trend:
    '<svg class="viz-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18 9 10l5 4 6-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bar: '<svg class="viz-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="12" width="4" height="8" rx="1" fill="currentColor"/><rect x="10" y="8" width="4" height="12" rx="1" fill="currentColor"/><rect x="16" y="4" width="4" height="16" rx="1" fill="currentColor"/></svg>',
  pie: '<svg class="viz-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10h-8V2z" opacity="0.4"/><path fill="currentColor" d="M12 2v10h8.9A8.5 8.5 0 0 0 12 2z"/></svg>',
  donut:
    '<svg class="viz-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" opacity="0.35"/><circle cx="12" cy="12" r="4.5"/></svg>',
  table:
    '<svg class="viz-icon viz-icon--sm" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5h16v3H4V5zm0 5h7v9H4v-9zm9 0h7v4h-7v-4zm0 5h7v4h-7v-4z"/></svg>',
  pdf:
    '<svg class="viz-icon viz-icon--sm" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 12h8v2H8v-2zm0 4h8v2H8v-2z"/></svg>',
  reset:
    '<svg class="viz-icon viz-icon--sm" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12a8 8 0 0 1 14.32-4"/><path d="M20 4v5h-5"/></svg>',
}

function normalizeSeries(labelsLen, seriesRaw) {
  if (!Array.isArray(seriesRaw) || seriesRaw.length === 0) return null
  const out = []
  for (const row of seriesRaw) {
    if (!row || typeof row !== 'object') return null
    const name = row.name != null ? String(row.name) : ''
    if (!Array.isArray(row.data)) return null
    const nums = row.data.map((v) => Number(v))
    if (nums.some((n) => Number.isNaN(n))) return null
    const len = Math.min(labelsLen, nums.length)
    if (len < 1) return null
    out.push({ name: name || 'Series', data: nums.slice(0, len) })
  }
  return out.length ? out : null
}

function normalizeDataset(raw) {
  if (!raw || typeof raw !== 'object') return null
  const { chartType, labels, data, visualizationName, series: seriesRaw } = raw
  const allowed = new Set(['donut', 'pie', 'bar', 'trendline'])
  if (!allowed.has(chartType)) return null
  if (!Array.isArray(labels)) return null

  const labelStrs = labels.map(String)
  const labelCount = labelStrs.length
  if (labelCount < 1) return null

  if (chartType === 'trendline') {
    const multi = normalizeSeries(labelCount, seriesRaw)
    if (multi) {
      const sliceLen = Math.min(
        labelCount,
        ...multi.map((s) => s.data.length),
      )
      if (sliceLen < 1) return null
      return {
        chartType,
        labels: labelStrs.slice(0, sliceLen),
        data: multi[0].data.slice(0, sliceLen),
        series: multi.map((s) => ({
          name: s.name,
          data: s.data.slice(0, sliceLen),
        })),
        visualizationName: String(visualizationName ?? 'Chart'),
      }
    }
  }

  if (!Array.isArray(data)) return null
  const nums = data.map((v) => Number(v))
  if (nums.some((n) => Number.isNaN(n))) return null
  const len = Math.min(labelCount, nums.length)
  if (len < 1) return null
  return {
    chartType,
    labels: labelStrs.slice(0, len),
    data: nums.slice(0, len),
    visualizationName: String(visualizationName ?? 'Chart'),
  }
}

function normalizePayload(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (!Array.isArray(raw.datasets)) return null
  const datasets = raw.datasets.map(normalizeDataset).filter(Boolean)
  if (datasets.length === 0) return null
  return { datasets }
}

function segmentColors(count) {
  return Array.from({ length: count }, (_, i) => palette[i % palette.length])
}

function aggregateAcrossPoints(values, mode) {
  const nums = values.map((v) => Number(v) || 0)
  const n = nums.length
  if (n === 0) return 0
  const sum = nums.reduce((a, b) => a + b, 0)
  if (mode === 'average') return sum / n
  return sum
}

function getPieDonutLabelsAndData(payload, mode) {
  const multi = payload.series && payload.series.length > 0
  if (!multi) {
    return { labels: payload.labels, data: payload.data }
  }
  const labels = payload.series.map((s) => s.name)
  const data = payload.series.map((s) => aggregateAcrossPoints(s.data, mode))
  return { labels, data }
}

class ChartCard {
  constructor(dataset, index) {
    this.dataset = dataset
    this.index = index
    this.chart = null
    this.selectedChartType = dataset.chartType
    this.aggregationMode = 'sum'
    this.tableVisible = false
    this.collapsed = false
    this.element = this.createDOM()
  }

  createDOM() {
    const card = document.createElement('div')
    card.className = 'chart-card'
    card.dataset.index = this.index

    card.innerHTML = `
      <div class="chart-card-header">
        <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
        <div class="chart-card-header-left">
          <h2 class="chart-title"></h2>
          <span class="chart-hint"></span>
        </div>
        <button type="button" class="collapse-toggle" aria-expanded="true" aria-label="Toggle chart visibility">▼</button>
      </div>
      <div class="chart-card-body">
        <div class="chart-type-switcher">
          <button type="button" data-chart-type="trendline" aria-label="Trendline chart" title="Trendline">${VIZ_ICONS.trend}</button>
          <button type="button" data-chart-type="bar" aria-label="Bar chart" title="Bar">${VIZ_ICONS.bar}</button>
          <button type="button" data-chart-type="pie" aria-label="Pie chart" title="Pie">${VIZ_ICONS.pie}</button>
          <button type="button" data-chart-type="donut" aria-label="Donut chart" title="Donut">${VIZ_ICONS.donut}</button>
        </div>
        <div class="aggregation-toolbar" hidden>
          <span class="aggregation-label">Across labels</span>
          <div class="aggregation-buttons">
            <button type="button" data-aggregation="sum" title="Total per series">Sum</button>
            <button type="button" data-aggregation="average" title="Mean per series">Average</button>
          </div>
        </div>
        <div class="chart-wrap">
          <canvas aria-label="Chart canvas"></canvas>
        </div>
        <div class="table-toggle-bar">
          <button type="button" class="table-toggle" aria-expanded="false">
            <span class="table-toggle-icon">${VIZ_ICONS.table}</span>
            <span>Show Data</span>
          </button>
          ${
            DOWNLOADS_ALLOWED
              ? `<button type="button" class="export-pdf-btn" aria-label="Export chart as PDF">
            <span class="table-toggle-icon">${VIZ_ICONS.pdf}</span>
            <span>Export PDF</span>
          </button>`
              : ''
          }
        </div>
        <div class="data-table-wrap" hidden>
          <table class="data-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
      <div class="resize-handle" title="Drag to resize">⋱</div>
    `

    this.setupEventListeners(card)
    return card
  }

  setupEventListeners(card) {
    const header = card.querySelector('.chart-card-header')
    if (header) {
      header.addEventListener('click', (e) => {
        if (e.target.closest('.drag-handle')) return
        if (e.target.closest('.collapse-toggle') || e.target === header || e.target.closest('.chart-card-header-left')) {
          this.toggleCollapse()
        }
      })
    }

    const dragHandle = card.querySelector('.drag-handle')
    if (dragHandle) {
      this.setupDrag(dragHandle)
    }

    card.querySelectorAll('.chart-type-switcher button[data-chart-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.chartType
        if (!type) return
        this.selectedChartType = type
        this.setActiveChartButton()
        this.render()
      })
    })

    card.querySelectorAll('.aggregation-toolbar button[data-aggregation]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.aggregation
        if (mode !== 'sum' && mode !== 'average') return
        this.aggregationMode = mode
        this.setActiveAggregationButtons()
        this.render()
      })
    })

    const toggleBtn = card.querySelector('.table-toggle')
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.tableVisible = !this.tableVisible
        this.updateTableVisibility()
      })
    }

    if (DOWNLOADS_ALLOWED) {
      const exportPdfBtn = card.querySelector('.export-pdf-btn')
      if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          const canvas = card.querySelector('canvas')
          const payload = this.getRenderablePayload()
          if (!canvas || !this.chart) return
          exportCanvasToPdf(canvas, {
            title: payload.visualizationName,
            filenameBase: payload.visualizationName,
            payload,
          })
        })
      }
    }

    const resizeHandle = card.querySelector('.resize-handle')
    if (resizeHandle) {
      this.setupResize(resizeHandle)
    }
  }

  setupResize(handle) {
    let startX, startY, startWidth, startHeight

    const onMouseMove = (e) => {
      const newWidth = Math.max(200, startWidth + (e.clientX - startX))
      const newHeight = Math.max(150, startHeight + (e.clientY - startY))
      this.element.style.width = `${newWidth}px`
      const chartWrap = this.element.querySelector('.chart-wrap')
      if (chartWrap) {
        chartWrap.style.height = `${Math.max(120, newHeight - 140)}px`
      }
      if (this.chart) {
        this.chart.resize()
      }
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      this.element.classList.remove('resizing')
    }

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      startX = e.clientX
      startY = e.clientY
      startWidth = this.element.offsetWidth
      const chartWrap = this.element.querySelector('.chart-wrap')
      startHeight = chartWrap ? chartWrap.offsetHeight + 140 : this.element.offsetHeight
      this.element.classList.add('resizing')
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    })
  }

  setupDrag(handle) {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      startDrag(this, e.clientX, e.clientY)
    })
  }

  toggleCollapse() {
    this.collapsed = !this.collapsed
    this.updateCollapseState()
  }

  updateCollapseState() {
    const body = this.element.querySelector('.chart-card-body')
    const toggleBtn = this.element.querySelector('.collapse-toggle')
    if (body) {
      body.hidden = this.collapsed
    }
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', String(!this.collapsed))
    }
    this.element.classList.toggle('collapsed', this.collapsed)
  }

  getRenderablePayload() {
    return { ...this.dataset, chartType: this.selectedChartType }
  }

  setActiveChartButton() {
    this.element.querySelectorAll('.chart-type-switcher button[data-chart-type]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.chartType === this.selectedChartType)
    })
  }

  setActiveAggregationButtons() {
    this.element.querySelectorAll('.aggregation-toolbar button[data-aggregation]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.aggregation === this.aggregationMode)
    })
  }

  updateAggregationToolbarVisibility() {
    const toolbar = this.element.querySelector('.aggregation-toolbar')
    if (!toolbar) return
    const multi = this.dataset.series?.length > 0
    const type = this.selectedChartType
    const show = Boolean(multi && (type === 'pie' || type === 'donut'))
    toolbar.hidden = !show
    if (show) this.setActiveAggregationButtons()
  }

  updateTableVisibility() {
    const tableWrap = this.element.querySelector('.data-table-wrap')
    const toggleBtn = this.element.querySelector('.table-toggle')
    if (!tableWrap || !toggleBtn) return

    tableWrap.hidden = !this.tableVisible
    toggleBtn.setAttribute('aria-expanded', String(this.tableVisible))
    toggleBtn.classList.toggle('active', this.tableVisible)
    const label = toggleBtn.querySelector('span:last-child')
    if (label) {
      label.textContent = this.tableVisible ? 'Hide Data' : 'Show Data'
    }
  }

  destroyChart() {
    if (this.chart) {
      this.chart.destroy()
      this.chart = null
    }
  }

  render() {
    this.destroyChart()
    const payload = this.getRenderablePayload()

    const titleEl = this.element.querySelector('.chart-title')
    const hintEl = this.element.querySelector('.chart-hint')
    const canvas = this.element.querySelector('canvas')

    if (!canvas || !titleEl) return

    titleEl.textContent = payload.visualizationName
    const seriesCount = payload.series?.length ?? 0
    const isPieOrDonut = payload.chartType === 'pie' || payload.chartType === 'donut'

    if (hintEl) {
      if (isPieOrDonut && seriesCount > 0) {
        const aggLabel = this.aggregationMode === 'average' ? 'average' : 'sum'
        hintEl.textContent = `${payload.chartType} · ${seriesCount} series`
      } else if (payload.chartType === 'trendline' && seriesCount > 0) {
        hintEl.textContent = `${payload.chartType} · ${seriesCount} series`
      } else {
        hintEl.textContent = `${payload.chartType} · ${payload.labels.length} pts`
      }
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (payload.chartType === 'donut') {
      const { labels: donutLabels, data: donutData } = getPieDonutLabelsAndData(payload, this.aggregationMode)
      const colors = segmentColors(donutLabels.length)
      const b = gleanSliceBorder()
      this.chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: donutLabels,
          datasets: [
            {
              data: donutData,
              backgroundColor: colors,
              borderWidth: 1,
              borderColor: b,
            },
          ],
        },
        options: {
          ...gleanRadialChartOptions(),
          responsive: true,
          maintainAspectRatio: false,
          cutout: '58%',
        },
      })
    } else if (payload.chartType === 'pie') {
      const { labels: pieLabels, data: pieData } = getPieDonutLabelsAndData(payload, this.aggregationMode)
      const pieColors = segmentColors(pieLabels.length)
      const pb = gleanSliceBorder()
      this.chart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: pieLabels,
          datasets: [
            {
              data: pieData,
              backgroundColor: pieColors,
              borderWidth: 1,
              borderColor: pb,
            },
          ],
        },
        options: {
          ...gleanRadialChartOptions(),
          responsive: true,
          maintainAspectRatio: false,
        },
      })
    } else if (payload.chartType === 'bar') {
      const hasMultiSeries = payload.series && payload.series.length > 0
      const barColors = segmentColors(payload.labels.length)
      const datasets = hasMultiSeries
        ? payload.series.map((s, i) => ({
            label: s.name,
            data: s.data,
            backgroundColor: palette[i % palette.length],
            borderWidth: 0,
            stack: 'total',
          }))
        : [{
            label: payload.visualizationName,
            data: payload.data,
            backgroundColor: barColors,
            borderWidth: 0,
          }]
      const cart = gleanCartesianChartOptions()
      this.chart = new Chart(ctx, {
        type: 'bar',
        data: { labels: payload.labels, datasets },
        options: {
          ...cart,
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { ...cart.scales.x, stacked: hasMultiSeries },
            y: { ...cart.scales.y, stacked: hasMultiSeries },
          },
          plugins: {
            ...cart.plugins,
            legend: {
              ...cart.plugins.legend,
              display: hasMultiSeries,
              position: 'bottom',
            },
          },
        },
      })
    } else if (payload.chartType === 'trendline') {
      const multi = payload.series && payload.series.length > 0
      const datasets = multi
        ? payload.series.map((s, i) => {
            const border = palette[i % palette.length]
            return {
              label: s.name,
              data: s.data,
              borderColor: border,
              backgroundColor: border,
              fill: false,
              tension: 0.35,
              pointRadius: 3,
              pointHoverRadius: 5,
              pointBackgroundColor: border,
              borderWidth: 2,
            }
          })
        : [{
            label: payload.visualizationName,
            data: payload.data,
            borderColor: palette[0],
            backgroundColor: GLEAN_PRIMARY_SOFT_FILL,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2,
          }]

      const lineOpts = gleanCartesianChartOptions()
      this.chart = new Chart(ctx, {
        type: 'line',
        data: { labels: payload.labels, datasets },
        options: {
          ...lineOpts,
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: lineOpts.scales.x,
            y: { ...lineOpts.scales.y, beginAtZero: true },
          },
          plugins: {
            ...lineOpts.plugins,
            legend: { ...lineOpts.plugins.legend, display: true, position: 'bottom' },
          },
        },
      })
    }

    this.setActiveChartButton()
    this.updateAggregationToolbarVisibility()
    this.renderDataTable()
  }

  renderDataTable() {
    const table = this.element.querySelector('.data-table')
    if (!table) return

    const thead = table.querySelector('thead')
    const tbody = table.querySelector('tbody')
    thead.innerHTML = ''
    tbody.innerHTML = ''

    const hasMultiSeries = this.dataset.series && this.dataset.series.length > 0

    if (hasMultiSeries) {
      const headerRow = document.createElement('tr')
      const labelTh = document.createElement('th')
      labelTh.textContent = 'Label'
      headerRow.appendChild(labelTh)
      for (const s of this.dataset.series) {
        const th = document.createElement('th')
        th.textContent = s.name
        headerRow.appendChild(th)
      }
      thead.appendChild(headerRow)

      for (let i = 0; i < this.dataset.labels.length; i++) {
        const row = document.createElement('tr')
        const labelTd = document.createElement('td')
        labelTd.textContent = this.dataset.labels[i]
        row.appendChild(labelTd)
        for (const s of this.dataset.series) {
          const td = document.createElement('td')
          td.textContent = s.data[i] != null ? s.data[i] : ''
          row.appendChild(td)
        }
        tbody.appendChild(row)
      }
    } else {
      const headerRow = document.createElement('tr')
      const labelTh = document.createElement('th')
      labelTh.textContent = 'Label'
      headerRow.appendChild(labelTh)
      const valueTh = document.createElement('th')
      valueTh.textContent = 'Value'
      headerRow.appendChild(valueTh)
      thead.appendChild(headerRow)

      for (let i = 0; i < this.dataset.labels.length; i++) {
        const row = document.createElement('tr')
        const labelTd = document.createElement('td')
        labelTd.textContent = this.dataset.labels[i]
        row.appendChild(labelTd)
        const valueTd = document.createElement('td')
        valueTd.textContent = this.dataset.data[i] != null ? this.dataset.data[i] : ''
        row.appendChild(valueTd)
        tbody.appendChild(row)
      }
    }
  }

  destroy() {
    this.destroyChart()
    this.element.remove()
  }
}

let chartCards = []
let latestPayload = null
let dragState = null

/** One landscape A4 page per chart, in current grid order (after any drag reorder). */
function exportAllVisualisationsToPdf() {
  const pages = []
  for (const card of chartCards) {
    if (!card.chart) continue
    const canvas = card.element.querySelector('canvas')
    if (!canvas || canvas.width < 2 || canvas.height < 2) continue
    const payload = card.getRenderablePayload()
    pages.push({ canvas, title: payload.visualizationName, payload })
  }
  if (pages.length === 0) return

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  pages.forEach((p, i) => {
    if (i > 0) pdf.addPage()
    const imgData = p.canvas.toDataURL('image/png', 1.0)
    addLandscapeChartAndTablePage(pdf, imgData, p.canvas.width, p.canvas.height, p.title, p.payload)
  })
  const filenameBase =
    pages.length === 1 ? pages[0].title : 'Multi-chart-visualisation'
  pdf.save(`${sanitizeFilename(filenameBase)}.pdf`)
}

function clearAllCharts() {
  chartCards.forEach((card) => card.destroy())
  chartCards = []
}

function startDrag(cardInstance, startX, startY) {
  const grid = document.getElementById('charts-grid')
  if (!grid) return

  const el = cardInstance.element
  const rect = el.getBoundingClientRect()
  const gridRect = grid.getBoundingClientRect()

  const placeholder = document.createElement('div')
  placeholder.className = 'drop-placeholder'
  placeholder.style.width = `${rect.width}px`
  placeholder.style.height = `${rect.height}px`

  dragState = {
    cardInstance,
    placeholder,
    offsetX: startX - rect.left,
    offsetY: startY - rect.top,
    originalIndex: chartCards.indexOf(cardInstance),
  }

  el.classList.add('dragging')
  el.style.position = 'fixed'
  el.style.left = `${rect.left}px`
  el.style.top = `${rect.top}px`
  el.style.width = `${rect.width}px`
  el.style.zIndex = '1000'

  grid.insertBefore(placeholder, el)
  document.body.appendChild(el)

  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e) {
  if (!dragState) return

  const { cardInstance, placeholder, offsetX, offsetY } = dragState
  const el = cardInstance.element

  el.style.left = `${e.clientX - offsetX}px`
  el.style.top = `${e.clientY - offsetY}px`

  const grid = document.getElementById('charts-grid')
  if (!grid) return

  const children = Array.from(grid.children).filter(
    (c) => c !== placeholder && c.classList.contains('chart-card')
  )

  let insertBefore = null
  for (const child of children) {
    const childRect = child.getBoundingClientRect()
    const childCenterX = childRect.left + childRect.width / 2
    const childCenterY = childRect.top + childRect.height / 2

    if (e.clientY < childCenterY || (e.clientY < childRect.bottom && e.clientX < childCenterX)) {
      insertBefore = child
      break
    }
  }

  if (insertBefore) {
    grid.insertBefore(placeholder, insertBefore)
  } else {
    grid.appendChild(placeholder)
  }
}

function onDragEnd() {
  if (!dragState) return

  const { cardInstance, placeholder } = dragState
  const el = cardInstance.element
  const grid = document.getElementById('charts-grid')

  el.classList.remove('dragging')
  el.style.position = ''
  el.style.left = ''
  el.style.top = ''
  el.style.zIndex = ''

  if (grid && placeholder.parentNode === grid) {
    grid.insertBefore(el, placeholder)
    placeholder.remove()

    const newOrder = Array.from(grid.querySelectorAll('.chart-card')).map((cardEl) => {
      return chartCards.find((c) => c.element === cardEl)
    }).filter(Boolean)
    chartCards = newOrder
  }

  dragState = null
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

function applyFromArguments(args, isReset = false) {
  const payload = normalizePayload(args)
  if (!payload) return
  latestPayload = payload

  clearAllCharts()

  const grid = document.getElementById('charts-grid')
  const hintEl = document.getElementById('hint')
  const titleEl = document.getElementById('title')
  const resetBtn = document.getElementById('reset-btn')
  const headerActions = document.getElementById('header-actions')

  if (!grid) return

  if (hintEl) {
    hintEl.textContent = `${payload.datasets.length} chart(s)`
  }

  if (titleEl && payload.datasets.length === 1) {
    titleEl.textContent = payload.datasets[0].visualizationName
  } else if (titleEl) {
    titleEl.textContent = 'Multi-Chart Visualiser'
  }

  if (resetBtn) {
    resetBtn.hidden = false
  }

  if (headerActions) {
    headerActions.hidden = false
  }

  payload.datasets.forEach((dataset, index) => {
    const card = new ChartCard(dataset, index)
    chartCards.push(card)
    grid.appendChild(card.element)
    card.render()
  })

  requestMinimumSize(payload.datasets.length)
  updateGridLayout()
}

function resetToOriginal() {
  if (!latestPayload) return
  applyFromArguments(latestPayload, true)
}

function setupResetButton() {
  const resetBtn = document.getElementById('reset-btn')
  if (resetBtn) {
    resetBtn.addEventListener('click', resetToOriginal)
  }
}

function setupExportAllPdfButton() {
  const btn = document.getElementById('export-all-pdf-btn')
  if (!btn) return
  btn.addEventListener('click', () => exportAllVisualisationsToPdf())
}

const CARD_MIN_WIDTH = 300
const CARD_GAP = 12
const CONTAINER_PADDING = 28

function calculateMinWidth(datasetCount) {
  const columns = Math.min(datasetCount, 3)
  return (CARD_MIN_WIDTH * columns) + (CARD_GAP * (columns - 1)) + CONTAINER_PADDING
}

function requestMinimumSize(datasetCount) {
  const minWidth = calculateMinWidth(datasetCount)
  const minHeight = 400
  app.sendSizeChanged({ width: minWidth, height: minHeight })
}

function updateGridLayout() {
  const grid = document.getElementById('charts-grid')
  if (!grid) return
  
  const containerWidth = grid.offsetWidth
  const availableWidth = containerWidth - CONTAINER_PADDING
  const columns = Math.max(1, Math.min(3, Math.floor((availableWidth + CARD_GAP) / (CARD_MIN_WIDTH + CARD_GAP))))
  
  grid.style.setProperty('--grid-columns', String(columns))
}

const app = new App({ name: 'multi-visualiser', version: '1.0.0' }, { tools: { listChanged: true } })

app.addEventListener('hostcontextchanged', (params) => {
  if (params.containerDimensions) {
    updateGridLayout()
  }
})

app.addEventListener('toolinput', (params) => {
  applyFromArguments(params.arguments ?? {})
})

app.addEventListener('toolresult', (params) => {
  const sc = params.structuredContent
  if (sc && typeof sc === 'object') {
    applyFromArguments(sc)
  }
})

if (!DOWNLOADS_ALLOWED) {
  document.getElementById('export-all-pdf-btn')?.remove()
}

setupResetButton()
setupExportAllPdfButton()

window.addEventListener('resize', updateGridLayout)

app.connect(new PostMessageTransport(window.parent, window.parent))
