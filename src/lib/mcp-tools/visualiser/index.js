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

function buildChartPayload(inputs) {
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

function createTool() {
    const tool = new McpTool('visualiser-tool')

    tool.setTitle('Chart visualiser')
    tool.setToolDescription(
        'Renders an interactive Chart.js view (donut, pie, bar, or trendline) from labels and numeric values. For trendline only: pass `series` (array of { name, data }) to draw multiple lines sharing the same `labels`; otherwise pass a single `data` array and `visualizationName` for one line.',
    )

    tool.addInputArgumentAdvanced(
        'chartType',
        z
            .enum(CHART_TYPES)
            .describe('Chart style: donut and pie are circular; bar is vertical bars; trendline is a line chart.'),
    )
    tool.addInputArgumentAdvanced(
        'labels',
        z
            .array(z.coerce.string())
            .min(1)
            .describe('Category labels (same length as data).'),
    )
    tool.addInputArgumentAdvanced(
        'data',
        z
            .array(z.coerce.number())
            .optional()
            .describe(
                'One numeric value per label (donut, pie, bar, or a single trendline). For multi-line trendline you may omit this if `series` is set; otherwise required.',
            ),
    )
    tool.addInputArgumentAdvanced(
        'series',
        z
            .array(seriesEntrySchema)
            .optional()
            .describe(
                '**trendline only:** multiple metrics as separate lines. Each item is { name, data } where data.length must match labels.length. Ignored for donut, pie, and bar.',
            ),
    )
    tool.addInputArgument(
        'visualizationName',
        'string',
        'Chart title shown above the graphic. For a single trendline (no `series`), also used as the line legend label.',
        'Sales',
    )

    tool.addUiResourceUri('ui://visualiser.html')

    tool.setCallback(function (inputs) {
        const hasMultiTrend =
            inputs.chartType === 'trendline' &&
            Array.isArray(inputs.series) &&
            inputs.series.length > 0
        const dataLen = (inputs.data ?? []).length
        if (!hasMultiTrend && dataLen < 1) {
            return {
                isError: true,
                content: [
                    {
                        type: 'text',
                        text: 'Provide `data` (one number per label), or for trendline pass `series` with at least one { name, data }.',
                    },
                ],
            }
        }
        if (hasMultiTrend) {
            const n = inputs.labels.length
            for (const s of inputs.series) {
                if (!Array.isArray(s.data) || s.data.length !== n) {
                    return {
                        isError: true,
                        content: [
                            {
                                type: 'text',
                                text: `Each series.data must have the same length as labels (${n}).`,
                            },
                        ],
                    }
                }
            }
        }

        const payload = buildChartPayload(inputs)
        return {
            content: [
                {
                    type: 'text',
                    text: `Rendered ${payload.chartType} chart: ${payload.visualizationName}`,
                },
            ],
            structuredContent: payload,
        }
    })
    tool.setAnnotations(new McpToolAnnotationsBuilder().setReadOnly().setTitle('Chart visualiser').build())

    return tool
}

function getTool() {
    return createTool().getToolForMcpServer()
}

module.exports = { getTool }
