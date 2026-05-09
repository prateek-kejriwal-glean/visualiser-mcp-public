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

function sanitizeFilename(name) {
  const s = String(name ?? 'chart')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .trim()
  return s || 'chart'
}

/** Same rows/columns as the on-screen data table (labels × values or labels × series). */
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

/** Embeds chart image (left) and data table (right) on a landscape A4 page and triggers download. */
function exportCanvasToPdf(canvas, { title, filenameBase, payload } = {}) {
  if (!canvas || canvas.width < 2 || canvas.height < 2) return
  const imgData = canvas.toDataURL('image/png', 1.0)
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  addLandscapeChartAndTablePage(pdf, imgData, canvas.width, canvas.height, title, payload)
  pdf.save(`${sanitizeFilename(filenameBase)}.pdf`)
}

function updateExportPdfButtonState() {
  const btn = document.getElementById('export-pdf-btn')
  if (!btn) return
  btn.disabled = !chart
}

function setupExportPdf() {
  const btn = document.getElementById('export-pdf-btn')
  if (!btn) return
  btn.addEventListener('click', () => {
    const canvas = document.getElementById('chart')
    const payload = getRenderablePayload()
    if (!canvas || !payload || !chart) return
    exportCanvasToPdf(canvas, {
      title: payload.visualizationName,
      filenameBase: payload.visualizationName,
      payload,
    })
  })
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

function normalizePayload(raw) {
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

let chart
let latestPayload = null
let selectedChartType = null
/** Used when aggregating multi-series into pie/donut slices (per series across labels). */
let aggregationMode = 'sum'
let tableVisible = false

function destroyChart() {
  if (chart) {
    chart.destroy()
    chart = undefined
  }
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

/** Pie/donut: one slice per category label (single series). Multi-series: one slice per series; category labels dropped; value is sum or average of that series across labels. */
function getPieDonutLabelsAndData(payload, mode) {
  const multi = payload.series && payload.series.length > 0
  if (!multi) {
    return { labels: payload.labels, data: payload.data }
  }
  const labels = payload.series.map((s) => s.name)
  const data = payload.series.map((s) => aggregateAcrossPoints(s.data, mode))
  return { labels, data }
}

function renderChart(payload) {
  destroyChart()
  updateExportPdfButtonState()
  const canvas = document.getElementById('chart')
  const titleEl = document.getElementById('title')
  const hintEl = document.getElementById('hint')
  if (!canvas || !titleEl || !hintEl) return

  titleEl.textContent = payload.visualizationName
  const seriesCount = payload.series?.length ?? 0
  const isPieOrDonut =
    payload.chartType === 'pie' || payload.chartType === 'donut'
  if (isPieOrDonut && seriesCount > 0) {
    const aggLabel = aggregationMode === 'average' ? 'average' : 'sum'
    hintEl.textContent = `${payload.chartType} · ${seriesCount} series (${aggLabel} across labels)`
  } else if (payload.chartType === 'trendline' && seriesCount > 0) {
    hintEl.textContent = `${payload.chartType} · ${payload.labels.length} points · ${seriesCount} series`
  } else {
    hintEl.textContent = `${payload.chartType} · ${payload.labels.length} points`
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  if (payload.chartType === 'donut') {
    const { labels: donutLabels, data: donutData } = getPieDonutLabelsAndData(
      payload,
      aggregationMode,
    )
    const colors = segmentColors(donutLabels.length)
    const border = gleanSliceBorder()
    chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: donutLabels,
        datasets: [
          {
            data: donutData,
            backgroundColor: colors,
            borderWidth: 1,
            borderColor: border,
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
    updateAggregationToolbarVisibility()
    updateExportPdfButtonState()
    return
  }

  if (payload.chartType === 'pie') {
    const { labels: pieLabels, data: pieData } = getPieDonutLabelsAndData(
      payload,
      aggregationMode,
    )
    const pieColors = segmentColors(pieLabels.length)
    const pieBorder = gleanSliceBorder()
    chart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: pieLabels,
        datasets: [
          {
            data: pieData,
            backgroundColor: pieColors,
            borderWidth: 1,
            borderColor: pieBorder,
          },
        ],
      },
      options: {
        ...gleanRadialChartOptions(),
        responsive: true,
        maintainAspectRatio: false,
      },
    })
    updateAggregationToolbarVisibility()
    updateExportPdfButtonState()
    return
  }

  if (payload.chartType === 'bar') {
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
      : [
          {
            label: payload.visualizationName,
            data: payload.data,
            backgroundColor: barColors,
            borderWidth: 0,
          },
        ]
    const cart = gleanCartesianChartOptions()
    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: payload.labels,
        datasets,
      },
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
    updateAggregationToolbarVisibility()
    updateExportPdfButtonState()
    return
  }

  if (payload.chartType === 'trendline') {
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
      : [
          {
            label: payload.visualizationName,
            data: payload.data,
            borderColor: palette[0],
            backgroundColor: GLEAN_PRIMARY_SOFT_FILL,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2,
          },
        ]

    const lineOpts = gleanCartesianChartOptions()
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: payload.labels,
        datasets,
      },
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

  updateAggregationToolbarVisibility()
  updateExportPdfButtonState()
}

function setActiveAggregationButtons() {
  const toolbar = document.getElementById('aggregation-toolbar')
  if (!toolbar) return
  toolbar.querySelectorAll('button[data-aggregation]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.aggregation === aggregationMode)
  })
}

function updateAggregationToolbarVisibility() {
  const toolbar = document.getElementById('aggregation-toolbar')
  if (!toolbar) return
  const multi = latestPayload?.series?.length > 0
  const type = selectedChartType ?? latestPayload?.chartType
  const show = Boolean(multi && (type === 'pie' || type === 'donut'))
  toolbar.hidden = !show
  if (show) setActiveAggregationButtons()
}

function setActiveChartButton(chartType) {
  const switcher = document.getElementById('chart-type-switcher')
  if (!switcher) return
  switcher
    .querySelectorAll('button[data-chart-type]')
    .forEach((btn) => btn.classList.toggle('active', btn.dataset.chartType === chartType))
}

function getRenderablePayload() {
  if (!latestPayload) return null
  const chartType = selectedChartType ?? latestPayload.chartType
  return { ...latestPayload, chartType }
}

function applyFromArguments(args) {
  const payload = normalizePayload(args)
  if (!payload) return
  latestPayload = payload
  selectedChartType = payload.chartType
  aggregationMode = 'sum'
  setActiveChartButton(selectedChartType)
  renderChart(payload)
  renderDataTable()
}

function setupChartTypeSwitcher() {
  const switcher = document.getElementById('chart-type-switcher')
  if (!switcher) return
  switcher.querySelectorAll('button[data-chart-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.chartType
      if (!type) return
      selectedChartType = type
      setActiveChartButton(type)
      const payload = getRenderablePayload()
      if (payload) {
        renderChart(payload)
      } else {
        updateAggregationToolbarVisibility()
      }
    })
  })
}

