const { McpTool, McpToolAnnotationsBuilder } = require('../../models/mcp-tool')
const { z } = require('zod')

const CHART_TYPES = ['donut', 'pie', 'bar', 'trendline']

const seriesEntrySchema = z.object({
    name: z.coerce.string().describe('Legend label for this line.'),
    data: z
        .array(z.coerce.number())
        .min(1)
        .describe('Y values; must align in length with `labels` (same index = same x).'),
})

const datasetSchema = z.object({
    chartType: z
        .enum(CHART_TYPES)
        .describe('Chart style: donut and pie are circular; bar is vertical bars; trendline is a line chart.'),
    labels: z
        .array(z.coerce.string())
        .min(1)
        .describe('Category labels (same length as data).'),
    data: z
        .array(z.coerce.number())
        .optional()
        .describe(
            'One numeric value per label (donut, pie, bar, or a single trendline). For multi-line trendline you may omit this if `series` is set; otherwise required.',
        ),
    series: z
        .array(seriesEntrySchema)
        .optional()
        .describe(
            '**trendline only:** multiple metrics as separate lines. Each item is { name, data } where data.length must match labels.length. Ignored for donut, pie, and bar.',
        ),
    visualizationName: z.coerce.string().describe('Chart title shown above the graphic.'),
})

function buildDatasetPayload(inputs) {
    const hasMultiTrend =
        inputs.chartType === 'trendline' &&
        Array.isArray(inputs.series) &&
        inputs.series.length > 0
    const dataRaw = inputs.data ?? []
    const dataNums = dataRaw.map((n) => (typeof n === 'number' ? n : Number(n)))
    const primaryData =
        hasMultiTrend && dataNums.length === 0 && inputs.series[0]?.data
            ? inputs.series[0].data.map((n) => (typeof n === 'number' ? n : Number(n)))
            : dataNums

    const base = {
        chartType: inputs.chartType,
        labels: inputs.labels,
        data: primaryData,
        visualizationName: inputs.visualizationName,
    }
    if (hasMultiTrend) {
        base.series = inputs.series.map((s) => ({
            name: String(s.name),
            data: s.data.map((n) => (typeof n === 'number' ? n : Number(n))),
        }))
    }
    return base
}

function validateDataset(dataset, index) {
    const hasMultiTrend =
        dataset.chartType === 'trendline' &&
        Array.isArray(dataset.series) &&
        dataset.series.length > 0
    const dataLen = (dataset.data ?? []).length

    if (!hasMultiTrend && dataLen < 1) {
        return `Dataset ${index + 1}: Provide \`data\` (one number per label), or for trendline pass \`series\` with at least one { name, data }.`
    }

    if (hasMultiTrend) {
        const n = dataset.labels.length
        for (const s of dataset.series) {
            if (!Array.isArray(s.data) || s.data.length !== n) {
                return `Dataset ${index + 1}: Each series.data must have the same length as labels (${n}).`
            }
        }
    }

    return null
}

function createTool() {
    const tool = new McpTool('multi-visualiser-tool')

    tool.setTitle('Multi-Chart Visualiser')
    tool.setToolDescription(
        'Renders multiple independent Chart.js visualisations (donut, pie, bar, or trendline) from an array of datasets. Each dataset has its own labels, data, and chart type, allowing side-by-side comparison of different metrics.',
    )

    tool.addInputArgumentAdvanced(
        'datasets',
        z
            .array(datasetSchema)
            .min(1)
            .max(6)
            .describe('Array of 1-6 datasets to visualise. Each dataset is rendered as a separate chart.'),
    )

    tool.addUiResourceUri('ui://multi-visualiser.html')

    tool.setCallback(function (inputs) {
        const errors = []
        for (let i = 0; i < inputs.datasets.length; i++) {
            const error = validateDataset(inputs.datasets[i], i)
            if (error) errors.push(error)
        }

        if (errors.length > 0) {
            return {
                isError: true,
                content: [
                    {
                        type: 'text',
                        text: errors.join('\n'),
                    },
                ],
            }
        }

        const datasets = inputs.datasets.map(buildDatasetPayload)
        const names = datasets.map((d) => d.visualizationName).join(', ')

        return {
            content: [
                {
                    type: 'text',
                    text: `Rendered ${datasets.length} chart(s): ${names}`,
                },
            ],
            structuredContent: { datasets },
        }
    })

    tool.setAnnotations(new McpToolAnnotationsBuilder().setReadOnly().setTitle('Multi-Chart Visualiser').build())

    return tool
}

function getTool() {
    return createTool().getToolForMcpServer()
}

module.exports = { getTool }
