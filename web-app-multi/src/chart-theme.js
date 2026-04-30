/**
 * Glean-aligned chart colors and Chart.js theming.
 * Tokens reference company design language (e.g. Scout / Glean brand guidelines:
 * Electric Blue, data-viz palette, semantic contrast).
 */
export const GLEAN_CHART_PALETTE = [
  'rgba(52, 60, 237, 0.92)', // Electric Blue #343CED
  'rgba(255, 126, 76, 0.92)', // Orange #FF7E4C
  'rgba(0, 178, 7, 0.92)', // Data green #00B207
  'rgba(147, 0, 184, 0.9)', // Magenta #9300B8
  'rgba(16, 23, 177, 0.92)', // Deep blue #1017B1
  'rgba(63, 163, 255, 0.92)', // Info #3FA3FF
]

export const GLEAN_PRIMARY_SOFT_FILL = 'rgba(52, 60, 237, 0.14)'

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return v || fallback
}

/** Legend + axis colors that follow --chart-tick / --chart-grid from the app shell. */
export function gleanCartesianChartOptions(overrides = {}) {
  const tick = cssVar('--chart-tick', '#2e2e38')
  const grid = cssVar('--chart-grid', 'rgba(12, 12, 17, 0.09)')
  return {
    color: tick,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: tick,
          usePointStyle: true,
          boxWidth: 8,
          padding: 14,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: tick },
        grid: { color: grid, drawBorder: false },
      },
      y: {
        ticks: { color: tick },
        grid: { color: grid, drawBorder: false },
        beginAtZero: true,
      },
    },
    ...overrides,
  }
}

export function gleanRadialChartOptions(overrides = {}) {
  const tick = cssVar('--chart-tick', '#2e2e38')
  return {
    color: tick,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: tick,
          usePointStyle: true,
          boxWidth: 8,
          padding: 14,
        },
      },
    },
    ...overrides,
  }
}

/** Contrast for pie/donut segment edges (set --chart-slice-border in CSS per theme). */
export function gleanSliceBorder() {
  return cssVar('--chart-slice-border', 'rgba(255, 255, 255, 0.7)')
}