function setupAggregationControls() {
  const toolbar = document.getElementById('aggregation-toolbar')
  if (!toolbar) return
  toolbar.querySelectorAll('button[data-aggregation]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.aggregation
      if (mode !== 'sum' && mode !== 'average') return
      aggregationMode = mode
      setActiveAggregationButtons()
      const payload = getRenderablePayload()
      if (payload) renderChart(payload)
    })
  })
}

function renderDataTable() {
  const tableWrap = document.getElementById('data-table-wrap')
  const table = document.getElementById('data-table')
  if (!tableWrap || !table) return

  const thead = table.querySelector('thead')
  const tbody = table.querySelector('tbody')
  thead.innerHTML = ''
  tbody.innerHTML = ''

  if (!latestPayload) return

  const hasMultiSeries = latestPayload.series && latestPayload.series.length > 0

  if (hasMultiSeries) {
    const headerRow = document.createElement('tr')
    const labelTh = document.createElement('th')
    labelTh.textContent = 'Label'
    headerRow.appendChild(labelTh)
    for (const s of latestPayload.series) {
      const th = document.createElement('th')
      th.textContent = s.name
      headerRow.appendChild(th)
    }
    thead.appendChild(headerRow)

    for (let i = 0; i < latestPayload.labels.length; i++) {
      const row = document.createElement('tr')
      const labelTd = document.createElement('td')
      labelTd.textContent = latestPayload.labels[i]
      row.appendChild(labelTd)
      for (const s of latestPayload.series) {
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

    for (let i = 0; i < latestPayload.labels.length; i++) {
      const row = document.createElement('tr')
      const labelTd = document.createElement('td')
      labelTd.textContent = latestPayload.labels[i]
      row.appendChild(labelTd)
      const valueTd = document.createElement('td')
      valueTd.textContent = latestPayload.data[i] != null ? latestPayload.data[i] : ''
      row.appendChild(valueTd)
      tbody.appendChild(row)
    }
  }
}

function updateTableVisibility() {
  const tableWrap = document.getElementById('data-table-wrap')
  const toggleBtn = document.getElementById('table-toggle')
  if (!tableWrap || !toggleBtn) return

  tableWrap.hidden = !tableVisible
  toggleBtn.setAttribute('aria-expanded', String(tableVisible))
  toggleBtn.classList.toggle('active', tableVisible)
  const label = toggleBtn.querySelector('span:last-child')
  if (label) {
    label.textContent = tableVisible ? 'Hide Data' : 'Show Data'
  }
}

function setupTableToggle() {
  const toggleBtn = document.getElementById('table-toggle')
  if (!toggleBtn) return
  toggleBtn.addEventListener('click', () => {
    tableVisible = !tableVisible
    updateTableVisibility()
  })
}

const app = new App({ name: 'visualiser', version: '1.0.0' }, { tools: { listChanged: true } })

// MCP UI: host → view notifications for the same tool call can differ in timing and shape.
// - toolinput: final arguments for the invocation (may arrive before the server finishes). Good
//   for early paint; values are what the host sent, not necessarily what the tool returns.
// - toolresult: standard CallToolResult after execution. structuredContent here is whatever the
//   tool handler emitted (normalization, defaults, errors). On isError or validation failure there
//   may be no structuredContent. Prefer this path when you need the canonical server payload.

app.addEventListener('toolinput', (params) => {
  applyFromArguments(params.arguments ?? {})
})

app.addEventListener('toolresult', (params) => {
  const sc = params.structuredContent
  if (sc && typeof sc === 'object') {
    applyFromArguments(sc)
  }
})

if (!isDownloadsFeatureAllowed()) {
  document.getElementById('export-pdf-btn')?.remove()
}

setupChartTypeSwitcher()
setupAggregationControls()
setupTableToggle()
setupExportPdf()
app.connect(new PostMessageTransport(window.parent, window.parent))
